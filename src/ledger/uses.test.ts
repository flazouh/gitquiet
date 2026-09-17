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

/**
 * A name followed back through the files that pass it on.
 *
 * A repository puts a barrel in front of a folder and imports through it, which
 * is most repositories. One hop cannot see that: `ui/index.ts` re-exports a name
 * from `ui/select-field.tsx`, the twenty files that use it import it from
 * `../ui`, and `../ui` resolves to the barrel — which is not where the name is
 * written. Every one of them came back **Likely**, a guess about an answer the
 * repository had stated twice: once in the barrel, once in each importer.
 */
describe("a name passed on through a barrel", () => {
  const paths = new Set([
    "ui/select-field.tsx",
    "ui/index.ts",
    "pages/one.tsx",
    "outer/index.ts",
    "pages/deep.tsx"
  ])
  const where: Asked = { name: "Option", path: "ui/select-field.tsx", line: 1 }

  test("is sure about the barrel that re-exports it", () => {
    const files = new Map([
      ["ui/select-field.tsx", told({ mentions: [mention("Option", 1)] })],
      [
        "ui/index.ts",
        told({
          mentions: [mention("Option", 1)],
          borrows: [{ name: "Option", specifier: "./select-field" }]
        })
      ]
    ])
    expect(usesAcross(files, where, paths).find((one) => one.path === "ui/index.ts")?.sure).toBe(
      true
    )
  })

  test("is sure about a file importing through that barrel", () => {
    const files = new Map([
      ["ui/select-field.tsx", told({ mentions: [mention("Option", 1)] })],
      ["ui/index.ts", told({ borrows: [{ name: "Option", specifier: "./select-field" }] })],
      [
        "pages/one.tsx",
        told({
          mentions: [mention("Option", 2)],
          borrows: [{ name: "Option", specifier: "../ui" }]
        })
      ]
    ])
    expect(usesAcross(files, where, paths).find((one) => one.path === "pages/one.tsx")?.sure).toBe(
      true
    )
  })

  test("follows a barrel in front of a barrel, which is how folders nest", () => {
    const files = new Map([
      ["ui/select-field.tsx", told({ mentions: [mention("Option", 1)] })],
      ["ui/index.ts", told({ borrows: [{ name: "Option", specifier: "./select-field" }] })],
      // A whole-module re-export carries every name the file writes.
      ["outer/index.ts", told({ borrows: [{ name: "*", specifier: "../ui" }] })],
      [
        "pages/deep.tsx",
        told({
          mentions: [mention("Option", 2)],
          borrows: [{ name: "Option", specifier: "../outer" }]
        })
      ]
    ])
    expect(usesAcross(files, where, paths).find((one) => one.path === "pages/deep.tsx")?.sure).toBe(
      true
    )
  })

  test("is still only Likely where the file merely holds the word", () => {
    // Nothing states a borrow, so nothing proves the two spellings are one
    // thing. The mark is what the answer is for.
    const files = new Map([
      ["ui/select-field.tsx", told({ mentions: [mention("Option", 1)] })],
      ["pages/one.tsx", told({ mentions: [mention("Option", 2)] })]
    ])
    expect(usesAcross(files, where, paths).find((one) => one.path === "pages/one.tsx")?.sure).toBe(
      false
    )
  })

  test("is not fooled into Sure by a chain that ends somewhere else", () => {
    const files = new Map([
      ["ui/select-field.tsx", told({ mentions: [mention("Option", 1)] })],
      // The barrel passes on a name of that spelling from a different file.
      ["ui/index.ts", told({ borrows: [{ name: "Option", specifier: "./other" }] })],
      [
        "pages/one.tsx",
        told({
          mentions: [mention("Option", 2)],
          borrows: [{ name: "Option", specifier: "../ui" }]
        })
      ]
    ])
    const found = usesAcross(files, where, new Set([...paths, "ui/other.ts"]))
    expect(found.find((one) => one.path === "pages/one.tsx")?.sure).toBe(false)
  })

  test("ends where two barrels name each other", () => {
    // Not a hang and not a stack overflow: the walk remembers where it has been
    // and the depth is bounded besides.
    const files = new Map([
      ["ui/select-field.tsx", told({ mentions: [mention("Option", 1)] })],
      ["ui/index.ts", told({ borrows: [{ name: "*", specifier: "../outer" }] })],
      [
        "outer/index.ts",
        told({ mentions: [mention("Option", 3)], borrows: [{ name: "*", specifier: "../ui" }] })
      ]
    ])
    expect(usesAcross(files, where, paths).find((one) => one.path === "outer/index.ts")?.sure).toBe(
      false
    )
  })
})
