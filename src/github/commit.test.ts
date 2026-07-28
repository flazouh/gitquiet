import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { toCommit } from "./snapshot"

const payload = (commit: Record<string, unknown>, entries: ReadonlyArray<unknown> = []) => ({
  payload: {
    commit: {
      oid: "97ca0ad5edb4c0d55ab94caee136d6273adf63e8",
      authoredDate: "2026-07-25T10:21:12.000Z",
      shortMessage: "fix: restore pi ACP usage plumbing",
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
  test("takes the headline, the face and the moment", async () => {
    const commit = await read(payload({}))

    expect(commit.headline).toBe("fix: restore pi ACP usage plumbing")
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
        shortMessageMarkdown: "<div>test: retain pi ACP usage &amp; updates</div>"
      })
    )

    expect(commit.headline).toBe("test: retain pi ACP usage & updates")
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
