import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { parsePatchFiles } from "@pierre/diffs"
import type { ChangedFile, DiffLine, DiffLineKind } from "../domain/PullRequest"
import { toPatch } from "./toPatch"

const line = (kind: DiffLineKind, text: string): DiffLine => ({
  kind,
  text,
  beforeLine: Option.none(),
  afterLine: Option.none()
})

const changed = (path: string, lines: ReadonlyArray<DiffLine>): ChangedFile => ({
  path,
  digest: "digest",
  changeType: "modified",
  linesAdded: 1,
  linesDeleted: 1,
  readByViewer: false,
  diff: Option.some({ isBinary: false, isTruncated: false, lines })
})

const aChange = () =>
  changed("src/spin.ts", [
    line("hunk", "@@ -1,3 +1,3 @@"),
    line("context", " const wheel = true"),
    line("deleted", "-const speed = 1"),
    line("added", "+const speed = 2"),
    line("context", " export { wheel, speed }")
  ])

describe("handing a changed file to a diff renderer", () => {
  test("names both sides of the file, which is how a patch says which file it is", () => {
    const patch = Option.getOrThrow(toPatch(aChange()))

    expect(patch).toContain("diff --git a/src/spin.ts b/src/spin.ts")
    expect(patch).toContain("--- a/src/spin.ts")
    expect(patch).toContain("+++ b/src/spin.ts")
  })

  test("keeps GitHub's own line prefixes, which are already a patch's", () => {
    const patch = Option.getOrThrow(toPatch(aChange()))

    expect(patch).toContain("\n@@ -1,3 +1,3 @@\n")
    expect(patch).toContain("\n-const speed = 1\n")
    expect(patch).toContain("\n+const speed = 2\n")
  })

  test("parses as the one file it describes", () => {
    const [parsed] = parsePatchFiles(Option.getOrThrow(toPatch(aChange())), "src/spin.ts", true)

    expect(parsed?.files).toHaveLength(1)
    expect(parsed?.files[0]?.name).toBe("src/spin.ts")
  })

  test("says nothing when GitHub sent no content for the file", () => {
    const withoutContent: ChangedFile = { ...aChange(), diff: Option.none() }

    expect(Option.isNone(toPatch(withoutContent))).toBe(true)
  })

  test("says nothing for a binary file, which has no lines to show", () => {
    const binary: ChangedFile = {
      ...aChange(),
      diff: Option.some({ isBinary: true, isTruncated: false, lines: [] })
    }

    expect(Option.isNone(toPatch(binary))).toBe(true)
  })

  test("names the file it was renamed from, so the diff reads as a move", () => {
    const renamed: ChangedFile = { ...aChange(), changeType: "renamed" }

    const patch = Option.getOrThrow(toPatch(renamed, "src/rotate.ts"))

    expect(patch).toContain("diff --git a/src/rotate.ts b/src/spin.ts")
    expect(patch).toContain("--- a/src/rotate.ts")
    expect(patch).toContain("+++ b/src/spin.ts")
  })
})
