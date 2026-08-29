import { describe, expect, it } from "bun:test"
import { Option } from "effect"
import type { CardFacts, FileFacts } from "../shared/wire"
import { snapshotFrom } from "./snapshot"

/**
 * The crossing, tested without a window.
 *
 * This is the seam where what the main process read becomes what the interface
 * draws, and it is the one part of the card that cannot be checked by running the
 * app from a terminal: WebKit suspends a webview whose window is covered, so a
 * page nobody can see is a page nobody can ask anything of. Which makes this the
 * place where "the facts are right" — proved against a live pull request by
 * `scripts/try-card.ts` — becomes "the snapshot is right".
 */

const reference = { owner: "cli", repo: "cli", number: 14003 }

const facts = (some: Partial<CardFacts> = {}): CardFacts => ({
  title: "Add a code review agent skill",
  markdown: "It reviews.",
  html: "<p>It reviews.</p>",
  state: "open",
  openedAt: "2026-07-29T10:00:00Z",
  closedAt: null,
  mergedAt: null,
  author: { login: "BagToad", isAutomated: false, faceUrl: "https://faces/bag.png" },
  baseBranch: "trunk",
  headBranch: "bagtoad/update-agents-md",
  headSha: "aa49f0c1111111111111111111111111111111111",
  baseSha: "bb00ff02222222222222222222222222222222222",
  viewerLogin: "flazouh",
  lastReviewPoint: null,
  files: [],
  commits: [],
  threads: [],
  remarks: [],
  checks: [],
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
  },
  ...some
})

const file = (some: Partial<FileFacts> = {}): FileFacts => ({
  path: "AGENTS.md",
  digest: "a4000008b0b542da97681b7b1792f2f0d9dbedd9",
  changeType: "modified",
  linesAdded: 1,
  linesDeleted: 1,
  readByViewer: false,
  content: "here",
  patch: "@@ -10,2 +10,2 @@\n-old line\n+new line",
  ...some
})

