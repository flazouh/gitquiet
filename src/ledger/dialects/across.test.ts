import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser, type Tree } from "web-tree-sitter"
import { dialectFor } from "../dialects"
import { reachingAll } from "../reaching"
import type { Syntax } from "../syntax"
import { writingAt, writingNamed } from "../writings"

/**
 * Following a name out of the file it is read in, end to end, per language.
 *
 * The three steps a press makes, with nothing stood in for: the resolver says
 * the name came from somewhere else, `reaching` turns what the file said into a
 * path that exists, and the file at that path is asked what it writes under the
 * name. Each is tested on its own elsewhere; what this holds is that they fit.
 *
 * Two shapes of import, and the difference decides what a press can do:
 *
 *  - **A name is brought in.** `import com.ex.shapes.Box` binds `Box`, so a
 *    press on it knows what it wants. Java, PHP and C# work this way, and so do
 *    TypeScript, Python and Rust.
 *  - **A whole file is brought in and nothing is named.** `require_relative`,
 *    `#include` and a Go import bring in everything another file writes and name
 *    none of it, so a name that came through one is bound nowhere in the file
 *    using it. The only honest answer is "one of the files this one took whole",
 *    and each is asked in turn.
 */

type Case = {
  readonly language: string
  readonly wasm: string
  /** The file the press happens in, and every file the repository holds. */
  readonly from: string
  readonly files: Readonly<Record<string, string>>
  /** The word pressed, and the line it is written on in the other file. */
  readonly press: string
  readonly wrote: string
  readonly at: number
}

const CASES: ReadonlyArray<Case> = [
  {
    language: "java",
    wasm: "tree-sitter-java.wasm",
    from: "src/main/java/com/ex/Main.java",
    press: "Box",
    wrote: "src/main/java/com/ex/shapes/Box.java",
    at: 2,
    files: {
      "src/main/java/com/ex/Main.java":
        "package com.ex;\nimport com.ex.shapes.Box;\nclass Main { int go() { return new Box(1).size(); } }\n",
      "src/main/java/com/ex/shapes/Box.java":
        "package com.ex.shapes;\npublic class Box { public Box(int n) {} public int size() { return 1; } }\n"
    }
  },
  {
    language: "php",
    wasm: "tree-sitter-php.wasm",
    from: "src/Main.php",
    press: "Thing",
    wrote: "src/Other/Thing.php",
    at: 3,
    files: {
      "src/Main.php":
        "<?php\nnamespace App;\nuse App\\Other\\Thing;\nfunction go() { return new Thing(); }\n",
      "src/Other/Thing.php": "<?php\nnamespace App\\Other;\nclass Thing { }\n"
    }
  },
  {
    language: "c#",
    wasm: "tree-sitter-c-sharp.wasm",
    from: "src/Main.cs",
    press: "Widget",
    wrote: "src/Other/Thing.cs",
    at: 1,
    files: {
      "src/Main.cs": "using Widget = App.Other.Thing;\nclass Main { Widget w; }\n",
      "src/Other/Thing.cs": "namespace App.Other { public class Thing { } }\n"
    }
  },
  {
    language: "ruby",
    wasm: "tree-sitter-ruby.wasm",
    from: "app/main.rb",
    press: "Helper",
    wrote: "app/helper.rb",
    at: 1,
    files: {
      "app/main.rb":
        "require_relative 'helper'\n\nclass Main\n  def go\n    Helper.new\n  end\nend\n",
      "app/helper.rb": "class Helper\nend\n"
    }
  },
  {
    language: "c++",
    wasm: "tree-sitter-cpp.wasm",
    from: "src/main.cpp",
    press: "helper",
    wrote: "src/helper.h",
    at: 1,
    files: {
      "src/main.cpp": '#include "helper.h"\n\nint main() { return helper(); }\n',
      "src/helper.h": "inline int helper() { return 1; }\n"
    }
  }
]

const languages = new Map<string, Language>()

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  for (const one of CASES) {
    if (languages.has(one.wasm)) continue
    languages.set(
      one.wasm,
      await Language.load(`node_modules/@vscode/tree-sitter-wasm/wasm/${one.wasm}`)
    )
  }
})

/**
 * A file parsed by the grammar its extension names.
 *
 * The parser is freed as soon as it has parsed and the tree is kept until the
 * file is done with, because both are WebAssembly memory rather than the kind a
 * garbage collector takes back. A test that made one of each per call and freed
 * neither ran eleven grammars' worth of leak past a worker under
 * `bun test --parallel`, which is a segmentation fault rather than a failure.
 */
const held: Array<Tree> = []

const parsed = (wasm: string, text: string): Syntax => {
  const parser = new Parser()
  parser.setLanguage(languages.get(wasm)!)
  const tree = parser.parse(text)!
  parser.delete()
  held.push(tree)
  return tree.rootNode as unknown as Syntax
}

afterAll(() => {
  for (const tree of held) tree.delete()
  held.length = 0
})

/** The last place a word is written, which is the use rather than the import. */
const lastUse = (text: string, word: string): { row: number; column: number } => {
  const lines = text.split("\n")
  for (let row = lines.length - 1; row > 0; row--) {
    const column = lines[row]!.lastIndexOf(word)
    if (column !== -1) return { row, column }
  }
  throw new Error(`${word} is used nowhere but the line it arrived on`)
}

describe("a press that leaves the file it was made in", () => {
  for (const one of CASES) {
    test(`reaches the writing in ${one.language}`, () => {
      const text = one.files[one.from]!
      const dialect = dialectFor(one.from)!
      const found = writingAt(parsed(one.wasm, text), text, lastUse(text, one.press), dialect)

      // Not written here, and the file says where it came from.
      expect(found?.at).toBe("elsewhere")
      if (found?.at !== "elsewhere") return

      const paths = new Set(Object.keys(one.files))
      const candidates = [found.borrowed.specifier, ...(found.orFrom ?? [])].flatMap(
        (specifier) => reachingAll(one.from, specifier, paths, found.borrowed.name)
      )
      expect(candidates).toContain(one.wrote)

      const other = one.files[one.wrote]!
      const writing = writingNamed(
        parsed(one.wasm, other),
        other,
        found.borrowed.name,
        dialectFor(one.wrote)!
      )
      expect(writing?.line).toBe(one.at)
    })
  }
})

describe("a file that was taken whole, and named nothing it brought", () => {
  test("is where a name bound nowhere is looked for", () => {
    // `require_relative` binds no name at all, so `Second` is bound nowhere in
    // this file. What the file does say is which files it took, and the name is
    // written in one of them.
    const text = "require_relative 'one'\nrequire_relative 'two'\n\nSecond.new\n"
    const found = writingAt(
      parsed("tree-sitter-ruby.wasm", text),
      text,
      lastUse(text, "Second"),
      dialectFor("app/main.rb")!
    )

    expect(found?.at).toBe("elsewhere")
    if (found?.at !== "elsewhere") return

    // Both files are offered, in the order the file took them, because which of
    // them writes the name is not something either `require` says.
    expect(found.borrowed).toEqual({ name: "Second", specifier: "one" })
    expect(found.orFrom).toEqual(["two"])
  })

  test("a file that took nothing whole still answers nothing", () => {
    // The fallback must not turn every unknown word into a Follow. With no
    // whole-file borrow there is nowhere to point, and nowhere is the answer.
    const text = "class Main\n  def go\n    Unknown.new\n  end\nend\n"
    const found = writingAt(
      parsed("tree-sitter-ruby.wasm", text),
      text,
      lastUse(text, "Unknown"),
      dialectFor("app/main.rb")!
    )
    expect(found).toBeNull()
  })
})
