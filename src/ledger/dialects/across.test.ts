import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser, type Tree } from "web-tree-sitter"
import { dialectFor } from "../dialects"
import { reachingAll } from "../reaching"
import type { Syntax } from "../syntax"
import { borrowedAs, toldBy, writingAt, writingNamed, type Told } from "../writings"
import { usesAcross } from "../uses"

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

/*
 * Go imports a package and uses it qualified, so the press is on the second half
 * of `shapes.Area` and the first half says which import it came through. The
 * package is a folder, and the name is in whichever of its files writes it.
 */
const GO_FILES: Readonly<Record<string, string>> = {
  "cmd/app/main.go": [
    "package main",
    "",
    "import (",
    '\t"fmt"',
    '\t"example.com/app/shapes"',
    '\tsh "example.com/app/shapes"',
    '\t"gopkg.in/yaml.v3"',
    '\t"example.com/app/codec/v2"',
    ")",
    "",
    "type Box struct{ n int }",
    "",
    "func (b Box) Draw() int { return b.n }",
    "",
    "func main() {",
    "\tvar one shapes.Box",
    "\tlocal := Box{}",
    "\tfmt.Println(shapes.Area(1), sh.Area(2), one, local.Draw())",
    "\t_ = yaml.Marshal",
    "\t_ = codec.Encode",
    "}",
    ""
  ].join("\n"),
  "shapes/area.go": "package shapes\n\nfunc Area(n int) int { return n * n }\n",
  "shapes/box.go": "package shapes\n\n// Box is a box.\ntype Box struct{ Size int }\n",
  "shapes/box_test.go": "package shapes\n\nfunc Area() {}\n",
  "codec/v2/encode.go": "package codec\n\nfunc Encode() {}\n"
}

