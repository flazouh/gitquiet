import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser, type Tree } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { usesIn, writingsIn, type Dialect } from "../writings"
import { CPP } from "./cpp"
import { CSHARP } from "./csharp"
import { GO } from "./go"
import { JAVA } from "./java"
import { PHP } from "./php"
import { PYTHON } from "./python"
import { RUBY } from "./ruby"
import { RUST } from "./rust"
import { TYPESCRIPT } from "./typescript"

/**
 * The sentence above a Writing, in every language, and what a reader is shown.
 *
 * One test file rather than a case in each, because the thing being checked is
 * the same in all ten and the way it broke was the same too: the walk asked for
 * a node type called `comment`, which two of these grammars do not have. Rust
 * writes `line_comment`, `block_comment` and `doc_comment`; Java writes the
 * first two. Both had a `doc` of `null` on every card and nothing said so.
 *
 * Rust is also why the row is counted the way it is. Its `line_comment` takes
 * the newline that ends it into its own text, so a `///` written directly above
 * a function ends on the function's own row — and looking one row up found
 * nothing at all.
 */

type Case = {
  readonly language: string
  readonly wasm: string
  readonly dialect: Dialect
  /** A comment above a declaration, and the words a reader should be shown. */
  readonly source: string
  readonly name: string
  readonly doc: string
}

const CASES: ReadonlyArray<Case> = [
  {
    language: "typescript",
    wasm: "tree-sitter-typescript.wasm",
    dialect: TYPESCRIPT,
    source: "/** What it is for. */\nexport const one = 1\n",
    name: "one",
    doc: "What it is for."
  },
  {
    language: "python",
    wasm: "tree-sitter-python.wasm",
    dialect: PYTHON,
    source: "# What it is for.\ndef one():\n    return 1\n",
    name: "one",
    doc: "What it is for."
  },
  {
    language: "go",
    wasm: "tree-sitter-go.wasm",
    dialect: GO,
    source: "package main\n\n// What it is for.\nfunc One() int { return 1 }\n",
    name: "One",
    doc: "What it is for."
  },
  {
    language: "rust",
    wasm: "tree-sitter-rust.wasm",
    dialect: RUST,
    source: "/// What it is for.\nfn one() -> i32 { 1 }\n",
    name: "one",
    doc: "What it is for."
  },
  {
    language: "java",
    wasm: "tree-sitter-java.wasm",
    dialect: JAVA,
    source: "/** What it is for. */\nclass One { }\n",
    name: "One",
    doc: "What it is for."
  },
  {
    language: "ruby",
    wasm: "tree-sitter-ruby.wasm",
    dialect: RUBY,
    source: "# What it is for.\ndef one\n  1\nend\n",
    name: "one",
    doc: "What it is for."
  },
  {
    language: "php",
    wasm: "tree-sitter-php.wasm",
    dialect: PHP,
    source: "<?php\n// What it is for.\nfunction one() { return 1; }\n",
    name: "one",
    doc: "What it is for."
  },
  {
    language: "c#",
    wasm: "tree-sitter-c-sharp.wasm",
    dialect: CSHARP,
    source: "// What it is for.\nclass One { }\n",
    name: "One",
    doc: "What it is for."
  },
  {
    language: "c++",
    wasm: "tree-sitter-cpp.wasm",
    dialect: CPP,
    source: "// What it is for.\nint one() { return 1; }\n",
    name: "one",
    doc: "What it is for."
  }
]

const parsed = new Map<string, Syntax>()
const held: Array<Tree> = []

afterAll(() => {
  for (const tree of held) tree.delete()
  held.length = 0
})

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  for (const one of CASES) {
    const language = await Language.load(`node_modules/@vscode/tree-sitter-wasm/wasm/${one.wasm}`)
    const parser = new Parser()
    parser.setLanguage(language)
    const tree = parser.parse(one.source)!
    // Both are WebAssembly memory. The parser has done its work; the tree is
    // what the nodes belong to and is freed when the file is done with.
    parser.delete()
    held.push(tree)
    parsed.set(one.language, tree.rootNode as unknown as Syntax)
  }
})

describe("the sentence written above a thing", () => {
  for (const one of CASES) {
    test(`reaches the card in ${one.language}`, () => {
      const root = parsed.get(one.language)!
      const writing = writingsIn(root, one.source, one.dialect).find(
        (found) => found.name === one.name
      )
      expect(writing).toBeDefined()
      expect(writing?.doc).toBe(one.doc)
    })
  }
})

describe("what every use of a name costs", () => {
  /**
   * A guard against the second quadratic, which is not the one `writingsIn` had.
   *
   * `found` used to gather the file's comments on every answer it gave, and
   * `usesIn` calls `found` once per mention of the name — so counting the uses of
   * a name walked the whole tree once per use. Measured on the shape below:
   * 7.1ms at twenty uses, 12.2ms at forty, 35.6ms at eighty, which is about four
   * times the work for twice the uses.
   *
   * With the comments gathered once for the whole sweep it is under 2ms at
   * eighty. The budget is generous for the reason every other one here is: this
   * runs under `bun test --parallel`, and anything quadratic misses it by orders
   * of magnitude rather than by a little.
   */
  test("grows with the uses, not with the uses times the file", async () => {
    const language = await Language.load(
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm"
    )
    const parser = new Parser()
    parser.setLanguage(language)

    const uses = Array.from({ length: 400 }, (_, at) => `const u${at} = target + ${at}`).join("\n")
    const source = `const target = 1\n${uses}\n`
    const tree = parser.parse(source)!
    const root = tree.rootNode as unknown as Syntax

    const target = writingsIn(root, source, TYPESCRIPT).find((one) => one.name === "target")!

    const started = performance.now()
    const found = usesIn(root, source, target, TYPESCRIPT)
    const took = performance.now() - started

    tree.delete()
    parser.delete()

    // Written once and read four hundred times.
    expect(found).toHaveLength(401)
    expect(took).toBeLessThan(1_500)
  })
})
