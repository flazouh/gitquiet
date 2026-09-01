import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { ListedIssue } from "./issues"
import type { InvolvedPullRequest } from "./workingSet"
import { answers, answersIssue, asked, sieveOf, toggling, undecided, understood } from "./sieve"

const WEEK = 7 * 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-07-30T00:00:00Z")

const one = (over: Partial<InvolvedPullRequest> = {}): InvolvedPullRequest => ({
  reference: { owner: "flazouh", repo: "octo-repo", number: 1457 },
  id: "1457",
  title: "price claude turns from the streamed usage",
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.some("needs-action"),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-29T00:00:00Z",
  changedAt: "2026-07-29T00:00:00Z",
  headSha: "sha1457",
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none(),
  ...over
})

const sifts = (typed: string, row: InvolvedPullRequest, viewer = "flazouh"): boolean =>
  answers(row, sieveOf(typed, viewer), NOW)

const anIssue = (over: Partial<ListedIssue> = {}): ListedIssue => ({
  reference: { owner: "flazouh", repo: "octo-repo", number: 88 },
  id: "I_88",
  title: "the streamed usage is counted twice",
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  comments: 0,
  labels: [],
  raisedAt: "2026-07-29T00:00:00Z",
  ...over
})

describe("what the reader typed into the filter", () => {
  test("nothing typed matches everything", () => {
    expect(sifts("", one())).toBe(true)
    expect(sifts("   ", one())).toBe(true)
  })

  test("plain words match the title, the author and the address", () => {
    expect(sifts("streamed", one())).toBe(true)
    expect(sifts("flazouh", one())).toBe(true)
    expect(sifts("octo-repo#1457", one())).toBe(true)
    expect(sifts("tokenizer", one())).toBe(false)
  })

  test("two words both have to be there, rather than either", () => {
    expect(sifts("price usage", one())).toBe(true)
    expect(sifts("price tokenizer", one())).toBe(false)
  })

  test("a term nobody recognises is read as words, not thrown away", () => {
    // Silently dropping it would answer a question the reader did not ask and
    // show rows they had just excluded — worse than showing nothing and being
    // obviously wrong.
    expect(sifts("priority:high", one())).toBe(false)
    expect(sifts("priority:high", one({ title: "priority:high already" }))).toBe(true)
  })
})

describe("a row the filter cannot judge yet", () => {
  // Checks and review decisions arrive in reads after the rows do, so for a second
  // a list filtered by either is a list of rows that all fail for want of being
  // asked. Telling those two cases apart is what stops the screen announcing that
  // the reader's filter matched nothing.
  const passing = Option.some({
    state: "passing" as const,
    total: 3,
    passed: 3,
    failed: 0,
    running: 0
  })

  test("its checks were asked about before anybody knew them", () => {
    expect(undecided(one(), sieveOf("is:passing"))).toBe(true)
    expect(undecided(one(), sieveOf("is:failing"))).toBe(true)
  })

  test("a row whose checks are known is decided, whichever way it went", () => {
    expect(undecided(one({ checks: passing }), sieveOf("is:passing"))).toBe(false)
    expect(undecided(one({ checks: passing }), sieveOf("is:failing"))).toBe(false)
  })

  test("the same for a review decision, which is read just as late", () => {
    expect(undecided(one(), sieveOf("review:approved"))).toBe(true)
    expect(undecided(one({ reviewed: Option.some("approved") }), sieveOf("review:approved"))).toBe(
      false
    )
  })

  test("nothing is undecided by a filter that never asked about either", () => {
    expect(undecided(one(), sieveOf("author:me is:open is:unread streamed"), )).toBe(false)
    expect(undecided(one(), sieveOf(""))).toBe(false)
  })

  test("a question with no answer is decided, and the answer is no", () => {
    // `author:me is:passing` signed out excludes every row on the author, so there
    // is nothing to wait for and nothing to say about the checks.
    expect(undecided(one(), sieveOf("author:me is:passing", undefined))).toBe(false)
  })
})

describe("filtering by who wrote it", () => {
  test("author: narrows to that login, whatever case it was typed in", () => {
    expect(sifts("author:flazouh", one())).toBe(true)
    expect(sifts("author:FlaZouh", one())).toBe(true)
    expect(sifts("author:octocat", one())).toBe(false)
  })

  test("author:me is whoever GitHub says is here", () => {
    expect(sifts("author:me", one(), "flazouh")).toBe(true)
    expect(sifts("author:me", one(), "octocat")).toBe(false)
  })

  test("two authors mean either of them", () => {
    expect(sifts("author:octocat author:flazouh", one())).toBe(true)
  })

  test("author:me with nobody signed in matches nothing rather than everything", () => {
    expect(answers(one(), sieveOf("author:me", undefined), NOW)).toBe(false)
  })
})

