import { describe, expect, it } from "bun:test"
import type { CardFacts, WorkingSetRow } from "../shared/wire"
import { keepCard, keepRows, keptCard, keptRows, type Somewhere } from "./kept"

/** A `localStorage` with nothing around it, which is all these functions need. */
const somewhere = (): Somewhere & { readonly held: Map<string, string> } => {
  const held = new Map<string, string>()
  return {
    held,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
    removeItem: (key) => void held.delete(key)
  }
}

const row = (number: number): WorkingSetRow => ({
  id: String(number),
  owner: "cli",
  repo: "cli",
  number,
  title: `Something ${number}`,
  authorLogin: "someone",
  authorIsBot: false,
  authorFaceUrl: null,
  state: "open",
  viewerIsAuthor: true,
  askedOfViewer: false,
  askedOfTeam: false,
  inMergeQueue: false,
  reviewed: null,
  checks: null,
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-02T00:00:00Z",
  headSha: "abc",
  baseBranch: "trunk",
  headBranch: "work",
  added: 1,
  deleted: 2
})

const facts = (): CardFacts => ({
  title: "A change",
  markdown: "why",
  html: "<p>why</p>",
  state: "open",
  openedAt: "2026-07-01T00:00:00Z",
  closedAt: null,
  mergedAt: null,
  author: { login: "someone", isAutomated: false, faceUrl: null },
  baseBranch: "trunk",
  headBranch: "work",
  headSha: "abc",
  baseSha: "def",
  viewerLogin: "someone",
  lastReviewPoint: null,
  files: [
    {
      path: "src/one.ts",
      digest: "one",
      changeType: "modified",
      linesAdded: 2,
      linesDeleted: 1,
      readByViewer: false,
      content: "here",
      patch: "@@ -1 +1,2 @@\n a\n+b"
    },
    {
      path: "src/two.bin",
      digest: "two",
      changeType: "added",
      linesAdded: 0,
      linesDeleted: 0,
      readByViewer: false,
      content: "binary",
      patch: null
    }
  ],
  commits: [],
  checks: [],
  threads: [],
  remarks: [],
  reviews: [],
  merge: {
    ways: ["MERGE", "SQUASH", "REBASE"],
    mergeable: "MERGEABLE",
    status: "CLEAN",
    mayBypass: false,
    mayUpdateBranch: false,
    whyNotUpdate: [],
    autoMerge: null,
    queue: null
  }
})

const where = { owner: "cli", repo: "cli", number: 1 }

describe("what the window remembers", () => {
  it("has nothing to say on a first run", () => {
    expect(keptRows(somewhere())).toBeNull()
    expect(keptCard(where, somewhere())).toBeNull()
  })

  it("gives back the rows it was given", () => {
    const held = somewhere()
    keepRows([row(1), row(2)], held)

    expect(keptRows(held)?.map((one) => one.number)).toEqual([1, 2])
  })

  it("keeps a card without the file content, and says the content is unasked", () => {
    const held = somewhere()
    keepCard(where, facts(), held)

    const back = keptCard(where, held)
    expect(back?.title).toBe("A change")
    expect(back?.files.map((one) => one.path)).toEqual(["src/one.ts", "src/two.bin"])
    expect(back?.files.map((one) => one.patch)).toEqual([null, null])
    // The first was embedded and is now something to ask for; the second is binary
    // and there is nothing to ask for. A remembered card must not claim otherwise.
    expect(back?.files.map((one) => one.content)).toEqual(["unasked", "binary"])
  })

  it("forgets the oldest card once twelve are kept", () => {
    const held = somewhere()
    for (let number = 1; number <= 13; number += 1) {
      keepCard({ owner: "cli", repo: "cli", number }, facts(), held)
    }

    expect(keptCard({ owner: "cli", repo: "cli", number: 1 }, held)).toBeNull()
    expect(keptCard({ owner: "cli", repo: "cli", number: 13 }, held)).not.toBeNull()
  })

  it("keeps the twelve most recently opened, not the first twelve", () => {
    const held = somewhere()
    for (let number = 1; number <= 12; number += 1) {
      keepCard({ owner: "cli", repo: "cli", number }, facts(), held)
    }

    // Opened again, which should move it to the front of the queue and leave the
    // second one as the oldest.
    keepCard({ owner: "cli", repo: "cli", number: 1 }, facts(), held)
    keepCard({ owner: "cli", repo: "cli", number: 99 }, facts(), held)

    expect(keptCard({ owner: "cli", repo: "cli", number: 1 }, held)).not.toBeNull()
    expect(keptCard({ owner: "cli", repo: "cli", number: 2 }, held)).toBeNull()
  })

  it("ignores what an older build wrote", () => {
    const held = somewhere()
    held.held.set(
      "gitquiet.kept.rows",
      JSON.stringify({ shape: 0, at: "2026-07-01T00:00:00Z", it: [row(1)] })
    )

    expect(keptRows(held)).toBeNull()
  })

  it("ignores what nothing can parse", () => {
    const held = somewhere()
    held.held.set("gitquiet.kept.rows", "{ this is not JSON")

    expect(keptRows(held)).toBeNull()
  })

  it("says nothing when storage is full", () => {
    const full: Somewhere = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError")
      },
      removeItem: () => {}
    }

    expect(() => keepRows([row(1)], full)).not.toThrow()
    expect(() => keepCard(where, facts(), full)).not.toThrow()
  })
})
