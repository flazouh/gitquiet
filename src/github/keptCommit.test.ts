import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { ChangedFile, CommitDetail } from "../domain/PullRequest"
import { commitFromKept, keptCommitFrom } from "./keptCommit"

/**
 * What is kept of a commit between visits, and what is deliberately not.
 *
 * The store is `chrome.storage.local` and the trip through it is JSON, which is the whole
 * reason this module exists: an `Option` goes in as a tagged object and comes back as one,
 * so a screen reading it with `Option.isSome` reads a shape that only resembles the one it
 * wants. Nulls go in and the `Option`s are built again on the way out.
 */

const file = (path: string, diff: ChangedFile["diff"]): ChangedFile => ({
  path,
  digest: `digest-${path}`,
  changeType: "modified",
  linesAdded: 12,
  linesDeleted: 3,
  readByViewer: false,
  diff
})

const lines = {
  isBinary: false,
  isTruncated: false,
  lines: [
    {
      kind: "hunk" as const,
      text: "@@ -1 +1 @@",
      beforeLine: Option.some(1),
      afterLine: Option.some(1)
    }
  ]
}

const detail: CommitDetail = {
  sha: "9f2c1d4e5a6b7c8d9e0f1a2b3c4d5e6f70819293",
  abbreviatedSha: "9f2c1d4",
  headline: "fix(worker): bound live tail memory",
  bodyHtml: Option.some("<p>and keep it observable</p>"),
  author: "flazouh",
  avatarUrl: Option.some("https://avatars.githubusercontent.com/u/1"),
  createdAt: "2026-08-04T11:31:00Z",
  files: [file("src/daemon/tail.ts", Option.some(lines)), file("src/daemon/tail.test.ts", Option.none())]
}

/** The trip the store actually makes, rather than a promise that it would survive one. */
const throughTheStore = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

describe("a commit kept for the way back to it", () => {
  test("comes back as the commit that went in", () => {
    const back = commitFromKept(throughTheStore(keptCommitFrom(detail)))

    expect(Option.isSome(back)).toBe(true)
    if (Option.isNone(back)) return

    expect(back.value.sha).toBe(detail.sha)
    expect(back.value.headline).toBe(detail.headline)
    expect(back.value.author).toBe(detail.author)
    expect(back.value.createdAt).toBe(detail.createdAt)
    expect(back.value.files.map((one) => one.path)).toEqual([
      "src/daemon/tail.ts",
      "src/daemon/tail.test.ts"
    ])
  })

  test("builds the options again, rather than handing back what JSON made of them", () => {
    const back = commitFromKept(throughTheStore(keptCommitFrom(detail)))
    if (Option.isNone(back)) throw new Error("nothing came back")

    expect(Option.getOrNull(back.value.bodyHtml)).toBe("<p>and keep it observable</p>")
    expect(Option.getOrNull(back.value.avatarUrl)).toBe(
      "https://avatars.githubusercontent.com/u/1"
    )
  })

  /*
   * The commit's facts are a few hundred bytes and its diffs are most of a megabyte on a
   * commit of any size, which is the wrong trade for a store shared with every other page.
   * Every file comes back as a name, which is the shape GitHub itself sends for the files
   * past its byte budget — so the screen fills them in through the path it already has for
   * exactly that, and the tree and the header are on the screen while it does.
   */
  test("keeps the names of the files and not the diffs behind them", () => {
    const kept = throughTheStore(keptCommitFrom(detail))
    const back = commitFromKept(kept)
    if (Option.isNone(back)) throw new Error("nothing came back")

    expect(back.value.files.every((one) => Option.isNone(one.diff))).toBe(true)
    expect(JSON.stringify(kept)).not.toContain("@@ -1 +1 @@")
  })

  test("says nothing at all about an entry written by an older version of this extension", () => {
    expect(Option.isNone(commitFromKept({ sha: 4, files: "several" }))).toBe(true)
    expect(Option.isNone(commitFromKept(undefined))).toBe(true)
    expect(Option.isNone(commitFromKept({ sha: "9f2c1d4", files: [{}] }))).toBe(true)
  })
})
