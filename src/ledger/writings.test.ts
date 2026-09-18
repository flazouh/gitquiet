import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "./syntax"
import { TYPESCRIPT } from "./dialects/typescript"
import {
  toldBy,
  usesIn,
  writingAt,
  writingNamed,
  writingsIn,
  type Found,
  type Writing
} from "./writings"

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

const asked = (word: string, nth = 1): Found | null => writingAt(root, SOURCE, spotOf(word, nth), TYPESCRIPT)

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
    expect(writingAt(root, SOURCE, { row: 9999, column: 0 }, TYPESCRIPT)).toBeNull()
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
    const uses = usesIn(root, SOURCE, outer, TYPESCRIPT)

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

    expect(usesIn(root, SOURCE, inner, TYPESCRIPT)).toHaveLength(3)
  })
})

describe("the outline", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, TYPESCRIPT)

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
    const found = writingNamed(other, OTHER, "two", TYPESCRIPT)

    expect(found?.kind).toBe("function")
    expect(found?.line).toBe(2)
    expect(found?.doc).toContain("What the other file borrows")
  })

  test("answers nothing for a name it does not write", () => {
    expect(writingNamed(other, OTHER, "missing", TYPESCRIPT)).toBeNull()
  })

  test("takes `default` to mean the first thing the file offers", () => {
    // The name every importer uses for an export that has none of its own.
    expect(writingNamed(other, OTHER, "default", TYPESCRIPT)?.name).toBe("two")
  })

  test("does not confuse a name with another one in the same file", () => {
    expect(writingNamed(other, OTHER, "unused", TYPESCRIPT)?.line).toBe(4)
  })
})

describe("what a Ledger keeps about one file", () => {
  test("holds every word that could be a name, with where it is", () => {
    const told = toldBy(root, SOURCE, TYPESCRIPT)

    const shapes = told.mentions.filter((one) => one.name === "shape")
    // Six in the fixture: the outer one and its two mentions, the inner one and
    // its two. Mentions and not Uses — which of them means which is a question
    // about scopes, and this is only where the words are.
    expect(shapes).toHaveLength(6)
    expect(shapes[0]?.line).toBe(spotOf("shape", 1).row + 1)
  })

  test("holds every name bound anywhere, locals and parameters included", () => {
    const told = toldBy(root, SOURCE, TYPESCRIPT)

    // `writingsIn` leaves these out — an outline is what a file offers. A
    // Ledger needs them for the opposite question: whether another file's
    // `given` is this file's at all.
    expect(told.declares).toContain("given")
    expect(told.declares).toContain("inner")
    expect(told.declares).toContain("shape")
    expect(told.declares).toContain("elsewhere")
  })

  test("holds what the file borrowed, and from where", () => {
    const told = toldBy(root, SOURCE, TYPESCRIPT)

    expect(told.borrows).toContainEqual({ name: "two", specifier: "./whole" })
    expect(told.borrows).toContainEqual({ name: "default", specifier: "./whole" })
    expect(told.borrows).toContainEqual({ name: "elsewhere", specifier: "./elsewhere" })
  })

  test("holds the same outline `writingsIn` answers with, and not a second one", () => {
    expect(toldBy(root, SOURCE, TYPESCRIPT).writings).toEqual(writingsIn(root, SOURCE, TYPESCRIPT))
  })
})

/**
 * Following a type, which is the half of a TypeScript file the tests had not
 * been asked about.
 *
 * Every case here is a `type_identifier` rather than an `identifier`, and the
 * fixture writes one in each shape a reader actually presses: an annotation, a
 * return, a member, a type argument, a union, an `extends`. The suite before
 * this asserted one thing about types — that a type alias is called a type —
 * and nothing at all about resolving a use of one or listing its Uses, which is
 * the whole of what a reader does with it.
 */
