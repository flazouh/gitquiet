import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { toldBy, usesIn, writingAt, writingsIn, type Writing } from "../writings"
import { RUST } from "./rust"

/**
 * The Rust vocabulary, against the real Rust grammar.
 *
 * The cases that earn their place are the four places Rust binds through a
 * pattern rather than through a declaration — a `for`, an `if let`, a `match`
 * arm and a closure — because each opens a scope a reader can see the edge of,
 * and a vocabulary that missed one would answer a name inside it with whatever
 * the file declared outside.
 */

const SOURCE = await Bun.file("fixtures/code/shadowing.rs").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-rust.wasm"
  )
  const parser = new Parser()
  parser.setLanguage(language)
  root = parser.parse(SOURCE)!.rootNode as unknown as Syntax
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
  const found = writingAt(root, SOURCE, { row: line - 1, column }, RUST)
  return found === null || found.at !== "here" ? null : found.writing.line
}

describe("a name in a Rust file", () => {
  test("a call reaches the function it calls", () => {
    expect(pressed("area(n) + self.size", "area")).toBe(lineWith("fn area(shape: i32)"))
  })

  test("a parameter is the function's own", () => {
    expect(pressed("let total = shape * 2", "shape")).toBe(lineWith("fn area(shape: i32)"))
  })

  test("a `let` binds, and is found from below", () => {
    expect(pressed("let mut sum = total", "total")).toBe(lineWith("let total = shape * 2"))
  })
})

describe("the four places Rust binds through a pattern", () => {
  test("a `for` holds its name to the loop", () => {
    expect(pressed("sum += row", "row")).toBe(lineWith("for row in 0..3"))
  })

  test("an `if let` binds for its branch", () => {
    expect(pressed("sum += found", "found")).toBe(lineWith("if let Some(found) = maybe()"))
  })

  test("a `match` arm binds what its pattern names", () => {
    expect(pressed("picked => sum + picked", "picked", 10)).toBe(lineWith("picked => sum + picked"))
  })

  test("a closure binds its parameters", () => {
    expect(pressed("let _ = doubled(LIMIT)", "doubled")).toBe(lineWith("let doubled = |z: i32|"))
  })

  test("a const generic binds, and so does a bounded type parameter", () => {
    // `const N: usize` is a `const_parameter` and was missed entirely, and
    // `T: Clone` is a `type_parameter` with a `trait_bounds` child rather than
    // the `constrained_type_parameter` the code used to look for — which is not
    // a node type in this grammar at all.
    const told = toldBy(root, SOURCE, RUST)
    expect(told.declares).toContain("SIDES")
    expect(told.declares).toContain("T")
  })

  test("a generic parameter is the function's own name for a type", () => {
    expect(pressed("fn generic<T: Clone>(item: T)", "T", 20)).toBe(
      lineWith("fn generic<T: Clone>")
    )
  })
})

describe("the outline of a Rust file", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, RUST)

  test("offers the file's functions, types and consts", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).toEqual(
      expect.arrayContaining(["area", "generic", "main", "Box", "Shape", "Drawable", "LIMIT"])
    )
  })

  test("names a struct, an enum and a trait each a type", () => {
    const kinds = new Map(outline().map((writing) => [writing.name, writing.kind]))
    expect(kinds.get("Box")).toBe("type")
    expect(kinds.get("Shape")).toBe("type")
    expect(kinds.get("Drawable")).toBe("type")
  })

  test("offers a struct's fields and an enum's variants as members", () => {
    const members = outline().filter((writing) => writing.kind === "member")
    expect(members.map((writing) => writing.name)).toEqual(
      expect.arrayContaining(["size", "Round", "Square"])
    )
  })

  test("offers an `impl` block's functions, which is where a method lives", () => {
    const draw = outline().find((writing) => writing.name === "draw")
    expect(draw?.kind).toBe("member")
    expect(draw?.line).toBe(lineWith("fn draw(&self, n: i32)"))
  })

  test("does not offer a local, a parameter or a closure's name for its argument", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).not.toContain("sum")
    expect(names).not.toContain("item")
    expect(names).not.toContain("z")
  })
})

describe("every use of one Rust name", () => {
  test("counts the writing and the calls", () => {
    const area = writingsIn(root, SOURCE, RUST).find(
      (writing) => writing.name === "area" && writing.kind === "function"
    )!
    const uses = usesIn(root, SOURCE, area, RUST).map((use) => use.line)
    // Written once, called from `draw` and from `main`. The trait's `area` is a
    // member and is not counted, which is the rule this shares with Go.
    expect(uses).toContain(lineWith("fn area(shape: i32)"))
    expect(uses).toContain(lineWith("area(n) + self.size"))
    expect(uses).toContain(lineWith("let _ = doubled(LIMIT)"))
  })
})

describe("what a Rust file borrowed", () => {
  test("splits a path into the name and where it came from", () => {
    const told = toldBy(root, SOURCE, RUST)
    expect(told.borrows).toContainEqual({ name: "HashMap", specifier: "std::collections" })
  })

  test("an alias binds, and keeps the name the other module writes", () => {
    const told = toldBy(root, SOURCE, RUST)
    expect(told.declares).toContain("Reader")
    expect(told.borrows).toContainEqual({ name: "Read", specifier: "std::io" })
  })
})
