import { describe, expect, test } from "bun:test"
import { addressOf, lookingAt } from "./lookingAt"

describe("writing where the reader is into an address", () => {
  test("names the file on its own", () => {
    expect(addressOf({ path: "src/ui/Files.tsx" })).toBe("#src/ui/Files.tsx")
  })

  test("names one line after it", () => {
    expect(addressOf({ path: "src/one.ts", lines: { half: "R", from: 42, to: 42 } })).toBe(
      "#src/one.ts:R42"
    )
  })

  test("names a run as the two ends of it", () => {
    expect(addressOf({ path: "src/one.ts", lines: { half: "L", from: 7, to: 11 } })).toBe(
      "#src/one.ts:L7-11"
    )
  })

  test("keeps the slashes and escapes what a fragment cannot hold", () => {
    expect(addressOf({ path: "docs/a b.md" })).toBe("#docs/a%20b.md")
  })

  test("says nothing where there is nowhere", () => {
    expect(addressOf(null)).toBe("")
    expect(addressOf({ path: "" })).toBe("")
  })
})

describe("reading where an address is pointing", () => {
  test("comes back the way it went in", () => {
    for (const at of [
      { path: "src/ui/Files.tsx" },
      { path: "src/one.ts", lines: { half: "R" as const, from: 42, to: 42 } },
      { path: "src/one.ts", lines: { half: "L" as const, from: 7, to: 11 } },
      { path: "docs/a b.md" }
    ]) {
      expect(lookingAt(addressOf(at))).toEqual(at)
    }
  })

  test("reads a fragment with no hash in front of it", () => {
    expect(lookingAt("src/one.ts")).toEqual({ path: "src/one.ts" })
  })

  test("leaves a colon that is part of the name in the name", () => {
    expect(lookingAt("#odd:name.ts")).toEqual({ path: "odd:name.ts" })
  })

  test("divides on the last colon, not the first", () => {
    expect(lookingAt("#odd:name.ts:R9")).toEqual({
      path: "odd:name.ts",
      lines: { half: "R", from: 9, to: 9 }
    })
  })

  test("takes a run written backwards as the run it is", () => {
    expect(lookingAt("#src/one.ts:R11-7")).toEqual({
      path: "src/one.ts",
      lines: { half: "R", from: 7, to: 11 }
    })
  })

  test("says nothing about a fragment that is somebody else's", () => {
    // A pull request's fragment is usually GitHub's: their own file anchors, a
    // comment, a heading in the description. Opening the ninth file because a
    // reader followed a link to a comment is worse than opening the first.
    expect(lookingAt("#diff-abc123R42")).toBeNull()
    expect(lookingAt("#issuecomment-99")).toBeNull()
    expect(lookingAt("#")).toBeNull()
    expect(lookingAt("")).toBeNull()
  })

  test("says nothing about escaping it cannot read", () => {
    expect(lookingAt("#100%")).toBeNull()
  })
})
