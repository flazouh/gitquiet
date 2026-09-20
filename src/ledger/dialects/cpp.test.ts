import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { toldBy, usesIn, writingAt, writingsIn, type Writing } from "../writings"
import { CPP } from "./cpp"

/**
 * The C++ vocabulary, against the real C++ grammar.
 *
 * What earns this file is the declarator. A name is not a child of the thing
 * that declares it — it sits at the bottom of a stack of wrappers saying what it
 * is — so every case here is a shape that puts something between a declaration
 * and the name inside it.
 *
 * And the pair that makes a member work: a field is bound, and
 * `field_identifier` is not a Name. A bare `size_` in a method resolves through
 * the binding; `other.size_` answers nothing, because what `other` is takes types
 * to know.
 */

const SOURCE = await Bun.file("fixtures/code/shadowing.cpp").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-cpp.wasm"
  )
  const parser = new Parser()
  parser.setLanguage(language)
  // Parsed once, and the parser freed the moment it has done its work: it is
  // WebAssembly memory rather than the kind a garbage collector takes back, and
  // eleven grammars' worth of it held across `bun test --parallel` workers is a
  // segmentation fault rather than a failure. The tree stays, because the nodes
  // every test below reads belong to it.
  const tree = parser.parse(SOURCE)!
  parser.delete()
  root = tree.rootNode as unknown as Syntax
})

/** The one-based line that holds a piece of text. */
const lineWith = (holds: string): number => {
  const at = lines.findIndex((line) => line.includes(holds))
  if (at === -1) throw new Error(`no line holds ${holds}`)
  return at + 1
}

/** Where a press lands, given the line to press on and the word to press. */
const pressed = (holds: string, word: string, from = 0): number | null => {
  const line = lineWith(holds)
  const column = lines[line - 1]!.indexOf(word, from)
  if (column === -1) throw new Error(`${word} is not on the line holding ${holds}`)
  const found = writingAt(root, SOURCE, { row: line - 1, column }, CPP)
  return found === null || found.at !== "here" ? null : found.writing.line
}

describe("a name at the bottom of a declarator", () => {
  test("a function's name is reached through its declarator", () => {
    expect(pressed("total += risky()", "risky")).toBe(lineWith("int risky()"))
  })

  test("a local declared with an initialiser binds", () => {
    expect(pressed("return total + doubled", "total")).toBe(lineWith("int total = shape * scale"))
  })

  test("a parameter is the function's own", () => {
    expect(pressed("int total = shape * scale", "shape", 12)).toBe(
      lineWith("int area(int shape, int scale)")
    )
  })

  test("a template parameter is a name for a type", () => {
    expect(pressed("template <typename T> T pick", "T", 22)).toBe(
      lineWith("template <typename T> T pick")
    )
  })

  test("an alias declaration names a type", () => {
    const widget = writingsIn(root, SOURCE, CPP).find((writing) => writing.name === "Widget")
    expect(widget?.kind).toBe("type")
  })
})

describe("a member, bound without being a Name", () => {
  test("a bare field inside a method resolves", () => {
    // `size_` in `draw` is written as an `identifier` and reaches the field.
    expect(pressed("return area(n, size_)", "size_")).toBe(lineWith("int size_;"))
  })

  test("a method reaches a function written outside its class", () => {
    expect(pressed("return area(n, size_)", "area")).toBe(lineWith("int area(int shape"))
  })
})

describe("the loops and what they hold", () => {
  test("a `for` holds its counter to the loop", () => {
    const loop = lineWith("total += i;")
    const body = lines[loop - 1]!.indexOf("+= i") + 3
    expect(pressed("total += i;", "i", body)).toBe(loop)
  })

  test("a range `for` binds the name in its header", () => {
    expect(pressed("total += row", "row")).toBe(lineWith("for (auto row : rows())"))
  })
})

describe("the outline of a C++ file", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, CPP)

  test("offers the file's functions, classes and constants", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).toEqual(expect.arrayContaining(["area", "risky", "Box", "Point", "LIMIT"]))
  })

  test("names a class and a struct a class, and an enum a type", () => {
    const named = (name: string, kind: string): Writing | undefined =>
      outline().find((writing) => writing.name === name && writing.kind === kind)
    expect(named("Box", "class")).toBeDefined()
    expect(named("Point", "class")).toBeDefined()
    expect(named("Kind", "type")).toBeDefined()
  })

  test("offers a class's fields and methods, and a struct's fields, as members", () => {
    const members = outline().filter((writing) => writing.kind === "member")
    expect(members.map((writing) => writing.name)).toEqual(
      expect.arrayContaining(["size_", "draw", "x", "y"])
    )
  })

  test("does not offer a local or a parameter", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).not.toContain("total")
    expect(names).not.toContain("scale")
  })
})

describe("what a C++ file included", () => {
  test("says the path of a quoted include, which names this repository", () => {
    expect(toldBy(root, SOURCE, CPP).borrows).toContainEqual({
      name: "*",
      specifier: "local/helper.h"
    })
  })

  test("does not claim an angled include is a file in this repository", () => {
    // `#include <vector>` is the compiler's own search path, which is not here.
    const said = toldBy(root, SOURCE, CPP).borrows.map((one) => one.specifier)
    expect(said).not.toContain("vector")
  })
})

describe("every use of one C++ name", () => {
  test("counts the writing and both calls", () => {
    const area = writingsIn(root, SOURCE, CPP).find(
      (writing) => writing.name === "area" && writing.kind === "function"
    )!
    const uses = usesIn(root, SOURCE, area, CPP).map((use) => use.line)
    expect(uses).toContain(lineWith("int area(int shape"))
    expect(uses).toContain(lineWith("return area(n, size_)"))
  })
})
