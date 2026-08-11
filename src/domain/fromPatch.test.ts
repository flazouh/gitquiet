import { describe, expect, it } from "bun:test"
import { Option } from "effect"
import { fromPatch } from "./fromPatch"
import type { ChangedFile } from "./PullRequest"
import { toPatch } from "./toPatch"

const numbered = (lines: ReadonlyArray<ReturnType<typeof fromPatch>[number]>) =>
  lines.map((line) => [
    line.kind,
    Option.getOrNull(line.beforeLine),
    Option.getOrNull(line.afterLine),
    line.text
  ])

describe("fromPatch", () => {
  it("counts both sides from the hunk header", () => {
    const lines = fromPatch(
      ["@@ -10,4 +10,5 @@ const greet = () => {", ' say("hello")', "-  old()", "+  new()", "+  more()", " }"].join(
        "\n"
      )
    )

    expect(numbered(lines)).toEqual([
      ["hunk", null, null, "@@ -10,4 +10,5 @@ const greet = () => {"],
      ["context", 10, 10, ' say("hello")'],
      ["deleted", 11, null, "-  old()"],
      ["added", null, 11, "+  new()"],
      ["added", null, 12, "+  more()"],
      ["context", 12, 13, " }"]
    ])
  })

  it("starts counting again at every hunk", () => {
    const lines = fromPatch(
      ["@@ -1,2 +1,2 @@", "-one", "+uno", "@@ -40,2 +40,2 @@", "-forty", "+cuarenta"].join("\n")
    )

    expect(numbered(lines)).toEqual([
      ["hunk", null, null, "@@ -1,2 +1,2 @@"],
      ["deleted", 1, null, "-one"],
      ["added", null, 1, "+uno"],
      ["hunk", null, null, "@@ -40,2 +40,2 @@"],
      ["deleted", 40, null, "-forty"],
      ["added", null, 40, "+cuarenta"]
    ])
  })

  it("reads a one-line side, which is written without a count", () => {
    const lines = fromPatch(["@@ -1 +1 @@", "-before", "+after"].join("\n"))

    expect(numbered(lines)).toEqual([
      ["hunk", null, null, "@@ -1 +1 @@"],
      ["deleted", 1, null, "-before"],
      ["added", null, 1, "+after"]
    ])
  })

  it("keeps a blank context line, which arrives as one space", () => {
    const lines = fromPatch(["@@ -1,3 +1,3 @@", " top", " ", "-bottom", "+floor"].join("\n"))

    expect(numbered(lines)).toEqual([
      ["hunk", null, null, "@@ -1,3 +1,3 @@"],
      ["context", 1, 1, " top"],
      ["context", 2, 2, " "],
      ["deleted", 3, null, "-bottom"],
      ["added", null, 3, "+floor"]
    ])
  })

  it("drops the file header a patch may begin with", () => {
    const lines = fromPatch(
      [
        "diff --git a/src/one.ts b/src/one.ts",
        "--- a/src/one.ts",
        "+++ b/src/one.ts",
        "@@ -1 +1 @@",
        "-old",
        "+new"
      ].join("\n")
    )

    expect(lines.map((line) => line.kind)).toEqual(["hunk", "deleted", "added"])
  })

  it("drops the note about a missing final newline", () => {
    const lines = fromPatch(
      ["@@ -1,2 +1,2 @@", "-old", "\\ No newline at end of file", "+new", "\\ No newline at end of file"].join(
        "\n"
      )
    )

    expect(numbered(lines)).toEqual([
      ["hunk", null, null, "@@ -1,2 +1,2 @@"],
      ["deleted", 1, null, "-old"],
      ["added", null, 1, "+new"]
    ])
  })

  it("drops the trailing blank a patch ends with", () => {
    const lines = fromPatch("@@ -1 +1 @@\n-old\n+new\n")

    expect(lines).toHaveLength(3)
  })

  it("says nothing about a file with no patch", () => {
    expect(fromPatch("")).toEqual([])
  })

  it("round-trips what toPatch writes", () => {
    const patch = [
      "@@ -10,4 +10,5 @@ const greet = () => {",
      ' say("hello")',
      "-  old()",
      "+  new()",
      " }"
    ].join("\n")

    const file: ChangedFile = {
      path: "src/greet.ts",
      digest: "abc",
      changeType: "modified",
      linesAdded: 1,
      linesDeleted: 1,
      readByViewer: false,
      diff: Option.some({ isBinary: false, isTruncated: false, lines: fromPatch(patch) })
    }

    const written = Option.getOrThrow(toPatch(file))
    expect(fromPatch(written)).toEqual(fromPatch(patch))
    expect(written).toContain(patch)
  })
})
