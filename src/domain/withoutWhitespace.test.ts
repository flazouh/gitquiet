import { describe, expect, it } from "bun:test"
import { withoutWhitespace } from "./withoutWhitespace"

/** A patch, written the way the tests want to read one. */
const patch = (...lines: ReadonlyArray<string>) =>
  ["diff --git a/one.ts b/one.ts", "--- a/one.ts", "+++ b/one.ts", ...lines, ""].join("\n")

describe("dropping changes that are only whitespace", () => {
  it("turns a re-indented line back into context", () => {
    const before = patch(
      "@@ -1,3 +1,3 @@",
      " const a = 1",
      "-  return a",
      "+    return a",
      "-const b = 2",
      "+const b = 3"
    )

    expect(withoutWhitespace(before)).toBe(
      patch("@@ -1,3 +1,3 @@", " const a = 1", "     return a", "-const b = 2", "+const b = 3")
    )
  })

  it("keeps the new text, since that is what the file says now", () => {
    // The reader is looking at the file as it stands, so a line held as context
    // has to be the version that is in it. Keeping the old one would show them
    // code that is no longer there and call it unchanged.
    const kept = withoutWhitespace(
      patch("@@ -1,3 +1,3 @@", "-\tconst a = 1", "+  const a = 1", "+added")
    )

    expect(kept).toContain("   const a = 1")
    expect(kept).not.toContain("\tconst a = 1")
  })

  it("counts a trailing space as whitespace", () => {
    expect(withoutWhitespace(patch("@@ -1,1 +1,1 @@", "-const a = 1  ", "+const a = 1"))).toBe("")
  })

  it("leaves a real change alone", () => {
    const before = patch("@@ -1,2 +1,2 @@", " const a = 1", "-const b = 2", "+const b = 3")

    expect(withoutWhitespace(before)).toBe(before)
  })

  it("keeps the real change in a block that is half whitespace", () => {
    const before = patch(
      "@@ -1,4 +1,4 @@",
      " top",
      "-  first",
      "-  second",
      "+    first",
      "+    changed",
      " bottom"
    )

    expect(withoutWhitespace(before)).toBe(
      patch("@@ -1,4 +1,4 @@", " top", "     first", "-  second", "+    changed", " bottom")
    )
  })

  it("does not treat an added blank line as whitespace", () => {
    // Both sides normalise to nothing, which is exactly the trap: an added
    // empty line is a change to the file, and a rule that compares only the
    // ink would swallow it.
    const before = patch("@@ -1,1 +1,2 @@", " const a = 1", "+")

    expect(withoutWhitespace(before)).toBe(before)
  })

  it("rewrites the hunk header to the lines that are left", () => {
    const before = patch(
      "@@ -10,4 +10,5 @@ inside something",
      " top",
      "-  first",
      "+    first",
      "+added",
      " bottom"
    )

    expect(withoutWhitespace(before)).toBe(
      patch("@@ -10,3 +10,4 @@ inside something", " top", "     first", "+added", " bottom")
    )
  })

  it("drops a hunk that has nothing left to show", () => {
    const before = patch(
      "@@ -1,1 +1,1 @@",
      "-  only spacing",
      "+    only spacing",
      "@@ -20,2 +20,2 @@",
      " kept",
      "-real",
      "+change"
    )

    expect(withoutWhitespace(before)).toBe(
      patch("@@ -20,2 +20,2 @@", " kept", "-real", "+change")
    )
  })

  it("gives back nothing when a whole file only moved sideways", () => {
    // The caller says "only whitespace changed" rather than drawing an empty
    // file, so there has to be a way to tell the two apart.
    expect(withoutWhitespace(patch("@@ -1,1 +1,1 @@", "-  a", "+a"))).toBe("")
  })

  it("leaves a block alone when a newline marker is inside it", () => {
    // `\ No newline at end of file` is a note about the line above it, and a
    // line converted to context takes the note with it into a lie.
    const before = patch(
      "@@ -1,1 +1,1 @@",
      "-  a",
      "\\ No newline at end of file",
      "+    a"
    )

    expect(withoutWhitespace(before)).toBe(before)
  })

  it("leaves a patch with no hunks as it found it", () => {
    expect(withoutWhitespace("")).toBe("")
  })
})
