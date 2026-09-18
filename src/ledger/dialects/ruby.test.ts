import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { toldBy, usesIn, writingAt, writingsIn, type Writing } from "../writings"
import { RUBY } from "./ruby"

/**
 * The Ruby vocabulary, against the real Ruby grammar.
 *
 * Two cases earn this file. A method is called with no receiver, as in Java, so
 * a bare `risky` is a Name. And Ruby's two loops disagree: a block holds its
 * parameters to itself and a `for` leaves its name behind, which is the one
 * thing `for` does differently from `each`.
 */

const SOURCE = await Bun.file("fixtures/code/shadowing.rb").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-ruby.wasm"
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
  const found = writingAt(root, SOURCE, { row: line - 1, column }, RUBY)
  return found === null || found.at !== "here" ? null : found.writing.line
}

describe("what Ruby does that TypeScript does not", () => {
  test("a bare word reaches the method of the class it is in", () => {
    expect(pressed("total += risky", "risky")).toBe(lineWith("def risky"))
  })

  test("a `for` leaves its name behind, where a block does not", () => {
    // `i` is read on the line after the loop's own, and means the loop's `i`.
    expect(pressed("total += i", "i")).toBe(lineWith("for i in 0..3"))
  })

  test("a block's parameter belongs to the block", () => {
    expect(pressed("total += row", "row")).toBe(lineWith("[1, 2].each"))
  })

  test("a constant is a Name, and is not an identifier", () => {
    // `LIMIT` is written as a `constant` node and `total` as an `identifier`.
    // Both are pressed the same way and both must answer.
    expect(pressed("      LIMIT", "LIMIT")).toBe(lineWith("LIMIT = 10"))
  })

  test("a rescue leaves what it caught readable after the begin", () => {
    const caught = lineWith("rescue StandardError => err")
    const found = writingAt(
      root,
      SOURCE,
      { row: caught - 1, column: lines[caught - 1]!.indexOf("err") },
      RUBY
    )
    expect(found?.at).toBe("here")
  })
})

describe("a name in a Ruby file", () => {
  test("a local is found from below", () => {
    expect(pressed("[1, 2].each", "total")).toBe(lineWith("total = n * @size"))
  })

  test("a parameter is the method's own", () => {
    expect(pressed("total = n * @size", "n")).toBe(lineWith("def draw(n)"))
  })

  test("a lambda's parameter belongs to the lambda", () => {
    // The second `z`, which is the one in the body rather than the parameter.
    const line = lineWith("doubled = ->(z)")
    const body = lines[line - 1]!.indexOf("{ z") + 2
    expect(pressed("doubled = ->(z)", "z", body)).toBe(line)
  })
})

describe("the outline of a Ruby file", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, RUBY)

  test("offers a module, and the class written inside it", () => {
    const kinds = new Map(outline().map((writing) => [writing.name, writing.kind]))
    expect(kinds.get("Shapes")).toBe("type")
    expect(kinds.get("Box")).toBe("class")
  })

  test("offers a class's methods and constants as members", () => {
    const members = outline().filter((writing) => writing.kind === "member")
    expect(members.map((writing) => writing.name)).toEqual(
      expect.arrayContaining(["SIDES", "initialize", "draw", "build", "risky"])
    )
  })

  test("does not offer a local, a parameter or a block's name", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).not.toContain("total")
    expect(names).not.toContain("row")
    expect(names).not.toContain("i")
  })

  test("names a lambda a function, by what it was given", () => {
    const doubled = outline().find((writing) => writing.name === "doubled")
    expect(doubled?.kind).toBe("function")
  })

  test("offers both names of a multiple assignment", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).toContain("first")
    expect(names).toContain("second")
  })
})

describe("what a Ruby file required", () => {
  test("says the file a require_relative names", () => {
    expect(toldBy(root, SOURCE, RUBY).borrows).toContainEqual({
      name: "*",
      specifier: "local/helper"
    })
  })

  test("does not claim a gem is a file in this repository", () => {
    // `require 'set'` names a gem. Following it leaves the repository, which is
    // the same answer every dependency gets everywhere else here.
    const said = toldBy(root, SOURCE, RUBY).borrows.map((one) => one.specifier)
    expect(said).not.toContain("set")
  })
})

describe("every use of one Ruby name", () => {
  test("counts the writing and the bare call", () => {
    const risky = writingsIn(root, SOURCE, RUBY).find((writing) => writing.name === "risky")!
    const uses = usesIn(root, SOURCE, risky, RUBY).map((use) => use.line)
    expect(uses).toContain(lineWith("def risky"))
    expect(uses).toContain(lineWith("total += risky"))
  })
})
