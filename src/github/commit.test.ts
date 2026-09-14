import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { loadFixture } from "../../tests/fixtures"
import { toCommit } from "./snapshot"

const payload = (commit: Record<string, unknown>, entries: ReadonlyArray<unknown> = []) => ({
  payload: {
    commit: {
      oid: "97ca0ad5edb4c0d55ab94caee136d6273adf63e8",
      authoredDate: "2026-07-25T10:21:12.000Z",
      shortMessage: "fix: restore pi RPC usage plumbing",
      bodyMessageHtml: null,
      authors: [
        {
          login: "flazouh",
          displayName: "alex.depape",
          avatarUrl: "https://avatars.githubusercontent.com/u/25705704?v=4"
        }
      ],
      ...commit
    },
    diffEntryData: entries
  }
})

const entry = {
  path: "src/one.ts",
  pathDigest: "digest",
  status: "MODIFIED",
  linesAdded: 2,
  linesDeleted: 1,
  isBinary: false,
  isTooBig: false,
  truncatedReason: null,
  diffLines: [
    { type: "HUNK", text: "@@ -1,2 +1,3 @@", left: 1, right: 1 },
    { type: "ADDITION", text: "+ next", left: 2, right: 2 },
    { type: "DELETION", text: "- was", left: 3, right: 3 }
  ]
}

const read = (raw: unknown) => Effect.runPromise(toCommit(raw))

describe("reading one commit off GitHub's page", () => {
  test("reads the same commit where GitHub moved it, so the page still draws", async () => {
    // Measured on 2026-08-15: their commit page began answering with
    // `payload.commitRoute` around what `payload` held directly, the same move their
    // commit list made that day. Both are read, since a kept answer is still a commit.
    const moved = { payload: { commitRoute: payload({}).payload } }

    const commit = await read(moved)

    expect(commit.headline).toBe("fix: restore pi RPC usage plumbing")
    expect(commit.abbreviatedSha).toBe("97ca0ad")
  })

  test("takes the headline, the face and the moment", async () => {
    const commit = await read(payload({}))

    expect(commit.headline).toBe("fix: restore pi RPC usage plumbing")
    expect(commit.abbreviatedSha).toBe("97ca0ad")
    expect(commit.author).toBe("flazouh")
    expect(Option.getOrNull(commit.avatarUrl)).toContain("avatars.githubusercontent.com")
  })

  test("falls back to the rendered markdown when the plain headline is null", async () => {
    // What GitHub sends for some commits, and what used to make the panel say
    // only "GatewayError".
    const commit = await read(
      payload({
        shortMessage: null,
        shortMessageMarkdown: "<div>test: retain pi RPC usage &amp; updates</div>"
      })
    )

    expect(commit.headline).toBe("test: retain pi RPC usage & updates")
  })

  test("keeps a bot author, whose login GitHub writes with brackets", async () => {
    const commit = await read(
      payload({
        authors: [
          {
            login: "devin-ai-integration[bot]",
            displayName: "Devin AI",
            avatarUrl: "https://avatars.githubusercontent.com/in/811515?v=4"
          }
        ]
      })
    )

    expect(commit.author).toBe("devin-ai-integration[bot]")
  })

  test("brings every file with its diff already attached", async () => {
    const commit = await read(payload({}, [entry]))
    const file = commit.files[0]

    expect(commit.files).toHaveLength(1)
    expect(file?.path).toBe("src/one.ts")
    expect(file?.changeType).toBe("modified")
    expect(file?.linesAdded).toBe(2)
    expect(Option.isSome(file?.diff ?? Option.none())).toBe(true)
    expect(Option.getOrThrow(file?.diff ?? Option.none()).lines.map((line) => line.kind)).toEqual([
      "hunk",
      "added",
      "deleted"
    ])
  })

  test("refuses a payload that is not a commit page at all", async () => {
    await expect(read({ payload: { commit: {} } })).rejects.toBeDefined()
  })
})

describe("a commit whose diffs GitHub holds most of back", () => {
  /**
   * GitHub embeds content for the first few files of a commit and sends the
   * rest as three fields — path, digest, status — exactly as it does on a pull
   * request. A recorded commit touching twenty-two files arrived with eight.
   */
  test("keeps every file, and says which ones arrived without content", async () => {
    const commit = await read(loadFixture("commit"))

    expect(commit.files).toHaveLength(22)
    expect(commit.files.filter((file) => Option.isSome(file.diff))).toHaveLength(8)
    expect(commit.files.filter((file) => Option.isNone(file.diff))).toHaveLength(14)
  })

  test("gives a held-back file its name and nothing it does not know", async () => {
    const commit = await read(loadFixture("commit"))
    const held = commit.files[8]

    expect(held?.path).toBe("packages/ui-shell/src/pickers/item/use-item-picker.ts")
    expect(held?.changeType).toBe("modified")
    expect(Option.isNone(held?.diff ?? Option.none())).toBe(true)
    // Not a claim that nothing changed: GitHub sends no counts for these, and
    // an invented number would read as one.
    expect(held?.linesAdded).toBe(0)
  })
})

/**
 * The commit a file's old half has to be read at.
 *
 * A commit page sends hunks and three lines either side, so revealing the rest
 * means fetching the file twice: the new half at this commit, the old half at
 * its parent. The screen had no parent to read and used this commit for both,
 * which hands the renderer the same file twice — Pierre checks the patch
 * against what it was given and throws `trailing context mismatch
 * (additions=4, deletions=9)` out of the render, taking the pane from thirteen
 * lines to none. Measured on p-limit@f3e7f9b, where a reader expanding index.js
 * watched the diff go blank and Following stop with it.
 */
describe("the commit a diff is against", () => {
  test("carries the parent, which is their own sha1", async () => {
    const commit = await read(payload({ sha1: "aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee" }))

    expect(commit.parentSha).toBe("aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee")
  })

  test("has none for a root commit, which has nothing to diff against", async () => {
    // Every file in one is an addition, so no old half is ever asked for and
    // the absence costs nothing. Sending this commit's own sha instead would
    // be a guess that reads as a fact.
    const commit = await read(payload({ sha1: null }))

    expect(commit.parentSha).toBeUndefined()
  })
})
