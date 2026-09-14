import { describe, expect, it } from "bun:test"
import { findingFile } from "./findingFile"

/** A slice of this repository, which is the tree the rules below were judged on. */
const PATHS = [
  "src/ui/place.ts",
  "src/ui/Place.test.tsx",
  "src/ui/RepoTree.tsx",
  "src/ui/repoTree.test.ts",
  "src/ui/Files.tsx",
  "src/ui/FileBrowser.tsx",
  "src/ui/WholeFile.tsx",
  "src/domain/findingFile.ts",
  "src/diff/engine.ts",
  "src/github/GitHubGateway.ts",
  "src/entrypoints/background.ts",
  "docs/spec/following.md",
  "package.json",
  "site/public/store/marquee.png"
]

const first = (query: string): string | undefined => findingFile(PATHS, query)[0]?.path
const paths = (query: string): ReadonlyArray<string> =>
  findingFile(PATHS, query).map((found) => found.path)

describe("reaching a file by typing part of its name", () => {
  it("takes the characters in order and nothing else", () => {
    expect(paths("zzz")).toEqual([])
    expect(paths("sxt")).toEqual([])
  })

  it("does not ask for them to be adjacent", () => {
    expect(paths("gitgate")).toContain("src/github/GitHubGateway.ts")
  })

  it("ignores case in both directions", () => {
    expect(first("PLACE")).toBe("src/ui/place.ts")
    expect(paths("repotree")).toContain("src/ui/RepoTree.tsx")
  })

  it("puts a match in the filename above one in the folders", () => {
    // Every path here is under `src`, so a scorer reading the whole path alike
    // would have nothing to choose between them.
    expect(first("engine")).toBe("src/diff/engine.ts")
  })

  it("prefers the plainer name where two match the same way", () => {
    // Both hold `file` at the start of a word — one after a slash, one at a
    // capital — so nothing above the tie-break tells them apart, and the
    // tie-break is what a reader typing four letters means.
    expect(first("file")).toBe("src/ui/Files.tsx")
    expect(paths("file")).toContain("src/ui/WholeFile.tsx")
  })

  it("gives a file at the root of a repository a filename like any other", () => {
    expect(first("package")).toBe("package.json")
  })

  it("reads capitals as the starts of words", () => {
    expect(paths("rt").slice(0, 2)).toContain("src/ui/RepoTree.tsx")
  })

  it("prefers characters in a run to the same characters scattered", () => {
    const found = findingFile(["src/ui/Files.tsx", "src/domain/findingFile.ts"], "files")
    expect(found[0]?.path).toBe("src/ui/Files.tsx")
  })

  it("breaks a tie on the shorter path, which is nearly always the one meant", () => {
    const found = findingFile(["a/b/c/d/e/place.ts", "place.ts"], "place")
    expect(found[0]?.path).toBe("place.ts")
  })

  it("says where it landed, so the screen can show why this path is here", () => {
    const [found] = findingFile(["src/ui/place.ts"], "place")
    expect(found?.marks).toEqual([7, 8, 9, 10, 11])
  })

  it("answers with the tree's own order when nothing has been typed", () => {
    expect(paths("")).toEqual(PATHS.slice(0, 14))
    expect(findingFile(PATHS, "   ")).toHaveLength(14)
  })

  it("answers no more than it was asked for", () => {
    expect(findingFile(PATHS, "s", 3)).toHaveLength(3)
  })

  it("lets a reader type a path with slashes in it", () => {
    expect(first("ui/whole")).toBe("src/ui/WholeFile.tsx")
  })

  it("forgives a space, which is a typed slash more often than it is a query", () => {
    expect(first("ui whole")).toBe("src/ui/WholeFile.tsx")
  })
})

describe("the cost of a keystroke", () => {
  /**
   * Not a benchmark and not a threshold anyone should tune against. It is here
   * because the rules above run over every path in a repository on every
   * keypress, and a change that made one of them quadratic would otherwise be
   * found by a reader on a monorepo rather than here.
   */
  it("ranks a repository's worth of paths inside a frame", () => {
    const many = Array.from({ length: 30_000 }, (_, at) =>
      `src/${at % 90}/${at % 30}/component${at}.tsx`
    )

    const started = performance.now()
    const found = findingFile(many, "comp30")
    const spent = performance.now() - started

    expect(found.length).toBeGreaterThan(0)
    expect(spent).toBeLessThan(100)
  })
})
