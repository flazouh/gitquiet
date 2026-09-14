import { beforeAll, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { exactly, MOST_FILES, readable, type Exact } from "./exact"

/**
 * The exact tier, against a small repository of its own.
 *
 * Every case here is one the tier below cannot answer at all, or answers as a
 * Likely. If a case is one scopes already get right, it belongs in
 * `writings.test.ts` — this file is for what types are needed for.
 */

const FILES = new Map([
  [
    "/src/shape.ts",
    `export class Shape {
  /** What the method is for. */
  area(): number {
    return 1
  }
}

export const make = (): Shape => new Shape()
`
  ],
  [
    "/src/use.ts",
    `import { make } from "./shape"

const one = make()
const two = one.area()

export const both = () => two + one.area()
`
  ],
  [
    "/src/other.ts",
    `// A different \`area\`, which shares nothing with the one above but a spelling.
export const area = 12
export const used = area + 1
`
  ]
])

/** The standard library, which a program needs and a browser would ship. */
const LIB = "node_modules/typescript-5/lib"
const libs = new Map<string, string>()

let exact: Exact

beforeAll(() => {
  for (const name of ["lib.es2022.full.d.ts", "lib.es2022.d.ts", "lib.es5.d.ts", "lib.dom.d.ts"]) {
    libs.set(`/lib/${name}`, readFileSync(`${LIB}/${name}`, "utf8"))
  }
  exact = exactly(FILES, libs)
})

describe("what only a type checker can answer", () => {
  test("follows a method call to the method, which scopes cannot", () => {
    // `one.area()` in use.ts, where `one` is a `Shape` only because `make`
    // says so. Nothing short of types can get from here to there.
    const found = exact.definitionAt({ path: "/src/use.ts", line: 4, column: 16 })

    expect(found?.path).toBe("/src/shape.ts")
    expect(found?.line).toBe(3)
  })

  test("finds every use of a method across the repository", () => {
    const uses = exact.usesAt({ path: "/src/shape.ts", line: 3, column: 2 })

    expect(uses.map((one) => `${one.path}:${one.line}`).sort()).toEqual([
      "/src/shape.ts:3",
      "/src/use.ts:4",
      "/src/use.ts:6"
    ])
  })

  test("does not confuse a method with a name that merely shares its spelling", () => {
    // `other.ts` writes its own `area`. The tier below marks it Likely; this
    // one does not offer it at all.
    const uses = exact.usesAt({ path: "/src/shape.ts", line: 3, column: 2 })

    expect(uses.some((one) => one.path === "/src/other.ts")).toBe(false)
  })

  test("follows an import to what it names", () => {
    const found = exact.definitionAt({ path: "/src/use.ts", line: 3, column: 12 })

    expect(found?.path).toBe("/src/shape.ts")
    expect(found?.line).toBe(8)
  })

  test("answers nothing for a file it was never given", () => {
    expect(exact.definitionAt({ path: "/src/missing.ts", line: 1, column: 0 })).toBeNull()
    expect(exact.usesAt({ path: "/src/missing.ts", line: 1, column: 0 })).toEqual([])
  })
})

describe("which files it can say anything about", () => {
  test("is the languages it compiles, and not the rest of a repository", () => {
    expect(readable("src/one.ts")).toBe(true)
    expect(readable("src/one.tsx")).toBe(true)
    expect(readable("src/one.mjs")).toBe(true)
    expect(readable("README.md")).toBe(false)
    expect(readable("src/one.py")).toBe(false)
  })
})

describe("how much is worth building a program over", () => {
  test("stops where a document would be holding a quarter of a gigabyte", () => {
    // Measured rather than chosen: about 29MB for the compiler however small the
    // repository, and about a tenth of a megabyte per file after it. The
    // comment on `MOST_FILES` carries the table.
    expect(MOST_FILES).toBe(1_000)
  })
})
