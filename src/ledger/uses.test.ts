import { describe, expect, test } from "bun:test"
import { usesAcross, type Asked } from "./uses"
import type { Told } from "./writings"

/**
 * The rule, without a parser: what a Ledger does with what it was told.
 *
 * `writings.test.ts` is where what a file says is checked against the real
 * grammar. This is the other half — which of those sayings is a Use of the
 * Writing a reader asked about, and how sure that is.
 */

const told = (over: Partial<Told> = {}): Told => ({
  writings: [],
  mentions: [],
  declares: [],
  borrows: [],
  ...over
})

const mention = (name: string, line: number) => ({ name, line, from: 1, to: 1 + name.length })

const PATHS = new Set(["src/one.ts", "src/two.ts", "src/three.ts", "src/four.ts"])

const asked: Asked = { name: "shape", path: "src/one.ts", line: 2 }

describe("everywhere in a repository that means one Writing", () => {
  test("is sure about the file the Writing is written in", () => {
    const files = new Map([["src/one.ts", told({ mentions: [mention("shape", 2), mention("shape", 9)] })]])

    expect(usesAcross(files, asked, PATHS)).toEqual([
      { path: "src/one.ts", line: 2, from: 1, to: 6, sure: true },
      { path: "src/one.ts", line: 9, from: 1, to: 6, sure: true }
    ])
  })

  test("is sure about a file that says it borrowed the name from that file", () => {
    const files = new Map([
      [
        "src/two.ts",
        told({
          mentions: [mention("shape", 4)],
          borrows: [{ name: "shape", specifier: "./one" }]
        })
      ]
    ])

    expect(usesAcross(files, asked, PATHS)[0]?.sure).toBe(true)
  })

  test("is not sure about a file that merely holds the same word", () => {
    const files = new Map([["src/three.ts", told({ mentions: [mention("shape", 7)] })]])

    const [found] = usesAcross(files, asked, PATHS)
    expect(found?.sure).toBe(false)
    expect(found?.path).toBe("src/three.ts")
  })

  test("leaves out a file that binds its own name of that spelling", () => {
    // Two things with one spelling are two things. Offering one for the other
    // is the mistake this whole feature exists to stop a reader making.
    const files = new Map([
      ["src/four.ts", told({ mentions: [mention("shape", 3)], declares: ["shape"] })]
    ])

    expect(usesAcross(files, asked, PATHS)).toEqual([])
  })

  test("is not fooled by a borrow of the same name from somewhere else", () => {
    const files = new Map([
      [
        "src/two.ts",
        told({
          mentions: [mention("shape", 4)],
          // The same name, a different file. This is somebody else's `shape`.
          borrows: [{ name: "shape", specifier: "./three" }]
        })
      ]
    ])

    expect(usesAcross(files, asked, PATHS)[0]?.sure).toBe(false)
  })

  test("takes a whole-module borrow as reaching everything that file writes", () => {
    const files = new Map([
      [
        "src/two.ts",
        told({ mentions: [mention("shape", 4)], borrows: [{ name: "*", specifier: "./one" }] })
      ]
    ])

    expect(usesAcross(files, asked, PATHS)[0]?.sure).toBe(true)
  })

  test("skips a file that never holds the word, without asking anything else of it", () => {
    const files = new Map([
      ["src/two.ts", told({ mentions: [mention("other", 1)], declares: ["shape"] })]
    ])

    expect(usesAcross(files, asked, PATHS)).toEqual([])
  })

  test("stops at what it was asked for, so one common name is not the whole repository", () => {
    const many = new Map(
      Array.from({ length: 50 }, (_, at) => [
        `src/file${at}.ts`,
        told({ mentions: [mention("shape", 1), mention("shape", 2)] })
      ])
    )

    expect(usesAcross(many, asked, PATHS, 12)).toHaveLength(12)
  })
})

/**
 * A borrowed name is not a name of the file's own.
 *
 * The case that made a real repository answer "0 elsewhere". An import binds
 * the name, so an imported name sits in `declares` beside every local — and the
 * veto below read that as the file writing its own thing of the same spelling
 * and dropped the file. Every importer whose specifier could not be resolved
 * disappeared, which is the one answer this feature must never give: a
 * confident nobody where the truth is "I could not tell".
 */
describe("a file that says where it got the name", () => {
  test("is offered as Likely where the specifier cannot be resolved", () => {
    const files = new Map([
      [
        "src/two.ts",
        told({
          mentions: [mention("shape", 4)],
          // Through a workspace alias, which is not a path and resolves to
          // nothing here — and is how most of a monorepo imports anything.
          borrows: [{ name: "shape", specifier: "@org/one" }],
          // Bound by the import itself, which is what the veto tripped over.
          declares: ["shape"]
        })
      ]
    ])

    const [found] = usesAcross(files, asked, PATHS)
    expect(found?.path).toBe("src/two.ts")
    expect(found?.sure).toBe(false)
  })

  test("is still left out where it binds the name and borrowed nothing", () => {
    // The rule the veto is there for, which this must not have weakened.
    const files = new Map([
      ["src/four.ts", told({ mentions: [mention("shape", 3)], declares: ["shape"] })]
    ])

    expect(usesAcross(files, asked, PATHS)).toEqual([])
  })
})
