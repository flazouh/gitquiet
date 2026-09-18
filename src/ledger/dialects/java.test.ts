import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { toldBy, usesIn, writingAt, writingsIn, type Writing } from "../writings"
import { JAVA } from "./java"

/**
 * The Java vocabulary, against the real Java grammar.
 *
 * The case that earns its place, and the reason this file is not a translation
 * of another, is the bare call: Java reaches its own methods and fields with no
 * receiver, so a method's name is a Name and resolves like a local. Every other
 * vocabulary here keeps its member node type out of the Names for the opposite
 * reason, and getting this one backwards means a `risky()` that answers nothing
 * in the language where it is most often written.
 */

const SOURCE = await Bun.file("fixtures/code/Shadowing.java").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-java.wasm"
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
  const found = writingAt(root, SOURCE, { row: line - 1, column }, JAVA)
  return found === null || found.at !== "here" ? null : found.writing.line
}

describe("what Java does that no other language here does", () => {
  test("a bare call reaches the method of the class it is in", () => {
    expect(pressed("total += risky()", "risky")).toBe(lineWith("private int risky()"))
  })

  test("a bare name reaches the field of the class it is in", () => {
    expect(pressed("int total = n * size", "size")).toBe(lineWith("private int size"))
  })

  test("a bare name reaches a static field too", () => {
    expect(pressed("private int risky() { return LIMIT; }", "LIMIT")).toBe(
      lineWith("static final int LIMIT")
    )
  })

  test("a parameter still shadows the field it shares a name with", () => {
    // `Box(int size)` takes a `size`, and inside the constructor that is the one
    // a bare `size` means. `this.size` is the field and is reached through
    // `this`, which is not a bare name at all.
    expect(pressed("this.size = size;", "size", 14)).toBe(lineWith("public Box(int size)"))
  })
})

describe("a name in a Java file", () => {
  test("a local is found from below", () => {
    expect(pressed("return total;", "total")).toBe(lineWith("int total = n * size"))
  })

  test("a `for` holds its counter to the loop", () => {
    // The whole loop is on one line, so the press is on the `i` in `+= i`.
    const loop = lineWith("for (int i = 0")
    expect(pressed("for (int i = 0", "i", lines[loop - 1]!.indexOf("+= i") + 3)).toBe(loop)
  })

  test("an enhanced `for` binds the name in its header", () => {
    expect(pressed("total += row.length()", "row")).toBe(lineWith("for (String row : rows())"))
  })

  test("a `catch` binds what it caught", () => {
    const caught = lineWith("catch (Exception err)")
    const found = writingAt(
      root,
      SOURCE,
      { row: caught - 1, column: lines[caught - 1]!.indexOf("err") },
      JAVA
    )
    expect(found?.at).toBe("here")
  })

  test("a generic parameter is the method's own name for a type", () => {
    expect(pressed("T pick(T one, T two)", "T", 25)).toBe(lineWith("T pick(T one"))
  })
})

describe("the outline of a Java file", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, JAVA)

  test("offers the class", () => {
    const box = outline().find((writing) => writing.name === "Box" && writing.kind === "class")
    expect(box?.line).toBe(lineWith("public class Box"))
  })

  test("offers its methods, fields and constructor as members", () => {
    const members = outline().filter((writing) => writing.kind === "member")
    expect(members.map((writing) => writing.name)).toEqual(
      expect.arrayContaining(["size", "LIMIT", "Box", "draw", "pick", "risky", "rows"])
    )
  })

  test("offers a nested interface and enum by name", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).toContain("Shape")
    expect(names).toContain("Kind")
  })

  test("does not offer a local or a parameter", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).not.toContain("total")
    expect(names).not.toContain("n")
  })
})

describe("what a Java file borrowed", () => {
  test("binds the last segment of an import", () => {
    const told = toldBy(root, SOURCE, JAVA)
    expect(told.declares).toContain("List")
    expect(told.declares).toContain("Entry")
  })

  test("says where each name came from", () => {
    const told = toldBy(root, SOURCE, JAVA)
    expect(told.borrows).toContainEqual({ name: "List", specifier: "java.util" })
    expect(told.borrows).toContainEqual({ name: "Entry", specifier: "java.util.Map" })
  })

  test("a static import is a name like any other", () => {
    expect(toldBy(root, SOURCE, JAVA).declares).toContain("max")
  })
})

describe("every use of one Java name", () => {
  test("counts the writing and the bare call", () => {
    const risky = writingsIn(root, SOURCE, JAVA).find((writing) => writing.name === "risky")!
    const uses = usesIn(root, SOURCE, risky, JAVA).map((use) => use.line)
    expect(uses).toContain(lineWith("private int risky()"))
    expect(uses).toContain(lineWith("total += risky()"))
  })
})