describe("filtering by which repository it is in", () => {
  test("repo: narrows to that repository, named in full or on its own", () => {
    expect(sifts("repo:flazouh/octo-repo", one())).toBe(true)
    expect(sifts("repo:octo-repo", one())).toBe(true)
    expect(sifts("repo:stack-probe", one())).toBe(false)
    expect(sifts("repo:octocat/octo-repo", one())).toBe(false)
  })

  test("the case it was typed in does not matter", () => {
    expect(sifts("repo:FlaZouh/Octo-Repo", one())).toBe(true)
    expect(sifts("repo:OCTO-REPO", one())).toBe(true)
  })

  test("two repositories mean either of them", () => {
    expect(sifts("repo:stack-probe repo:octo-repo", one())).toBe(true)
    expect(sifts("repo:stack-probe repo:flowline", one())).toBe(false)
  })

  test("an issue answers it too, since an issue is in a repository as well", () => {
    expect(answersIssue(anIssue(), sieveOf("repo:flazouh/octo-repo"))).toBe(true)
    expect(answersIssue(anIssue(), sieveOf("repo:octo-repo"))).toBe(true)
    expect(answersIssue(anIssue(), sieveOf("repo:stack-probe"))).toBe(false)
  })

  test("it narrows with the other kinds rather than instead of them", () => {
    expect(sifts("repo:octo-repo author:me", one())).toBe(true)
    expect(sifts("repo:octo-repo author:octocat", one())).toBe(false)
    expect(sifts("repo:stack-probe author:me", one())).toBe(false)
  })

  test("repo: with nothing after it is a word, not a term matching everything", () => {
    expect(sifts("repo:", one())).toBe(false)
  })
})

describe("filtering by where it stands", () => {
  test("is: narrows by state", () => {
    expect(sifts("is:open", one())).toBe(true)
    expect(sifts("is:merged", one())).toBe(false)
    expect(sifts("is:draft", one({ state: "draft" }))).toBe(true)
  })

  test("two states mean either", () => {
    expect(sifts("is:merged is:open", one())).toBe(true)
  })

  test("is:failing asks the rollup, and a row whose checks have not arrived is not one", () => {
    // Absent is not passing. A row that has not been asked about yet showing up
    // under is:passing is the filter guessing on the reader's behalf.
    const failing = one({ checks: Option.some({ state: "failing", total: 13, passed: 11 }) })

    expect(sifts("is:failing", failing)).toBe(true)
    expect(sifts("is:passing", failing)).toBe(false)
    expect(sifts("is:failing", one())).toBe(false)
    expect(sifts("is:passing", one())).toBe(false)
  })

  test("review: narrows by what the reviews came to", () => {
    expect(sifts("review:approved", one({ reviewed: Option.some("approved") }))).toBe(true)
    expect(sifts("review:changes-requested", one({ reviewed: Option.some("approved") }))).toBe(false)
    expect(sifts("review:required", one({ reviewed: Option.some("review-required") }))).toBe(true)
    expect(sifts("review:approved", one())).toBe(false)
  })
})

describe("filtering by what has happened to it", () => {
  test("is:unread is what has changed since the reader last looked", () => {
    expect(sifts("is:unread", one({ readByViewer: false }))).toBe(true)
    expect(sifts("is:unread", one())).toBe(false)
  })

  test("has:comments is one somebody has said something about", () => {
    expect(sifts("has:comments", one({ comments: 3 }))).toBe(true)
    expect(sifts("has:comments", one())).toBe(false)
  })

  test("is:stale is one untouched for a week", () => {
    const old = new Date(NOW - WEEK - 1000).toISOString()

    expect(sifts("is:stale", one({ changedAt: old }))).toBe(true)
    expect(sifts("is:stale", one())).toBe(false)
  })
})

describe("terms of different kinds together", () => {
  test("every kind has to answer, even though a kind is happy with any of its own", () => {
    const mine = one({
      author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
      checks: Option.some({ state: "failing", total: 13, passed: 11 })
    })

    expect(sifts("author:me is:failing", mine)).toBe(true)
    expect(sifts("author:octocat is:failing", mine)).toBe(false)
    expect(sifts("author:me is:passing", mine)).toBe(false)
  })

  test("words and terms in the same box narrow together", () => {
    expect(sifts("streamed author:me", one())).toBe(true)
    expect(sifts("tokenizer author:me", one())).toBe(false)
  })
})

describe("a chip writing into the box the reader is typing in", () => {
  test("asked says whether a term is already there", () => {
    expect(asked("is:open author:me", "author:me")).toBe(true)
    expect(asked("is:open", "author:me")).toBe(false)
    // Not a prefix match: is:open must not answer for is:opened.
    expect(asked("is:opened", "is:open")).toBe(false)
  })

  test("toggling puts a term in and takes the same term out", () => {
    expect(toggling("", "is:failing")).toBe("is:failing")
    expect(toggling("author:me", "is:failing")).toBe("author:me is:failing")
    expect(toggling("author:me is:failing", "is:failing")).toBe("author:me")
    expect(toggling("is:failing", "is:failing")).toBe("")
  })

  test("toggling leaves the words the reader typed exactly where they were", () => {
    expect(toggling("cache the tokenizer is:failing", "is:failing")).toBe("cache the tokenizer")
    expect(toggling("cache the tokenizer", "author:me")).toBe("cache the tokenizer author:me")
  })
})

describe("which of GitHub's terms this box can be filled with", () => {
  test("knows the ones it reads as terms", () => {
    for (const term of [
      "author:aleks",
      "author:me",
      "repo:oven-sh/bun",
      "is:open",
      "is:closed",
      "is:merged",
      "is:draft",
      "is:failing",
      "review:approved",
      "has:comments",
      "is:stale"
    ]) {
      expect(understood(term)).toBe(true)
    }
  })

  test("refuses the ones it would read as words to find in a title", () => {
    // Every one of these is real GitHub search that this box does not speak.
    // Filling the box with one empties the list and blames the reader for it.
    for (const term of [
      "sort:created-asc",
      "label:bug",
      "milestone:v2",
      "project:flowline/3",
      "linked:pr",
      "no:assignee",
      "comments:>5",
      "authr:me"
    ]) {
      expect(understood(term)).toBe(false)
    }
  })

  test("refuses a plain word, which is a word and not a term", () => {
    expect(understood("tokenizer")).toBe(false)
  })
})