describe("a type followed the way a value is", () => {
  let types: Syntax
  let TYPES: string
  let typeLines: ReadonlyArray<string>

  beforeAll(async () => {
    TYPES = await Bun.file("fixtures/code/types.ts").text()
    typeLines = TYPES.split("\n")
    const language = await Language.load(
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm"
    )
    const parser = new Parser()
    parser.setLanguage(language)
    types = parser.parse(TYPES)!.rootNode as unknown as Syntax
  })

  /** The spot of the `nth` whole-word occurrence, as the renderer reports it. */
  const spot = (word: string, nth = 1): { row: number; column: number } => {
    let seen = 0
    for (const [row, line] of typeLines.entries()) {
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
    throw new Error(`${word} #${nth} is not in the types fixture`)
  }

  const there = (word: string, nth = 1): Writing | null => {
    const answer = writingAt(types, TYPES, spot(word, nth), TYPESCRIPT)
    return answer === null || answer.at !== "here" ? null : answer.writing
  }

  /** Where the type is declared, which every use below must resolve back to. */
  const declaredAt = (word: string) => ({
    line: spot(word, 1).row + 1,
    from: spot(word, 1).column + 1
  })

  test("resolves a type alias and an interface to themselves", () => {
    expect(there("Secret")?.kind).toBe("type")
    expect(there("Vault")?.kind).toBe("type")
    expect(there("Locked")?.kind).toBe("type")
  })

  test.each([
    ["a member's annotation", "Secret", 2],
    ["a return", "Secret", 3],
    ["a type argument", "Secret", 4],
    ["a union", "Secret", 5]
  ])("follows %s back to the type it names", (_what, word, nth) => {
    const found = there(word, nth)
    expect(found).not.toBeNull()
    expect({ line: found?.line, from: found?.from }).toEqual(declaredAt(word))
  })

  test("follows a parameter's annotation and an `extends` back to the interface", () => {
    // `Vault` #2 is the `extends`, #3 the parameter `take` takes.
    for (const nth of [2, 3]) {
      const found = there("Vault", nth)
      expect({ line: found?.line, from: found?.from }).toEqual(declaredAt("Vault"))
    }
  })

  test("lists every use of a type and nothing that merely spells it the same", () => {
    const writing = there("Secret")
    expect(writing).not.toBeNull()

    const uses = usesIn(types, TYPES, writing as Writing, TYPESCRIPT)
    // The declaration and the four real uses. Not the three on the generic's
    // line, which are a different thing with the same name.
    expect(uses).toHaveLength(5)
    expect(uses.map((use) => use.line)).not.toContain(spot("hides", 1).row + 1)
  })

  test("takes a generic parameter as the thing it is, not as the type it shadows", () => {
    // `export const hides = <Secret,>(one: Secret): Secret => one` — all three
    // are the generic's, and resolving them to the file's own `Secret` was the
    // count of a word rather than of a name.
    const generic = spot("hides", 1).row + 1
    for (const nth of [6, 7, 8]) {
      const found = there("Secret", nth)
      expect(found?.kind).toBe("parameter")
      expect(found?.line).toBe(generic)
    }
  })

  test("keeps a generic out of the outline, as it keeps any parameter out", () => {
    const named = writingsIn(types, TYPES, TYPESCRIPT).map((writing) => writing.name)

    expect(named).toContain("Secret")
    expect(named).toContain("Locked")
    // Once: the type, and not the generic that shadows it.
    expect(named.filter((name) => name === "Secret")).toHaveLength(1)
  })

  test("holds every type it mentions, for a Ledger asked about another file", () => {
    const told = toldBy(types, TYPES, TYPESCRIPT)

    expect(told.mentions.filter((one) => one.name === "Secret").length).toBeGreaterThan(1)
    expect(told.declares).toContain("Secret")
    expect(told.declares).toContain("Vault")
  })
})

/**
 * A declaration with no body, which is a scope like any other.
 *
 * What a `.d.ts` is made of, and what an interface, an overload and an abstract
 * method are made of everywhere else. None of these node types opened a scope,
 * so what they bound leaked into the file — and a name found in the file is the
 * *first* one of that spelling, not the one the reader is looking at. Pressing
 * `Arguments` on line 133 of `p-limit`'s own `index.d.ts` answered with an
 * `Arguments` on line 53, which is a press on somebody else's name.
 */
describe("a signature with no body", () => {
  let types: Syntax
  let TYPES: string
  let typeLines: ReadonlyArray<string>

  beforeAll(async () => {
    TYPES = await Bun.file("fixtures/code/types.ts").text()
    typeLines = TYPES.split("\n")
    const language = await Language.load(
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm"
    )
    const parser = new Parser()
    parser.setLanguage(language)
    types = parser.parse(TYPES)!.rootNode as unknown as Syntax
  })

  const spot = (word: string, nth = 1): { row: number; column: number } => {
    let seen = 0
    for (const [row, line] of typeLines.entries()) {
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
    throw new Error(`${word} #${nth} is not in the types fixture`)
  }

  const there = (word: string, nth = 1): Writing | null => {
    const answer = writingAt(types, TYPES, spot(word, nth), TYPESCRIPT)
    return answer === null || answer.at !== "here" ? null : answer.writing
  }

  test("writes its name down, so the name can be followed at all", () => {
    expect(there("unbodied")?.kind).toBe("function")
    expect(there("unbodied")?.line).toBe(spot("unbodied", 1).row + 1)
  })

  test("offers that name to the outline, as a bodied one does", () => {
    const named = writingsIn(types, TYPES, TYPESCRIPT).map((writing) => writing.name)
    expect(named).toContain("unbodied")
    expect(named).toContain("alsoUnbodied")
    expect(named).toContain("Signatures")
  })

  test("keeps its own generic, rather than the first of that name in the file", () => {
    // Two signatures, each with a `Held` of its own. Before, both resolved to
    // the first — so pressing the second took the reader to the other one.
    const first = spot("unbodied", 1).row + 1
    const second = spot("alsoUnbodied", 1).row + 1

    // Three of them to a signature: the generic, the parameter's type, and
    // the return. The first three are the first signature's, the next three
    // the second's — and before this every one of the six answered with the
    // first.
    for (const nth of [1, 2, 3]) expect(there("Held", nth)?.line).toBe(first)
    for (const nth of [4, 5, 6]) expect(there("Held", nth)?.line).toBe(second)
  })

  test("keeps its own parameters, which used to leak into the file", () => {
    // `kept` is written by three signatures here — two functions and an
    // interface method — and each one belongs to the signature that takes it.
    const places = [1, 2, 3].map((nth) => there("kept", nth)?.line)
    expect(places.every((line) => line !== undefined)).toBe(true)
    expect(new Set(places).size).toBe(3)
  })

  test("does not offer its members as names of the file", () => {
    // An interface's method is reached through the interface, never as a bare
    // name — the same reason a class body is not a scope.
    const named = writingsIn(types, TYPES, TYPESCRIPT).map((writing) => writing.name)
    expect(named).not.toContain("first")
    expect(named).not.toContain("second")
  })
})

/**
 * What a file passes on from somewhere else.
 *
 * `export { one } from "./two"` is a borrow and not a Writing: nothing here can
 * refer to `one`, this file does not write it, and the outline must not offer
 * it. It says only that a name arrives here from there — which is exactly what
 * a barrel is, and it was recorded nowhere, so a barrel said it borrowed
 * nothing and every file importing through one got a guess.
 */
describe("a name a file passes on", () => {
  let types: Syntax
  let TYPES: string

  beforeAll(async () => {
    TYPES = await Bun.file("fixtures/code/types.ts").text()
    const language = await Language.load(
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm"
    )
    const parser = new Parser()
    parser.setLanguage(language)
    types = parser.parse(TYPES)!.rootNode as unknown as Syntax
  })

  test("is recorded as a borrow, under the name the other file writes", () => {
    const told = toldBy(types, TYPES, TYPESCRIPT)
    expect(told.borrows).toContainEqual({ name: "alsoUnbodied", specifier: "./whole" })
  })

  test("takes a whole-module re-export as every name that file writes", () => {
    expect(toldBy(types, TYPES, TYPESCRIPT).borrows).toContainEqual({ name: "*", specifier: "./whole" })
  })

  test("does not bind it, so the outline never offers a name passed through", () => {
    // The alias is what this file offers to others; it is not a name this file
    // writes and nothing in it can refer to one.
    const named = writingsIn(types, TYPES, TYPESCRIPT).map((one) => one.name)
    expect(named).not.toContain("passedAlong")
    expect(toldBy(types, TYPES, TYPESCRIPT).declares).not.toContain("passedAlong")
  })
})

describe("what reading a big file costs", () => {
  /**
   * A guard against the quadratic coming back, not a benchmark.
   *
   * `docked` used to walk the tree from the root looking for the comment above
   * one name, and it was called once per name — so reading a file cost its size
   * times the number of things in it. This fixture repeated came to 14KB in 83ms
   * and 27KB in 297ms: four times the work for twice the file.
   *
   * With the comments gathered once, the same 27KB is 3ms and 392KB — which is
   * the largest file `worthReading` will take — is 41ms.
   *
   * The file here is 109KB, which the fixed reading does in about 12ms and the
   * quadratic one would take some 4.8 seconds over. The budget sits between them
   * with a hundred times the headroom on one side and three times the margin on
   * the other, because this runs under `bun test --parallel` with a worker per
   * core: a tight budget would be a test about the machine, and a bigger file
   * would be this test slowing every other one down.
   */
  test("grows with the file, not with the file times what is in it", async () => {
    const big = SOURCE.repeat(128)
    const language = await Language.load(
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm"
    )
    const parser = new Parser()
    parser.setLanguage(language)
    const tree = parser.parse(big)!
    const at = tree.rootNode as unknown as Syntax

    const started = performance.now()
    const writings = writingsIn(at, big, TYPESCRIPT)
    const took = performance.now() - started

    tree.delete()
    parser.delete()

    expect(writings.length).toBeGreaterThan(1_000)
    expect(took).toBeLessThan(1_500)
  })
})
