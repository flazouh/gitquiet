import { describe, expect, test } from "bun:test"

import { answeringOf, courtOf, docketsOf, type ListedDiscussion } from "./discussions"
import type { Home } from "./discussionRoutes"

const nextjs: Home = { kind: "repository", owner: "vercel", repo: "next.js" }

const row = (over: Partial<ListedDiscussion> = {}): ListedDiscussion => ({
  reference: { home: nextjs, number: 70178 },
  id: "D_kwDOBC3Cis4Abtsx",
  title: "High Memory Usage by next-server process.",
  url: "/vercel/next.js/discussions/70178",
  category: { name: "Help", slug: "help", emoji: { kind: "text", text: "🎓" } },
  answerable: true,
  answered: false,
  closed: false,
  locked: false,
  upvotes: 9,
  comments: 9,
  labels: [],
  author: "ShivamArora",
  askedAt: "2024-09-17T08:29:25Z",
  participants: [],
  ...over
})

describe("what a discussion is waiting for", () => {
  test("a Question with replies and no Answer is Stale, which is 94 of 120 real rows", () => {
    expect(answeringOf(row({ answerable: true, answered: false, comments: 9 }))).toBe("stale")
  })

  test("a Question nobody has replied to is waiting for somebody to write one", () => {
    expect(answeringOf(row({ answerable: true, answered: false, comments: 0 }))).toBe("unanswered")
  })

  test("a marked Answer is an Answer whatever else is in the thread", () => {
    expect(answeringOf(row({ answerable: true, answered: true, comments: 2 }))).toBe("answered")
  })

  /*
   * Six of `vercel/next.js`'s nine categories take no answers. Their rows carry no state at all,
   * and the absence is a fact rather than a gap: an Idea is not an unanswered question.
   */
  test("a category that takes no answers is not a Question", () => {
    expect(answeringOf(row({ answerable: false, answered: false, comments: 0 }))).toBe(
      "unanswerable"
    )
    expect(answeringOf(row({ answerable: false, answered: false, comments: 40 }))).toBe(
      "unanswerable"
    )
  })
})

describe("which Court a discussion sits in", () => {
  test("Stale is Needs You, because somebody has to point at the answer already there", () => {
    expect(courtOf(row({ comments: 9 }))).toBe("needs-you")
  })

  test("a question nobody has answered is Waiting, because somebody else has to speak", () => {
    expect(courtOf(row({ comments: 0 }))).toBe("waiting")
  })

  test("an answered question is Settled", () => {
    expect(courtOf(row({ answered: true }))).toBe("settled")
  })

  test("a category that takes no answers is Settled, because nothing is owed on it", () => {
    expect(courtOf(row({ answerable: false, comments: 40 }))).toBe("settled")
  })

  /*
   * Locked beats every other reading. A locked thread with nine replies and nothing marked is
   * exactly the row Needs You is for, and there is nothing a reader can do to it.
   */
  test("locked is Settled even where the same row unlocked would need you", () => {
    expect(courtOf(row({ locked: true, comments: 9 }))).toBe("settled")
    expect(courtOf(row({ locked: true, comments: 0 }))).toBe("settled")
  })

  /*
   * Their own rows print "· Closed · Unanswered" together, so the two facts arrive together and
   * one of them has to win. Closed wins: nobody is going to answer a question somebody ended.
   */
  test("closed is Settled, including the closed question nobody answered", () => {
    expect(courtOf(row({ closed: true, comments: 9 }))).toBe("settled")
    expect(courtOf(row({ closed: true, comments: 0 }))).toBe("settled")
    expect(courtOf(row({ closed: true, answerable: false }))).toBe("settled")
  })

  /*
   * Closing does not mark an answer, so the Answering of a closed Question is unchanged. The
   * Court is where the two facts meet, and this is what keeps them from being folded into one.
   */
  test("closing does not answer, so the Answering of a closed question is still Stale", () => {
    expect(answeringOf(row({ closed: true, comments: 9 }))).toBe("stale")
  })

  test("Running is never returned, because no machine works on a discussion", () => {
    const every = [
      row({ comments: 9 }),
      row({ comments: 0 }),
      row({ answered: true }),
      row({ answerable: false }),
      row({ locked: true }),
      row({ closed: true })
    ]

    expect(every.map(courtOf)).not.toContain("running")
  })
})

describe("filing a page of rows into Courts", () => {
  test("draws three headings and never a fourth, because no discussion runs", () => {
    expect(docketsOf([]).map((one) => one.court)).toEqual(["needs-you", "waiting", "settled"])
  })

  test("keeps an empty Court, so Settled stays where the reader learnt it was", () => {
    const dockets = docketsOf([row({ comments: 9 })])

    expect(dockets.map((one) => one.count)).toEqual([1, 0, 0])
    expect(dockets[1]?.rows).toEqual([])
  })

  /*
   * GitHub sorted the page, or the reader did with `sort:top`. Filing changes which rows sit
   * together and nothing else, so the order inside a pile is theirs.
   */
  test("keeps their order inside each pile", () => {
    const first = row({ reference: { home: { kind: "repository", owner: "a", repo: "b" }, number: 3 }, comments: 9 })
    const second = row({ reference: { home: { kind: "repository", owner: "a", repo: "b" }, number: 2 }, answered: true })
    const third = row({ reference: { home: { kind: "repository", owner: "a", repo: "b" }, number: 1 }, comments: 4 })

    const dockets = docketsOf([first, second, third])

    expect(dockets[0]?.rows.map((one) => one.reference.number)).toEqual([3, 1])
    expect(dockets[2]?.rows.map((one) => one.reference.number)).toEqual([2])
  })

  test("files every row exactly once", () => {
    const rows = [
      row({ comments: 9 }),
      row({ comments: 0 }),
      row({ answered: true }),
      row({ answerable: false }),
      row({ closed: true })
    ]

    const filed = docketsOf(rows).reduce((sum, one) => sum + one.count, 0)

    expect(filed).toBe(rows.length)
  })
})
