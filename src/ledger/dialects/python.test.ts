import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { toldBy, usesIn, writingAt, writingsIn, type Found, type Writing } from "../writings"
import { PYTHON } from "./python"

/**
 * The Python vocabulary, against the real Python grammar.
 *
 * The same shape as `writings.test.ts` and for the same reason: a tree built by
 * hand to suit the resolver would agree with it about a grammar neither of them
 * had met. Every case here is a thing a reader does to a file somebody wrote.
 *
 * Three of them are here because Python answers them differently from
 * TypeScript, and each is a press that would land on somebody else's name if the
 * vocabulary were wrong: a block is not a scope, a loop variable outlives its
 * loop, and a comprehension holds its own.
 */

const SOURCE = await Bun.file("fixtures/code/shadowing.py").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-python.wasm"
  )
  const parser = new Parser()
  parser.setLanguage(language)
  root = parser.parse(SOURCE)!.rootNode as unknown as Syntax
})

/** The spot of the `nth` whole-word occurrence, as the renderer would report it. */
const spotOf = (word: string, nth = 1): { row: number; column: number } => {
  let seen = 0
  for (const [row, line] of lines.entries()) {
    let column = line.indexOf(word)
    while (column !== -1) {
      const before = line[column - 1] ?? " "
      const after = line[column + word.length] ?? " "
      if (!/[\w$]/.test(before) && !/[\w$]/.test(after)) {
        seen += 1
        if (seen === nth) return { row, column }
      }
      column = line.indexOf(word, column + 1)
    }
  }
  throw new Error(`${word} #${nth} is not in the fixture`)
}

const asked = (word: string, nth = 1): Found | null =>
  writingAt(root, SOURCE, spotOf(word, nth), PYTHON)

/** The line a press answers with, which is the one thing a reader acts on. */
const lineOf = (word: string, nth = 1): number | null => {
  const found = asked(word, nth)
  return found === null || found.at !== "here" ? null : found.writing.line
}

describe("a name in a Python file", () => {
  test("a call reaches the function it calls", () => {
    // `area(n, self.size)` in Box.draw, back to `def area` at the top.
    expect(lineOf("area", 2)).toBe(spotOf("area", 1).row + 1)
  })

  test("a parameter is the function's own, not the module's", () => {
    // `shape` in `area`'s body is the parameter, not any other `shape`.
    const at = spotOf("def area", 1)
    expect(lineOf("shape", 2)).toBe(at.row + 1)
  })

  test("an inner function's parameter shadows the outer one's", () => {
    const inner = spotOf("def inner", 1).row + 1
    // The `shape` returned by `inner` is `inner`'s, not `outer`'s.
    const returned = lines.findIndex((line) => line.trim() === "return shape")
    const found = writingAt(root, SOURCE, spotOf("shape", 6), PYTHON)
    expect(returned).toBeGreaterThan(0)
    expect(found?.at).toBe("here")
    if (found?.at === "here") expect(found.writing.line).toBe(inner)
  })
})

describe("what Python does and TypeScript does not", () => {
  test("a block is not a scope: a name written in an `if` is read after it", () => {
    // `found` is assigned at the top of `loops`, again inside the `if`, and
    // returned after both. The first assignment is the one a reader is shown.
    const first = lines.findIndex((line) => line.trim() === "found = 0") + 1
    const returned = lines.findIndex((line) => line.trim().startsWith("return found, row")) + 1
    expect(first).toBeGreaterThan(0)
    expect(returned).toBeGreaterThan(first)

    const at = { row: returned - 1, column: lines[returned - 1]!.indexOf("found") }
    const found = writingAt(root, SOURCE, at, PYTHON)
    expect(found?.at).toBe("here")
    if (found?.at === "here") expect(found.writing.line).toBe(first)
  })

  test("a loop variable outlives its loop", () => {
    const loop = lines.findIndex((line) => line.trim() === "for row in rows:") + 1
    const returned = lines.findIndex((line) => line.trim().startsWith("return found, row")) + 1

    const at = { row: returned - 1, column: lines[returned - 1]!.indexOf("row", 12) }
    const found = writingAt(root, SOURCE, at, PYTHON)
    expect(found?.at).toBe("here")
    // The `row` after the loop is the loop's own, which is the whole point.
    if (found?.at === "here") expect(found.writing.line).toBe(loop)
  })

  test("a comprehension holds its own name in", () => {
    // `counted`'s `row` is the comprehension's, and not the `row` that `loops`
    // writes in a different function entirely.
    const comprehension = lines.findIndex((line) => line.includes("[row for row in rows")) + 1
    const at = { row: comprehension - 1, column: lines[comprehension - 1]!.indexOf("row") }
    const found = writingAt(root, SOURCE, at, PYTHON)
    expect(found?.at).toBe("here")
    if (found?.at === "here") expect(found.writing.line).toBe(comprehension)
  })

  test("an `except ... as` binds into the function around it", () => {
    const caught = lines.findIndex((line) => line.includes("except IndexError as err")) + 1
    const returned = lines.findIndex((line) => line.trim() === "return err") + 1
    const at = { row: returned - 1, column: lines[returned - 1]!.indexOf("err") }
    const found = writingAt(root, SOURCE, at, PYTHON)
    expect(found?.at).toBe("here")
    if (found?.at === "here") expect(found.writing.line).toBe(caught)
  })

  test("a `with ... as` binds the handle", () => {
    const opened = lines.findIndex((line) => line.includes("with open(path) as handle")) + 1
    const used = lines.findIndex((line) => line.includes("handle.read()")) + 1
    const at = { row: used - 1, column: lines[used - 1]!.indexOf("handle") }
    const found = writingAt(root, SOURCE, at, PYTHON)
    expect(found?.at).toBe("here")
    if (found?.at === "here") expect(found.writing.line).toBe(opened)
  })

  test("the walrus binds into the function, not the `if`", () => {
    const bound = lines.findIndex((line) => line.includes("found := len(rows)")) + 1
    const returned = lines.findIndex(
      (line, at) => line.trim() === "return found" && at > bound - 1
    ) + 1
    const at = { row: returned - 1, column: lines[returned - 1]!.indexOf("found") }
    const found = writingAt(root, SOURCE, at, PYTHON)
    expect(found?.at).toBe("here")
    if (found?.at === "here") expect(found.writing.line).toBe(bound)
  })
})