const languages = new Map<string, Language>()

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  for (const wasm of [...CASES.map((one) => one.wasm), "tree-sitter-go.wasm", "tree-sitter-c-sharp.wasm", "tree-sitter-python.wasm", "tree-sitter-rust.wasm"]) {
    if (languages.has(wasm)) continue
    languages.set(wasm, await Language.load(`node_modules/@vscode/tree-sitter-wasm/wasm/${wasm}`))
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

describe("a Go name used through the package it came from", () => {
  const FROM = "cmd/app/main.go"
  const text = GO_FILES[FROM]!
  const paths = new Set(Object.keys(GO_FILES))

  /** The press on `word`, on the line holding `holds`, the `nth` time it is written there. */
  const press = (holds: string, word: string, nth = 0) => {
    const lines = text.split("\n")
    const row = lines.findIndex((line) => line.includes(holds))
    let column = -1
    for (let at = 0; at <= nth; at++) column = lines[row]!.indexOf(word, column + 1)
    return writingAt(parsed("tree-sitter-go.wasm", text), text, { row, column }, dialectFor(FROM)!)
  }

  /** Where a press lands, all the way to the line of the file that writes it. */
  const landing = (holds: string, word: string, nth = 0): { path: string; line: number } | null => {
    const found = press(holds, word, nth)
    if (found?.at !== "elsewhere") return null
    for (const path of reachingAll(FROM, found.borrowed.specifier, paths, found.borrowed.name)) {
      const writing = writingNamed(
        parsed("tree-sitter-go.wasm", GO_FILES[path]!),
        GO_FILES[path]!,
        found.borrowed.name,
        dialectFor(path)!
      )
      if (writing !== null) return { path, line: writing.line }
    }
    return null
  }

  test("a call reaches the function, in whichever file of the package writes it", () => {
    expect(press("fmt.Println(shapes.Area", "Area")).toEqual({
      at: "elsewhere",
      borrowed: { name: "Area", specifier: "example.com/app/shapes" }
    })
    expect(landing("fmt.Println(shapes.Area", "Area")).toEqual({ path: "shapes/area.go", line: 3 })
  })

  test("a type reaches its package's type, never the file's own of the same name", () => {
    expect(landing("var one shapes.Box", "Box")).toEqual({ path: "shapes/box.go", line: 4 })
  })

  test("an alias is the import it names", () => {
    expect(landing("sh.Area(2)", "Area", 1)).toEqual({ path: "shapes/area.go", line: 3 })
  })

  test("a package whose name is not the last part of its path is still found", () => {
    // `gopkg.in/yaml.v3` is package `yaml`, and `…/codec/v2` is package `codec`.
    expect(press("yaml.Marshal", "Marshal")).toEqual({
      at: "elsewhere",
      borrowed: { name: "Marshal", specifier: "gopkg.in/yaml.v3" }
    })
    expect(landing("codec.Encode", "Encode")).toEqual({ path: "codec/v2/encode.go", line: 3 })
  })

  test("a method on a value is not a package's name, and answers nothing", () => {
    // What `local` is takes types to know. Guessing an import would be wrong.
    expect(press("local.Draw()", "Draw")).toBeNull()
  })

  test("a use through the package is a use of the name, where the package is written", () => {
    // The other direction: from `Area` where it is written, to the lines that
    // call it. `shapes.Area` spells the name as a field, which is not a Name,
    // so nothing counted it and the panel said nobody depended on it.
    const told = new Map<string, Told>()
    for (const [path, source] of Object.entries(GO_FILES)) {
      told.set(path, toldBy(parsed("tree-sitter-go.wasm", source), source, dialectFor(path)!))
    }
    const lines = text.split("\n")
    const calls = lines.findIndex((line) => line.includes("fmt.Println(shapes.Area")) + 1

    const uses = usesAcross(told, { name: "Area", path: "shapes/area.go", line: 3 }, paths)
      .filter((use) => use.path === FROM)

    expect(uses.map((use) => [use.line, use.sure])).toEqual([
      [calls, true],
      [calls, true]
    ])
  })

  test("a method on a value is not counted as a use of a package's name", () => {
    const told = toldBy(parsed("tree-sitter-go.wasm", text), text, dialectFor(FROM)!)

    // `local` is a value, so `local.Draw()` is a question about types.
    expect(told.mentions.filter((one) => one.name === "Draw")).toEqual([])
  })

  test("a package outside the repository is said, and simply not found", () => {
    expect(press("fmt.Println", "Println")).toEqual({
      at: "elsewhere",
      borrowed: { name: "Println", specifier: "fmt" }
    })
    expect(landing("fmt.Println", "Println")).toBeNull()
  })
})

/*
 * What the review found in the other direction. A file is Sure about a name when
 * it borrows from the package that writes it, and that was decided per file: any
 * `New` read through any package in a file importing the right one was a Sure use.
 */
describe("a Go use is the package it is read through, not the file it is in", () => {
  const go = (source: string) => toldBy(parsed("tree-sitter-go.wasm", source), source, dialectFor("cmd/main.go")!)

  const usesOfNew = (main: string) => {
    const files: Record<string, string> = {
      "cmd/main.go": main,
      "store/store.go": "package store\n\nfunc New() int { return 1 }\n",
      "metrics/metrics.go": "package metrics\n\nfunc Inc() {}\n"
    }
    const told = new Map<string, Told>()
    for (const [path, source] of Object.entries(files)) told.set(path, go(source))
    return usesAcross(told, { name: "New", path: "store/store.go", line: 3 }, new Set(Object.keys(files)))
      .filter((use) => use.path === "cmd/main.go")
      .map((use) => use.line)
  }

  test("another package's name of the same spelling is not a use", () => {
    const main = 'package main\n\nimport (\n\t"errors"\n\t"example.com/app/store"\n)\n\nfunc main() {\n\t_ = errors.New("x")\n\t_ = store.New()\n}\n'
    expect(usesOfNew(main)).toEqual([10])
  })

  test("a value named like the package is not the package", () => {
    const main = 'package main\n\nimport "example.com/app/store"\n\nfunc main() {\n\tfor _, store := range stores {\n\t\t_ = store.New()\n\t}\n\t_ = store.New()\n}\n'
    expect(usesOfNew(main)).toEqual([9])
  })

  test("a blank or aliased import does not lend its package's name to the file", () => {
    // `_` brings in nothing a file can write, and an alias replaces the name, so
    // `metrics` here can only be something of this package's own.
    const main = 'package main\n\nimport (\n\t_ "example.com/app/metrics"\n\tm "example.com/app/store"\n)\n\nfunc main() {\n\tmetrics.Inc()\n\tstore.New()\n}\n'
    const text = main
    const lines = text.split("\n")
    const at = (holds: string, word: string) => {
      const row = lines.findIndex((line) => line.includes(holds))
      return { row, column: lines[row]!.indexOf(word) }
    }
    const root = parsed("tree-sitter-go.wasm", text)
    expect(writingAt(root, text, at("metrics.Inc", "Inc"), dialectFor("cmd/main.go")!)).toBeNull()
    expect(writingAt(root, text, at("store.New", "New"), dialectFor("cmd/main.go")!)).toBeNull()
  })
})

/*
 * Found pressing `ForeachAwaitPublisher` in MediatR: nothing. Almost every C# file
 * brings its types in with a plain `using Some.Namespace;`, which names none of
 * them, and uses its own namespace's types from the files beside it. Both are a
 * namespace taken whole, and C# writes one type to a file named after it.
 */
describe("a C# type from a namespace the file opened", () => {
  const FILES: Readonly<Record<string, string>> = {
    "src/MediatR/Mediator.cs": [
      "using System;",
      "using MediatR.NotificationPublishers;",
      "",
      "namespace MediatR;",
      "",
      "public class Mediator",
      "{",
      "    public void Go()",
      "    {",
      "        var publisher = new ForeachAwaitPublisher();",
      "        var wrapper = new RequestHandlerWrapper();",
      "        publisher.Publish();",
      "    }",
      "}",
      ""
    ].join("\n"),
    "src/MediatR/NotificationPublishers/ForeachAwaitPublisher.cs":
      "namespace MediatR.NotificationPublishers;\n\npublic class ForeachAwaitPublisher\n{\n    public void Publish() {}\n}\n",
    "src/MediatR/RequestHandlerWrapper.cs": "namespace MediatR;\n\npublic class RequestHandlerWrapper\n{\n}\n"
  }
  const FROM = "src/MediatR/Mediator.cs"
  const paths = new Set(Object.keys(FILES))

  const landing = (holds: string, word: string): { path: string; line: number } | null => {
    const text = FILES[FROM]!
    const lines = text.split("\n")
    const row = lines.findIndex((line) => line.includes(holds))
    const found = writingAt(parsed("tree-sitter-c-sharp.wasm", text), text, { row, column: lines[row]!.indexOf(word) }, dialectFor(FROM)!)
    if (found?.at !== "elsewhere") return null
    for (const specifier of [found.borrowed.specifier, ...(found.orFrom ?? [])]) {
      for (const path of reachingAll(FROM, specifier, paths, found.borrowed.name)) {
        const other = FILES[path]!
        const writing = writingNamed(parsed("tree-sitter-c-sharp.wasm", other), other, found.borrowed.name, dialectFor(path)!)
        if (writing !== null) return { path, line: writing.line }
      }
    }
    return null
  }

  test("a type from a namespace a plain using opened", () => {
    expect(landing("new ForeachAwaitPublisher()", "ForeachAwaitPublisher")).toEqual({
      path: "src/MediatR/NotificationPublishers/ForeachAwaitPublisher.cs",
      line: 3
    })
  })

  test("a type of the file's own namespace, written beside it", () => {
    expect(landing("new RequestHandlerWrapper()", "RequestHandlerWrapper")).toEqual({
      path: "src/MediatR/RequestHandlerWrapper.cs",
      line: 3
    })
  })

  test("a member reached through a value answers nothing", () => {
    expect(landing("publisher.Publish()", "Publish")).toBeNull()
  })
})

/*
 * From review: Guava keeps its sources twice, for the JVM and for Android. Every
 * importer of one copy could also reach the other, and was counted a Sure use of
 * both. An import that names a file names one file: the one it reaches first.
 */
describe("a Java class kept in two copies", () => {
  const FILES: Readonly<Record<string, string>> = {
    "guava/src/com/ex/Box.java": "package com.ex;\npublic class Box {}\n",
    "android/guava/src/com/ex/Box.java": "package com.ex;\npublic class Box {}\n",
    "guava/src/com/ex/app/Main.java": "package com.ex.app;\nimport com.ex.Box;\nclass Main { Box box; }\n"
  }

  const usesOf = (path: string) => {
    const told = new Map<string, Told>()
    for (const [one, source] of Object.entries(FILES)) {
      told.set(one, toldBy(parsed("tree-sitter-java.wasm", source), source, dialectFor(one)!))
    }
    return usesAcross(told, { name: "Box", path, line: 2 }, new Set(Object.keys(FILES)))
      .filter((use) => use.path === "guava/src/com/ex/app/Main.java")
      .map((use) => use.sure)
  }

  test("an importer is a Sure use of the copy it reaches", () => {
    expect(usesOf("guava/src/com/ex/Box.java")).toContain(true)
  })

  test("and not of the other copy", () => {
    expect(usesOf("android/guava/src/com/ex/Box.java")).not.toContain(true)
  })
})

/*
 * Found pressing `Model` in `class Site(models.Model)`: nothing. Python reads a
 * module's names through the module as often as it imports them: `from
 * django.db import models`, then `models.Model`. And `models` is a package whose
 * `__init__.py` writes none of it, but brings `Model` in from `base.py` for its
 * importers — so the press has to follow that too.
 */
describe("a Python name read through the module it is in", () => {
  const FILES: Readonly<Record<string, string>> = {
    "django/contrib/sites/models.py": "from django.db import models\nimport os.path\n\n\nclass Site(models.Model):\n    name = os.path.join('a', 'b')\n    other = models.Local\n",
    "django/db/models/__init__.py": "from django.db.models.base import Model\n\n__all__ = ['Model']\n",
    "django/db/models/base.py": "class Model:\n    pass\n"
  }
  const FROM = "django/contrib/sites/models.py"
  const paths = new Set(Object.keys(FILES))

  const press = (holds: string, word: string) => {
    const text = FILES[FROM]!
    const lines = text.split("\n")
    const row = lines.findIndex((line) => line.includes(holds))
    return writingAt(parsed("tree-sitter-python.wasm", text), text, { row, column: lines[row]!.indexOf(word) }, dialectFor(FROM)!)
  }

  /** A press followed through whatever files pass the name on, three at most. */
  const landing = (holds: string, word: string): { path: string; line: number } | null => {
    const found = press(holds, word)
    if (found?.at !== "elsewhere") return null
    let asked = [{ from: FROM, borrowed: found.borrowed }]
    for (let hop = 0; hop < 3; hop++) {
      const next: typeof asked = []
      for (const { from, borrowed } of asked) {
        for (const path of reachingAll(from, borrowed.specifier, paths, borrowed.name)) {
          const text = FILES[path]!
          const root = parsed("tree-sitter-python.wasm", text)
          const writing = writingNamed(root, text, borrowed.name, dialectFor(path)!)
          if (writing !== null) return { path, line: writing.line }
          const passed = borrowedAs(root, borrowed.name, dialectFor(path)!)
          if (passed !== null) next.push({ from: path, borrowed: passed.borrowed })
        }
      }
      asked = next
    }
    return null
  }

  test("says the module the name was read through", () => {
    expect(press("class Site(models.Model)", "Model")).toEqual({
      at: "elsewhere",
      borrowed: { name: "Model", specifier: "django.db.models" }
    })
  })

  test("follows the package's own import to where the name is written", () => {
    expect(landing("class Site(models.Model)", "Model")).toEqual({ path: "django/db/models/base.py", line: 1 })
  })

  test("a plain import names the first module, as the file can write it", () => {
    expect(press("os.path.join", "path")).toEqual({
      at: "elsewhere",
      borrowed: { name: "path", specifier: "os" }
    })
  })
})

describe("a Python attribute read through a value", () => {
  const TEXT = "class Box:\n    def helper(self):\n        return 1\n\n    def run(self):\n        return self.helper()\n"

  test("still reaches the method the class writes", () => {
    const lines = TEXT.split("\n")
    const row = lines.findIndex((line) => line.includes("self.helper()"))
    const found = writingAt(parsed("tree-sitter-python.wasm", TEXT), TEXT, { row, column: lines[row]!.indexOf("helper") }, dialectFor("box.py")!)

    expect(found?.at === "here" ? found.writing.line : null).toBe(2)
  })

  test("still counts as a mention of that name", () => {
    const told = toldBy(parsed("tree-sitter-python.wasm", TEXT), TEXT, dialectFor("box.py")!)

    expect(told.mentions.filter((one) => one.name === "helper").map((one) => one.line)).toEqual([2, 6])
  })
})

/*
 * Found pressing `Connection` in Faraday: nothing. A gem requires its own files
 * with a plain `require 'faraday/connection'`, which Ruby finds on the load path,
 * and the load path is the gem's `lib`. Only `require_relative` was followed.
 */
describe("a Ruby constant from a file a plain require loaded", () => {
  const FILES: Readonly<Record<string, string>> = {
    "lib/faraday.rb": "require 'json'\nrequire 'faraday/connection'\n\nmodule Faraday\n  def self.go\n    Connection.new\n  end\nend\n",
    "lib/faraday/connection.rb": "module Faraday\n  class Connection\n  end\nend\n",
    "gems/other/lib/other/thing.rb": "module Other\n  class Thing\n  end\nend\n",
    "gems/other/lib/other.rb": "require 'other/thing'\n\nOther::Thing\nThing.new\n"
  }
  const paths = new Set(Object.keys(FILES))

  const landing = (from: string, word: string): { path: string; line: number } | null => {
    const text = FILES[from]!
    const lines = text.split("\n")
    const row = lines.findLastIndex((line) => line.includes(word))
    const found = writingAt(parsed("tree-sitter-ruby.wasm", text), text, { row, column: lines[row]!.lastIndexOf(word) }, dialectFor(from)!)
    if (found?.at !== "elsewhere") return null
    for (const specifier of [found.borrowed.specifier, ...(found.orFrom ?? [])]) {
      for (const path of reachingAll(from, specifier, paths, found.borrowed.name)) {
        const other = FILES[path]!
        const writing = writingNamed(parsed("tree-sitter-ruby.wasm", other), other, found.borrowed.name, dialectFor(path)!)
        if (writing !== null) return { path, line: writing.line }
      }
    }
    return null
  }

  test("is found under the gem's lib", () => {
    expect(landing("lib/faraday.rb", "Connection")).toEqual({ path: "lib/faraday/connection.rb", line: 2 })
  })

  test("and under the lib of a gem kept in a folder of the repository", () => {
    expect(landing("gems/other/lib/other.rb", "Thing")).toEqual({ path: "gems/other/lib/other/thing.rb", line: 2 })
  })

  test("a require of another gem reaches no file", () => {
    expect(reachingAll("lib/faraday.rb", "json", paths)).toEqual([])
  })
})

/*
 * From review of 6c4e9d3. A file that does not write a name may pass it on, and
 * a press goes on from there — but only a real re-export passes a name on. A Go
 * file's imports do not: `shapes/a.go` importing `other` does not hand
 * `other.Box` to anybody pressing `shapes.Box`.
 */
describe("what a file passes on, and what it only took", () => {
  test("a Go file's imports pass nothing on", () => {
    const text = 'package shapes\n\nimport "example.com/app/other"\n\nfunc f() { other.Do() }\n'
    expect(borrowedAs(parsed("tree-sitter-go.wasm", text), "Box", dialectFor("shapes/a.go")!)).toBeNull()
  })

  test("a Python package's star import passes its names on", () => {
    const text = "from .base import *\n"
    expect(borrowedAs(parsed("tree-sitter-python.wasm", text), "Model", dialectFor("db/models/__init__.py")!)).toEqual({
      borrowed: { name: "Model", specifier: ".base" }
    })
  })

  test("a Python use through a package's module is a Sure use, through the package", () => {
    const FILES: Record<string, string> = {
      "app/sites.py": "from db import models\n\n\nclass Site(models.Model):\n    pass\n",
      "db/models/__init__.py": "from db.models.base import Model\n",
      "db/models/base.py": "class Model:\n    pass\n",
      "db/__init__.py": ""
    }
    const told = new Map<string, Told>()
    for (const [path, source] of Object.entries(FILES)) told.set(path, toldBy(parsed("tree-sitter-python.wasm", source), source, dialectFor(path)!))

    const uses = usesAcross(told, { name: "Model", path: "db/models/base.py", line: 1 }, new Set(Object.keys(FILES)))
    expect(uses.filter((use) => use.path === "app/sites.py").map((use) => [use.line, use.sure])).toEqual([[4, true]])
  })

  test("a Python attribute of an imported class is still a use, if not a proven one", () => {
    const FILES: Record<string, string> = {
      "app/views.py": "from app.models import Status\n\nx = Status.ACTIVE\n",
      "app/models.py": "class Status:\n    ACTIVE = 1\n"
    }
    const told = new Map<string, Told>()
    for (const [path, source] of Object.entries(FILES)) told.set(path, toldBy(parsed("tree-sitter-python.wasm", source), source, dialectFor(path)!))

    const uses = usesAcross(told, { name: "ACTIVE", path: "app/models.py", line: 2 }, new Set(Object.keys(FILES)))
    expect(uses.filter((use) => use.path === "app/views.py").map((use) => use.line)).toEqual([3])
  })
})

describe("a Rust name a module hands on with pub use", () => {
  const FILES: Readonly<Record<string, string>> = {
    "crates/core/main.rs": "mod flags;\n\nuse crate::flags::{HiArgs, SearchMode};\n\nfn search(args: &HiArgs) {}\n",
    "crates/core/flags/mod.rs": "pub(crate) use crate::flags::{\n    hiargs::HiArgs,\n    parse::SearchMode,\n};\n\nmod hiargs;\nmod parse;\n",
    "crates/core/flags/hiargs.rs": "pub(crate) struct HiArgs {\n    x: u8,\n}\n"
  }
  const paths = new Set(Object.keys(FILES))

  test("is followed to the file that writes it", () => {
    const from = "crates/core/main.rs"
    const text = FILES[from]!
    const lines = text.split("\n")
    const row = lines.findIndex((line) => line.includes("fn search"))
    const found = writingAt(parsed("tree-sitter-rust.wasm", text), text, { row, column: lines[row]!.indexOf("HiArgs") }, dialectFor(from)!)
    expect(found?.at).toBe("elsewhere")
    if (found?.at !== "elsewhere") return

    const [barrel] = reachingAll(from, found.borrowed.specifier, paths, found.borrowed.name)
    expect(barrel).toBe("crates/core/flags/mod.rs")
    const passed = borrowedAs(parsed("tree-sitter-rust.wasm", FILES[barrel!]!), "HiArgs", dialectFor(barrel!)!)
    expect(passed?.borrowed).toEqual({ name: "HiArgs", specifier: "crate::flags::hiargs" })

    const [written] = reachingAll(barrel!, passed!.borrowed.specifier, paths, "HiArgs")
    const other = FILES[written!]!
    expect(writingNamed(parsed("tree-sitter-rust.wasm", other), other, "HiArgs", dialectFor(written!)!)?.line).toBe(1)
  })
})
