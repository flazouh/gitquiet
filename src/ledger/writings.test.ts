import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "./syntax"
import { usesIn, writingAt, writingNamed, writingsIn, type Found, type Writing } from "./writings"

/**
 * The resolver, against the real TypeScript grammar.
 *
 * Not a stand-in tree. Every one of these cases is a thing a reader does on a
 * file somebody wrote, and a tree built by hand to suit the resolver would agree
 * with it about a grammar neither of them had met.
 *
 * It runs here rather than in a browser because tree-sitter compiles under
 * `bun test` — which plan 009 did not have to be true and is. The offscreen
 * document is where this runs in production and has nothing to do with whether
 * it is right.
 */

const SOURCE = await Bun.file("fixtures/code/shadowing.ts").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm"
  )
  const parser = new Parser()
  parser.setLanguage(language)
  root = parser.parse(SOURCE)! .rootNode as unknown as Syntax
})

/**
 * The spot of the `nth` occurrence of a word, as the renderer would report it.
 *
 * Counts every occurrence, the ones inside strings included — `"./elsewhere"`
 * holds the word `elsewhere` between two characters that are not letters. Worth
 * knowing when counting: the second `elsewhere` in the fixture is in the import's
 * own string, and the third is the use. An earlier version of this test asked
 * about the second, got nothing, and passed for entirely the wrong reason.
 */
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

const asked = (word: string, nth = 1): Found | null => writingAt(root, SOURCE, spotOf(word, nth))

/** The Writing, where the answer is one. A borrowed name is not, and answers null. */
const at = (word: string, nth = 1): Writing | null => {
  const answer = asked(word, nth)
  return answer === null || answer.at !== "here" ? null : answer.writing
}

describe("a Name resolved inside its own file", () => {
  test("finds a parameter where the parameter is what the name means", () => {
    const found = at("given", 2)

    expect(found?.kind).toBe("parameter")
    expect(found?.line).toBe(spotOf("given", 1).row + 1)
  })

  test("finds the local, not the parameter, where a local shadows nothing", () => {
    const found = at("inner", 2)

    expect(found?.kind).toBe("value")
    expect(found?.line).toBe(spotOf("inner", 1).row + 1)
  })

  test("takes the inner one where a name is shadowed, which is what shadowing is", () => {
    // `shape` inside `said` is its own const, declared in that function.
    const inner = at("shape", 4)
    const outer = at("shape", 1)

    expect(inner?.line).not.toBe(outer?.line)
    expect(inner?.line).toBe(spotOf("shape", 3).row + 1)
  })

  test("resolves a name used before it is written, which a file is allowed to do", () => {
    const found = at("early", 1)

    expect(found?.kind).toBe("function")
    expect(found?.line).toBe(spotOf("early", 2).row + 1)
  })

  test("answers a declaration with itself, so pressing one is not a dead press", () => {
    const found = at("said", 1)

    expect(found?.line).toBe(spotOf("said", 1).row + 1)
    expect(found?.kind).toBe("function")
  })

  test("calls a const holding an arrow a function, which is what a reader calls it", () => {
    expect(at("shape", 1)?.kind).toBe("function")
    expect(at("later", 1)?.kind).toBe("function")
  })

  test("binds every name a destructuring pattern binds", () => {
    expect(at("picked", 1)?.kind).toBe("value")
    expect(at("rest", 1)?.kind).toBe("value")
    expect(at("first", 1)?.kind).toBe("value")
  })

  test("binds what a for-of writes, and only inside the loop", () => {
    expect(at("each", 2)?.line).toBe(spotOf("each", 1).row + 1)
  })

  test("finds a type where a type is what was asked about", () => {
    expect(at("Held", 1)?.kind).toBe("type")
    expect(at("Thing", 2)?.kind).toBe("class")
  })

  test("says nothing about a property, which needs a type checker and not a scope", () => {
    expect(at("held", 2)).toBeNull()
  })

  test("says an imported name came from elsewhere, and where it said it came from", () => {
    const one = asked("elsewhere", 3)
    expect(one?.at).toBe("elsewhere")
    expect(one?.at === "elsewhere" ? one.borrowed : null).toEqual({
      name: "elsewhere",
      specifier: "./elsewhere"
    })
  })

  test("carries the name the other file writes, which an alias is not", () => {
    const aliased = asked("three", 2)

    // `import { two as three }`: this file reads `three`, that file wrote `two`.
    expect(aliased?.at === "elsewhere" ? aliased.borrowed : null).toEqual({
      name: "two",
      specifier: "./whole"
    })
  })

  test("calls a default import by the name every importer calls it", () => {
    const whole = asked("Whole", 2)

    expect(whole?.at === "elsewhere" ? whole.borrowed : null).toEqual({
      name: "default",
      specifier: "./whole"
    })
  })

  test("never points a reader at the import line they are already looking at", () => {
    // The Writing of an imported name is in the other file. What this file has
    // is a line that says so, and following to it goes nowhere.
    expect(at("elsewhere", 3)).toBeNull()
  })

  test("says nothing where the pointer is not on a name at all", () => {
    expect(writingAt(root, SOURCE, { row: 9999, column: 0 })).toBeNull()
  })

  test("carries the comment written above it, and only where one is", () => {
    expect(at("shape", 1)?.doc).toContain("What the outer one is for")
    expect(at("later", 1)?.doc).toBeNull()
  })

  test("carries the line it is written on, for the card", () => {
    expect(at("said", 1)?.signature).toBe("function said(word: string) {")
  })
})

