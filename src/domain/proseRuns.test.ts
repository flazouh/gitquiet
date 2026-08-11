import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { DiffLine, FileDiff } from "../domain/PullRequest"
import { proseRuns } from "./proseRuns"

const line = (kind: DiffLine["kind"], text: string): DiffLine => ({
  kind,
  text,
  beforeLine: Option.none(),
  afterLine: Option.none()
})

const diff = (lines: ReadonlyArray<DiffLine>): FileDiff => ({
  isBinary: false,
  isTruncated: false,
  lines
})

describe("a prose diff, in runs of one kind", () => {
  test("gathers neighbours of the same kind into one document", () => {
    const runs = proseRuns(
      diff([
        line("hunk", "@@ -1,3 +1,4 @@"),
        line("context", " # Title"),
        line("context", " "),
        line("added", "+first"),
        line("added", "+second"),
        line("deleted", "-gone")
      ])
    )

    expect(runs).toEqual([
      { kind: "context", text: "# Title\n" },
      { kind: "added", text: "first\nsecond" },
      { kind: "deleted", text: "gone" }
    ])
  })

  test("starts a new run every time the kind changes", () => {
    const runs = proseRuns(
      diff([line("added", "+a"), line("context", " b"), line("added", "+c")])
    )

    expect(runs.map((run) => run.kind)).toEqual(["added", "context", "added"])
  })

  test("drops the marker column rather than the first character of the prose", () => {
    expect(proseRuns(diff([line("added", "+++ heading")]))[0]?.text).toBe("++ heading")
  })

  test("has nothing to show for a file it cannot read", () => {
    expect(proseRuns({ isBinary: true, isTruncated: false, lines: [] })).toEqual([])
  })
})
