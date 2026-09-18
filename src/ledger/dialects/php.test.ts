import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { toldBy, usesIn, writingAt, writingsIn, type Writing } from "../writings"
import { PHP } from "./php"

/**
 * The PHP vocabulary, against the real PHP grammar.
 *
 * Two cases earn this file. A variable is a `variable_name` holding a `name`, so
 * the Name a reader presses is the half without the dollar and that is what has
 * to be bound. And PHP binds at the function rather than at the block, so a
 * variable written inside an `if` or a `foreach` is the same one after it.
 */

const SOURCE = await Bun.file("fixtures/code/shadowing.php").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-php.wasm"
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
  const found = writingAt(root, SOURCE, { row: line - 1, column }, PHP)
  return found === null || found.at !== "here" ? null : found.writing.line
}

describe("a variable is a name inside a name", () => {
  test("a press on the half without the dollar answers", () => {
    // `$total` is a `variable_name` holding a `name` that carries `total`. A
    // scope keyed on `$total` is one nothing pressed could ever be found in.
    expect(pressed("foreach ([1, 2]", "total", 5)).toBe(lineWith("$total = $shape"))
  })

  test("a parameter is the function's own", () => {
    expect(pressed("$total = $shape", "shape", 12)).toBe(lineWith("function area(int $shape"))
  })
})

describe("PHP binds at the function, not at the block", () => {
  test("a `foreach` leaves its name behind", () => {
    expect(pressed("$total += $row", "row")).toBe(lineWith("foreach ([1, 2] as $row)"))
  })

  test("a `for` leaves its counter behind", () => {
    expect(pressed("$total += $i", "i")).toBe(lineWith("for ($i = 0"))
  })

  test("a `catch` binds into the function around it", () => {
    const caught = lineWith("catch (Exception $err)")
    const found = writingAt(
      root,
      SOURCE,
      { row: caught - 1, column: lines[caught - 1]!.indexOf("err") },
      PHP
    )
    expect(found?.at).toBe("here")
  })
})

describe("a bare name in a PHP file", () => {
  test("a call reaches the function it calls", () => {
    expect(pressed("total += risky()", "risky")).toBe(lineWith("function risky()"))
  })

  test("a method reaches a function written outside its class", () => {
    expect(pressed("return area($n", "area")).toBe(lineWith("function area(int $shape"))
  })

  test("a constant is reached by its bare name", () => {
    expect(pressed("return LIMIT", "LIMIT")).toBe(lineWith("const LIMIT = 10"))
  })
})

describe("the outline of a PHP file", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, PHP)

  test("offers the file's functions, classes and constants", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).toEqual(expect.arrayContaining(["area", "risky", "Box", "LIMIT"]))
  })

  test("names an interface and a trait a type, and a class a class", () => {
    const kinds = new Map(outline().map((writing) => [writing.name, writing.kind]))
    expect(kinds.get("Box")).toBe("class")
    expect(kinds.get("Shape")).toBe("type")
    expect(kinds.get("Drawable")).toBe("type")
  })

  test("offers a class's methods, properties and constants as members", () => {
    const members = outline().filter((writing) => writing.kind === "member")
    expect(members.map((writing) => writing.name)).toEqual(
      expect.arrayContaining(["size", "SIDES", "__construct", "draw"])
    )
  })

  test("does not offer a local or a parameter", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).not.toContain("total")
    expect(names).not.toContain("scale")
  })
})

describe("what a PHP file borrowed", () => {
  test("splits a `use` into the name and the namespace it came from", () => {
    expect(toldBy(root, SOURCE, PHP).borrows).toContainEqual({
      name: "Base",
      specifier: "App"
    })
  })

  test("an alias binds, and keeps the name the other namespace writes", () => {
    const told = toldBy(root, SOURCE, PHP)
    expect(told.declares).toContain("Widget")
    expect(told.borrows).toContainEqual({ name: "Thing", specifier: "App\\Other" })
  })
})

describe("every use of one PHP name", () => {
  test("counts the writing and both calls", () => {
    const area = writingsIn(root, SOURCE, PHP).find(
      (writing) => writing.name === "area" && writing.kind === "function"
    )!
    const uses = usesIn(root, SOURCE, area, PHP).map((use) => use.line)
    expect(uses).toContain(lineWith("function area(int $shape"))
    expect(uses).toContain(lineWith("return area($n"))
  })
})
