import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { loadFixture } from "../../tests/fixtures"
import { commitsOf, withMarks } from "../domain/commitList"
import { historyFrom, marksFrom } from "./commits"

/** Their commit list's answer for `flazouh/githubpro`'s `main`, as it arrived. */
const said = loadFixture("branch-commits")

/**
 * And the same route on `react/react`, whose commits all landed as pull requests.
 *
 * A second capture rather than an edit of the first: every commit in this
 * repository is pushed straight to the branch, so nothing in it exercises the
 * number a squash writes, and a fixture with one typed into it would be a test
 * of what this file expects rather than of what GitHub sends.
 */
const landed = loadFixture("branch-commits-landed")

/** What their deferred route answered about exactly those commits. */
const deferred = loadFixture("deferred-commit-data")

const read = () => Effect.runPromise(historyFrom(said))
const readLanded = () => Effect.runPromise(historyFrom(landed))
const readMarks = () => Effect.runPromise(marksFrom(deferred))

describe("reading a branch's commits off GitHub's own list", () => {
  test("says which branch it read, so a page that named none still says", async () => {
    const history = await read()

    expect(history.branch).toBe("main")
  })

  test("keeps their days, which are written in the reader's own time zone", async () => {
    const history = await read()

    expect(history.days.map((day) => day.title)).toEqual(["Aug 2, 2026", "Aug 1, 2026", "Jul 31, 2026"])
  })

  test("keeps every commit of every day, in the order they landed", async () => {
    const history = await read()

    expect(commitsOf(history)).toHaveLength(9)
  })

  test("reads a commit as a headline, a sha and when it happened", async () => {
    const [first] = commitsOf(await read())

    expect(first?.headline).toBe("The window's view follows the interface it shares")
    expect(first?.sha).toBe("3f129342dd97adb96cdf2bd2e2f9e815812213dd")
    expect(first?.abbreviatedSha).toBe("3f12934")
    expect(first?.createdAt).toBe("2026-08-02T00:34:19.000+02:00")
  })

  test("keeps everybody a commit is attributed to, not the first of them", async () => {
    // Every commit here was written by a person and an agent together. A row
    // naming one of the two names the wrong one about half the time.
    const [first] = commitsOf(await read())

    expect(first?.authors.map((one) => one.login)).toEqual(["flazouh", "cursoragent"])
  })

  test("carries their faces, which is what the row draws instead of a login", async () => {
    const [first] = commitsOf(await read())

    expect(first?.authors.every((one) => Option.isSome(one.faceUrl))).toBe(true)
  })

  test("carries the rest of the message where one was written", async () => {
    const [first] = commitsOf(await read())

    expect(Option.isSome(first?.bodyHtml ?? Option.none())).toBe(true)
  })

  test("takes their cursor for the older ones, since they said there are older ones", async () => {
    const history = await read()

    expect(history.older).toEqual(Option.some("3f129342dd97adb96cdf2bd2e2f9e815812213dd 34"))
  })

  test("offers no way back from the newest page, which is where this one is", async () => {
    // GitHub sends a `startCursor` on the first page too, pointing at the page
    // being read. A Newer button built from it is a button that goes nowhere.
    const history = await read()

    expect(history.newer).toEqual(Option.none())
  })

  test("carries their address for the rest of what they know about this page", async () => {
    // Theirs arrives with the repository on the front of it, and every route this
    // gateway reads is written from the repository onwards. Left whole, it was
    // asked for as `/flazouh/githubpro/flazouh/githubpro/commits/…`, which GitHub
    // answers with their 404 page and the marks never arrived.
    const history = await read()

    expect(history.rest).toEqual(
      Option.some("/commits/deferred_commit_data/main?original_branch=main")
    )
  })

  test("names no committer where GitHub says the committer is the author", async () => {
    // Which is nearly every commit. Their `web-flow` sits here on every squashed
    // merge in every repository, and a row naming it names a machine.
    const [first] = commitsOf(await read())

    expect(first?.committer).toEqual(Option.none())
  })

  test("refuses a payload that is not theirs, rather than inventing commits", async () => {
    const outcome = await Effect.runPromise(
      historyFrom({ payload: { commitGroups: [{ title: "Today" }] } }).pipe(
        Effect.map(() => "decoded" as const),
        Effect.catch(() => Effect.succeed("refused" as const))
      )
    )

    expect(outcome).toBe("refused")
  })
})

describe("the pull request each commit landed as", () => {
  test("reads the number out of the subject their squash wrote", async () => {
    const [first] = commitsOf(await readLanded())

    expect(first?.headline).toBe("[Fiber] Collect Host Singleton children of Fragments (#37063)")
    expect(first?.pullRequest).toEqual(Option.some(37063))
  })

  test("finds one on every commit of a repository that works that way", async () => {
    const every = commitsOf(await readLanded())

    expect(every.every((one) => Option.isSome(one.pullRequest))).toBe(true)
  })

  test("finds none in a repository whose work is pushed straight to the branch", async () => {
    const every = commitsOf(await read())

    expect(every.every((one) => Option.isNone(one.pullRequest))).toBe(true)
  })
})

describe("the second read, which answers what their own list defers", () => {
  test("says how the whole run of checks came out, in their own words", async () => {
    const marks = await readMarks()
    const first = marks.get("3a717e42438afac81020cdec297dadb5613a4304")

    expect(first?.checks).toEqual(
      Option.some({ state: "passing", said: "251 / 252 checks OK" })
    )
  })

  test("says whether GitHub could verify the signature", async () => {
    const marks = await readMarks()

    expect(marks.get("3a717e42438afac81020cdec297dadb5613a4304")?.verified).toBe(true)
  })

  test("holds a partly verified commit to be unverified, which is what it is", async () => {
    const marks = await readMarks()
    const partly = [...marks.values()].filter((one) => !one.verified)

    expect(partly.length).toBeGreaterThan(0)
  })

  test("says nothing about checks on a commit nothing has tested", async () => {
    // Absent rather than passing. A green mark on an untested commit is the one
    // mistake this column must not make.
    const marks = await readMarks()
    const untested = [...marks.values()].filter((one) => Option.isNone(one.checks))

    expect(untested.length).toBeGreaterThan(0)
  })

  test("answers for every commit the page drew", async () => {
    const history = await readLanded()
    const marks = await readMarks()

    expect(commitsOf(history).every((one) => marks.has(one.sha))).toBe(true)
  })

  test("lands on the page as a mark per commit", async () => {
    const marked = withMarks(await readLanded(), await readMarks())
    const [first] = commitsOf(marked)

    expect(Option.isSome(first?.mark ?? Option.none())).toBe(true)
  })

  test("refuses an answer that is not theirs", async () => {
    const outcome = await Effect.runPromise(
      marksFrom({ deferredCommits: [{ commentCount: 0 }] }).pipe(
        Effect.map(() => "decoded" as const),
        Effect.catch(() => Effect.succeed("refused" as const))
      )
    )

    expect(outcome).toBe("refused")
  })
})