describe("a card, built from what the main process read", () => {
  it("carries the pull request itself across", () => {
    const snapshot = snapshotFrom(reference, facts())

    expect(snapshot.reference).toEqual(reference)
    expect(snapshot.title).toBe("Add a code review agent skill")
    expect(snapshot.description).toEqual({ markdown: "It reviews.", html: "<p>It reviews.</p>" })
    expect(snapshot.baseBranch).toBe("trunk")
    expect(snapshot.viewer.login).toBe("flazouh")
    expect(snapshot.author.faceUrl).toEqual(Option.some("https://faces/bag.png"))
    expect(snapshot.openedAt).toEqual(Option.some("2026-07-29T10:00:00Z"))
    expect(snapshot.mergedAt).toEqual(Option.none())
  })

  it("reads a patch that came with the card into lines", () => {
    const [drawn] = snapshotFrom(reference, facts({ files: [file()] })).files
    const diff = Option.getOrThrow(drawn?.diff ?? Option.none())

    expect(diff.isBinary).toBe(false)
    expect(diff.isTruncated).toBe(false)
    expect(diff.lines.map((line) => line.kind)).toEqual(["hunk", "deleted", "added"])
    expect(Option.getOrNull(diff.lines[2]?.afterLine ?? Option.none())).toBe(10)
  })

  /*
   * The three nothings, which have to stay three different things. A file nobody
   * has asked for yet is the only one the browser should go and fetch, so it is
   * the only one that may be `None` — the other two are diffs that exist and have
   * nothing in them, and a `None` there is a file fetched forever.
   */
  it("leaves an unfetched file absent, so the browser goes and asks", () => {
    const [drawn] = snapshotFrom(
      reference,
      facts({ files: [file({ content: "unasked", patch: null })] })
    ).files

    expect(drawn?.diff).toEqual(Option.none())
  })

  it("says a withheld file is truncated rather than absent", () => {
    const [drawn] = snapshotFrom(
      reference,
      facts({ files: [file({ content: "withheld", patch: null })] })
    ).files
    const diff = Option.getOrThrow(drawn?.diff ?? Option.none())

    expect(diff).toEqual({ isBinary: false, isTruncated: true, lines: [] })
  })

  it("says a binary file is binary rather than absent", () => {
    const [drawn] = snapshotFrom(
      reference,
      facts({ files: [file({ content: "binary", patch: null })] })
    ).files
    const diff = Option.getOrThrow(drawn?.diff ?? Option.none())

    expect(diff).toEqual({ isBinary: true, isTruncated: false, lines: [] })
  })

  it("hangs a thread off the line GitHub placed it on", () => {
    const snapshot = snapshotFrom(
      reference,
      facts({
        threads: [
          {
            id: "PRRT_1",
            isResolved: false,
            at: { path: "AGENTS.md", side: "after", line: 146, startLine: 146 },
            comments: [
              {
                author: { login: "williammartin", isAutomated: false, faceUrl: null },
                body: "The wording here is off.",
                html: "<p>The wording here is off.</p>",
                createdAt: "2026-07-29T11:00:00Z"
              }
            ]
          }
        ]
      })
    )

    const [thread] = snapshot.threads
    expect(Option.getOrNull(thread?.at ?? Option.none())?.line).toBe(146)
    expect(thread?.comments[0]?.author.login).toBe("williammartin")
    expect(thread?.comments[0]?.author.faceUrl).toEqual(Option.none())
  })

  /**
   * The merge box, as an answer rather than as a fact.
   *
   * `Option` on the way across because the screen reads it as one: the extension
   * gets this from a route of GitHub's that can fail on its own, and None is how it
   * says nobody told us. This window's wire carries the merge with the card or
   * carries neither, so what it hands over is always an answer — but it has to be
   * shaped like one, and it once was not. A plain state where an `Option` was
   * expected read as None with a value inside it, and the screen threw on the first
   * field it took out: every pull request opened in this window was a blank page.
   */
  const mergeIn = (some: Partial<CardFacts> = {}) =>
    Option.getOrThrow(snapshotFrom(reference, facts(some)).merge)

  it("hands the merge box over as an answer, which is what the screen reads", () => {
    expect(Option.isSome(snapshotFrom(reference, facts()).merge)).toBe(true)
    expect(Option.isSome(snapshotFrom(reference, facts()).reviews)).toBe(true)
  })

  it("offers the merge when GitHub says it would take one", () => {
    const clean = mergeIn()
    expect(clean.isMergeable).toBe(true)
    expect(clean.blockers).toEqual([])
    expect(clean.update).toEqual(Option.none())
  })

  it("counts only the required checks into what is holding it", () => {
    const merge = mergeIn({
      merge: { ...facts().merge, status: "UNSTABLE" },
      checks: [
        { name: "build", state: "failed", isRequired: true, summary: "", url: "", durationSeconds: 3 },
        { name: "lint", state: "failed", isRequired: false, summary: "", url: "", durationSeconds: 1 }
      ]
    })

    expect(merge.blockers.map((one) => one.name)).toEqual(["A check has not passed"])
  })

  it("offers to catch a branch up only while it is behind", () => {
    const merge = mergeIn({
      merge: {
        ...facts().merge,
        status: "BEHIND",
        mayUpdateBranch: false,
        whyNotUpdate: ["INSUFFICIENT_ACCESS"]
      }
    })

    const update = Option.getOrThrow(merge.update)
    expect(update.how).toBe("MERGE")
    expect(update.mayUpdate).toBe(false)
    expect(update.refusal).toEqual(Option.some("INSUFFICIENT_ACCESS"))
    expect(merge.blockers.map((one) => one.name)).toEqual(["Behind the base branch"])
  })

  it("draws a queue only where the repository has one", () => {
    expect(mergeIn().queue).toEqual(Option.none())

    const queued = mergeIn({
      merge: {
        ...facts().merge,
        queue: { waiting: true, position: 3, mayQueue: true, url: "https://github.com/queue" }
      }
    })

    const queue = Option.getOrThrow(queued.queue)
    expect(queue.waiting).toBe(true)
    expect(queue.position).toEqual(Option.some(3))
  })

  /*
   * Nothing signed to hand back, so nothing that pretends to be. The extension
   * gets GitHub's own socket channels off the page and re-reads the card when one
   * says the merge state moved; there is no page here to get them from.
   */
  it("has no live channels to listen on", () => {
    expect(mergeIn().channels).toEqual([])
  })

  /*
   * A stack is one of GitHub's private routes, and the window reads the documented
   * API. None rather than an empty chain: the panel that draws it asks whether there
   * is a stack, and an empty one is a stack of no layers, which no pull request is in.
   */
  it("knows of no stack, the route that answers that not being a documented one", () => {
    expect(mergeIn().stack).toEqual(Option.none())
  })
})