describe("what a Python file borrowed", () => {
  test("an aliased import points at the name the other module writes", () => {
    const found = asked("root", 1)
    expect(found?.at).toBe("elsewhere")
    if (found?.at === "elsewhere") {
      expect(found.borrowed).toEqual({ name: "sqrt", specifier: "math" })
    }
  })

  test("a plain `from` import keeps the name it arrived under", () => {
    const told = toldBy(root, SOURCE, PYTHON)
    expect(told.borrows).toContainEqual({ name: "sqrt", specifier: "math" })
  })

  test("a relative import keeps its dots, which are what make it relative", () => {
    const told = toldBy(root, SOURCE, PYTHON)
    expect(told.borrows).toContainEqual({ name: "helper", specifier: ".local" })
  })

  test("`import a.b as c` binds the alias and nothing else", () => {
    const told = toldBy(root, SOURCE, PYTHON)
    expect(told.declares).toContain("roads")
  })

  test("a `from` import does not bind the module it read from", () => {
    // `from math import sqrt` puts `sqrt` in the file and never `math`. It read
    // as one for a while, because the node the module name was compared against
    // is a fresh object every time it is asked for.
    const told = toldBy(root, SOURCE, PYTHON)
    expect(told.declares).not.toContain("math")
  })

  test("`import os` binds the first name of the dotted path", () => {
    const told = toldBy(root, SOURCE, PYTHON)
    expect(told.declares).toContain("os")
  })
})

describe("the outline of a Python file", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, PYTHON)

  test("offers the module's functions and classes", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).toContain("area")
    expect(names).toContain("Box")
    expect(names).toContain("LIMIT")
  })

  test("offers a class's methods and attributes as members", () => {
    const members = outline().filter((writing) => writing.kind === "member")
    expect(members.map((writing) => writing.name)).toEqual(
      expect.arrayContaining(["size", "__init__", "draw"])
    )
  })

  test("does not offer a local, a parameter or an import", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).not.toContain("total")
    expect(names).not.toContain("scale")
    expect(names).not.toContain("sqrt")
  })

  test("does not offer a comprehension's own name", () => {
    // `row` is written by a comprehension in `counted` and by a loop in `loops`.
    // The loop's is a function local and neither is the module's.
    expect(outline().map((writing) => writing.name)).not.toContain("row")
  })

  test("names a lambda a function, by what it was given", () => {
    const doubled = outline().find((writing) => writing.name === "doubled")
    expect(doubled?.kind).toBe("function")
  })

  test("offers both names of a tuple assignment", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).toContain("first")
    expect(names).toContain("second")
  })
})

describe("every use of one Python name", () => {
  test("counts the writing and the calls, and nothing that merely spells the same", () => {
    const area = writingsIn(root, SOURCE, PYTHON).find((writing) => writing.name === "area")!
    const uses = usesIn(root, SOURCE, area, PYTHON)
    // Written once, called once. A `shape` in another function is not an `area`.
    expect(uses).toHaveLength(2)
  })

  test("a shadowed name counts only its own scope", () => {
    const inner = spotOf("def inner", 1).row + 1
    const shape = writingAt(root, SOURCE, spotOf("shape", 6), PYTHON)
    expect(shape?.at).toBe("here")
    if (shape?.at !== "here") return
    expect(shape.writing.line).toBe(inner)
    // `inner`'s `shape` is written once and read once; `outer`'s is not counted.
    expect(usesIn(root, SOURCE, shape.writing, PYTHON)).toHaveLength(2)
  })
})
