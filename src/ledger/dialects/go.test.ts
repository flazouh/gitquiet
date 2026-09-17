import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { toldBy, usesIn, writingAt, writingsIn, type Writing } from "../writings"
import { GO } from "./go"

/**
 * The Go vocabulary, against the real Go grammar.
 *
 * The cases that earn their place are the ones Go spells its own way: a
 * declaration that wraps its names in a `_spec`, a method written outside the
 * type it belongs to, and a receiver that is a parameter list holding one
 * parameter. The rest of the scoping is TypeScript's, and is tested here anyway
 * because sharing a rule is not the same as sharing a node type.
 */

const SOURCE = await Bun.file("fixtures/code/shadowing.go").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-go.wasm"
  )
  const parser = new Parser()
  parser.setLanguage(language)
  root = parser.parse(SOURCE)!.rootNode as unknown as Syntax
})

/** The one-based line a word is on, counting from the `nth` time it is written. */
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
  const found = writingAt(root, SOURCE, { row: line - 1, column }, GO)
  return found === null || found.at !== "here" ? null : found.writing.line
}

describe("a name in a Go file", () => {
  test("a call reaches the function it calls", () => {
    expect(pressed("return Area(n, b.Size)", "Area")).toBe(lineWith("func Area(shape int"))
  })

  test("a parameter is the function's own", () => {
    expect(pressed("sum := shape * scale", "shape")).toBe(lineWith("func Area(shape int"))
  })

  test("a short declaration binds, and is found from below", () => {
    expect(pressed("return sum", "sum")).toBe(lineWith("sum := shape * scale"))
  })

  test("a `for` clause holds its counter to the loop", () => {
    expect(pressed("sum += i", "i")).toBe(lineWith("for i := 0; i < 3; i++"))
  })

  test("a `range` binds both of its names", () => {
    const loop = lineWith("for k, row := range")
    expect(pressed("sum += k + row", "k")).toBe(loop)
    expect(pressed("sum += k + row", "row")).toBe(loop)
  })

  test("an `if` that declares in its header binds for its branch", () => {
    expect(pressed("return v", "v")).toBe(lineWith("if v, err := doer()"))
  })

  test("a method's receiver is a name the method can read", () => {
    expect(pressed("return Area(n, b.Size)", "b")).toBe(lineWith("func (b *Box) Draw"))
  })
})

describe("the four ways Go declares a thing", () => {
  test("a lone `const` binds its name", () => {
    expect(pressed("fmt.Println(f(1)", "Limit")).toBe(lineWith("const Limit = 10"))
  })

  test("a parenthesised `const` binds every name in the list", () => {
    expect(pressed("fmt.Println(f(1)", "First")).toBe(lineWith("First  = 1"))
    expect(pressed("fmt.Println(f(1)", "Second")).toBe(lineWith("Second = 2"))
  })

  test("a `var` binds its name", () => {
    expect(pressed("fmt.Println(f(1)", "total")).toBe(lineWith("var total int"))
  })

  test("a `type` binds its name, and it is a type", () => {
    const box = writingsIn(root, SOURCE, GO).find((writing) => writing.name === "Box")
    expect(box?.kind).toBe("type")
    expect(box?.line).toBe(lineWith("type Box struct"))
  })
})

describe("the outline of a Go file", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, GO)

  test("offers the file's functions, types, consts and vars", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).toEqual(
      expect.arrayContaining(["Area", "Box", "Shape", "Limit", "First", "total", "main"])
    )
  })

  test("offers a struct's fields and an interface's methods as members", () => {
    const members = outline().filter((writing) => writing.kind === "member")
    expect(members.map((writing) => writing.name)).toEqual(
      expect.arrayContaining(["Size", "Area", "Draw"])
    )
  })

  test("offers a method where it is written, since Go writes it outside its type", () => {
    const draw = outline().find((writing) => writing.name === "Draw")
    expect(draw?.kind).toBe("member")
    expect(draw?.line).toBe(lineWith("func (b *Box) Draw"))
  })

  test("does not offer a local or a parameter", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).not.toContain("sum")
    expect(names).not.toContain("scale")
  })
})

describe("every use of one Go name", () => {
  test("counts the writing and the calls", () => {
    const area = writingsIn(root, SOURCE, GO).find(
      (writing) => writing.name === "Area" && writing.kind === "function"
    )!
    const uses = usesIn(root, SOURCE, area, GO)
    // Written once and called once. The interface's `Area` is a member, is a
    // `field_identifier`, and is not a Name — so it is not counted, which is the
    // whole reason `field_identifier` was left out.
    expect(uses.map((use) => use.line)).toEqual([
      lineWith("func Area(shape int"),
      lineWith("return Area(n, b.Size)")
    ])
  })
})

describe("what a Go file borrowed", () => {
  test("says the path of every import", () => {
    const told = toldBy(root, SOURCE, GO)
    expect(told.borrows).toContainEqual({ name: "*", specifier: "fmt" })
    expect(told.borrows).toContainEqual({ name: "*", specifier: "math" })
  })

  test("binds an aliased import under its alias", () => {
    expect(toldBy(root, SOURCE, GO).declares).toContain("m")
  })
})