describe("everywhere a Writing is used", () => {
  test("counts the name and not the word", () => {
    const outer = at("shape", 1)!
    const uses = usesIn(root, SOURCE, outer)

    // The declaration, the mention inside its own body, and the call at the end.
    // Not the three inside `said`, which are a different `shape` entirely.
    expect(uses).toHaveLength(3)
    expect(uses.map((use) => use.line)).toEqual([
      spotOf("shape", 1).row + 1,
      spotOf("shape", 2).row + 1,
      spotOf("shape", 6).row + 1
    ])
  })

  test("counts the shadowed one separately, which is the same rule from the other side", () => {
    const inner = at("shape", 3)!

    expect(usesIn(root, SOURCE, inner)).toHaveLength(3)
  })
})

describe("the outline", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE)

  test("is what the file offers, in the order it is written", () => {
    const names = outline().map((one) => one.name)

    expect(names).toEqual([
      "shape",
      "said",
      "Held",
      "Thing",
      "held",
      "method",
      "picked",
      "rest",
      "first",
      "later",
      "early",
      "used"
    ])
  })

  test("leaves out what a file borrowed and what it keeps to itself", () => {
    const names = outline().map((one) => one.name)

    expect(names).not.toContain("elsewhere")
    expect(names).not.toContain("Whole")
    expect(names).not.toContain("inner")
    expect(names).not.toContain("word")
  })
})

describe("what another file asks of this one", () => {
  let OTHER = ""
  let other: Syntax

  beforeAll(async () => {
    OTHER = await Bun.file("fixtures/code/whole.ts").text()
    const language = await Language.load(
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm"
    )
    const parser = new Parser()
    parser.setLanguage(language)
    other = parser.parse(OTHER)!.rootNode as unknown as Syntax
  })

  test("gives up the Writing of the name it was asked about", () => {
    const found = writingNamed(other, OTHER, "two")

    expect(found?.kind).toBe("function")
    expect(found?.line).toBe(2)
    expect(found?.doc).toContain("What the other file borrows")
  })

  test("answers nothing for a name it does not write", () => {
    expect(writingNamed(other, OTHER, "missing")).toBeNull()
  })

  test("takes `default` to mean the first thing the file offers", () => {
    // The name every importer uses for an export that has none of its own.
    expect(writingNamed(other, OTHER, "default")?.name).toBe("two")
  })

  test("does not confuse a name with another one in the same file", () => {
    expect(writingNamed(other, OTHER, "unused")?.line).toBe(4)
  })
})
