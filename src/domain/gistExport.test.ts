import { describe, expect, test } from "bun:test"
import type { KeptGists } from "./gistLabels"
import type { GistRow } from "./gistList"
import { exported } from "./gistExport"

const row = (over: Partial<GistRow> = {}): GistRow => ({
  id: "aaa111",
  owner: "octocat",
  title: "deploy-notes.md",
  description: "Notes on staging",
  preview: "Run migrations first",
  secret: true,
  updatedAt: "2026-08-27T00:09:42+02:00",
  files: 1,
  forks: 0,
  comments: 0,
  stars: 0,
  ...over
})

const AT = new Date("2026-09-02T12:00:00Z")

describe("a reader's gists, written out as a file they keep", () => {
  test("carries every gist, with a link back to each", () => {
    const found = exported([row(), row({ id: "bbb222" })], new Map(), true, AT)

    expect(found.gists.length).toBe(2)
    expect(found.gists[0]?.url).toBe("https://gist.github.com/octocat/aaa111")
    expect(found.exportedAt).toBe("2026-09-02T12:00:00.000Z")
  })

  test("carries the two fields GitHub could never export", () => {
    // Because GitHub does not have them. This is the only copy either has ever had.
    const kept: KeptGists = new Map([["aaa111", { labels: ["work"], name: "Runbook" }]])
    const found = exported([row()], kept, true, AT)

    expect(found.gists[0]).toMatchObject({ name: "Runbook", labels: ["work"] })
  })

  test("says nothing about a gist the reader never marked", () => {
    const found = exported([row()], new Map(), true, AT)

    expect(found.gists[0]).toMatchObject({ name: null, labels: [] })
  })

  test("says when the list it was written from was short", () => {
    // A reader who exported half their gists and was not told is a reader with a backup
    // that is wrong in the one way a backup must never be wrong.
    expect(exported([row()], new Map(), false, AT).whole).toBe(false)
  })

  test("calls the content a preview, because that is what it is", () => {
    // The list page carries a preview of each gist and not the whole of it. A reader
    // told this was a backup of their files would find out at the worst moment.
    const found = exported([row()], new Map(), true, AT)

    expect(found.gists[0]?.preview).toBe("Run migrations first")
    expect(Object.keys(found.gists[0] ?? {})).not.toContain("content")
  })
})
