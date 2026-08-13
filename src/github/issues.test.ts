import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import {
  involvedIssuesAsNested,
  involvedIssuesWithAPullRequest,
  loadFixture
} from "../../tests/fixtures"
import { involvedIssuesFrom } from "./issues"

/**
 * Their issue search's answer as it actually arrived, for `assignee:@me is:issue
 * is:open` against a live account.
 */
const said = loadFixture("involved-issues")

const read = () => Effect.runPromise(involvedIssuesFrom("assigned", said))

describe("reading the issues GitHub's own search answers with", () => {
  test("decodes every issue it listed", async () => {
    const issues = await read()

    expect(issues).toHaveLength(3)
  })

  test("keeps the address a page can be opened from", async () => {
    const issues = await read()

    // Their rows carry the owner, the repository and the number in three
    // different places, and all three are needed before a row can be pressed.
    expect(issues.map((one) => one.reference)).toContainEqual({
      owner: "flazouh",
      repo: "acepe",
      number: 146
    })
  })

  test("carries the involvement that was asked about, since no row says it", async () => {
    const issues = await read()

    expect(issues.every((one) => one.involvement === "assigned")).toBe(true)
  })

  test("carries the author and their face", async () => {
    const issues = await read()

    expect(issues.every((one) => one.author.login.length > 0)).toBe(true)
    expect(issues.some((one) => Option.isSome(one.author.faceUrl))).toBe(true)
  })

  test("keeps the labels' own words, which a row has somewhere to put now", async () => {
    // Counted rather than read until the issue row had four empty tracks where a pull
    // request keeps its review and its diff. "4 labels" was all a count could say there;
    // `agent:claude-code` says what the issue is before the title is read.
    const issues = await read()

    expect(issues.map((one) => one.labels.length).sort()).toEqual([0, 1, 4])
    expect(issues.flatMap((one) => one.labels)).toContain("agent:claude-code")
  })

  test("ignores a label it cannot read, rather than losing the issue with it", async () => {
    // The old comment's worry, kept: these arrived as plain strings on every row seen,
    // and a payload that starts sending objects should cost that one label rather than
    // the whole read.
    const issues = await read()

    expect(issues.every((one) => one.labels.every((word) => typeof word === "string"))).toBe(true)
  })

  test("counts the comments, which is the one number a row shows", async () => {
    const issues = await read()

    expect(issues.some((one) => one.comments > 0)).toBe(true)
  })

  test("keeps whether each is still open, which decides the Court", async () => {
    const issues = await read()

    expect(issues.every((one) => one.state === "open")).toBe(true)
  })

  test("leaves out a pull request their search answered with", async () => {
    // GitHub models a pull request as an issue with a pull request hanging off
    // it, and their search will return both if the query ever stops saying
    // `is:issue`. One reaching the Courts through here would be drawn twice.
    const issues = await Effect.runPromise(
      involvedIssuesFrom("assigned", involvedIssuesWithAPullRequest)
    )

    expect(issues).toHaveLength(2)
    expect(issues.every((one) => one.reference.number !== 1267)).toBe(true)
  })

  test("reads the rows where their search moved them", async () => {
    // Measured on 2026-08-14 against `/search?type=issues`: the results, the page and
    // the two counts now sit under `payload.blackbirdSearchRoute` rather than under
    // `payload`. Nothing else about the answer changed. Both are read, because the old
    // shape is what every recording here holds and there is no saying which of the two
    // an account is served.
    const issues = await Effect.runPromise(involvedIssuesFrom("assigned", involvedIssuesAsNested))

    expect(issues).toHaveLength(3)
    expect(issues.map((one) => one.reference)).toContainEqual({
      owner: "flazouh",
      repo: "acepe",
      number: 146
    })
  })

  test("reads a title's punctuation as punctuation", async () => {
    // `hl_title` is the title with the search's matches marked up, so it arrives as
    // HTML and its apostrophes arrive as `&#39;`. Seen on 2026-08-14 on a live list,
    // where a row read "Choose and validate Coadra&#39;s second vertical".
    const issues = await Effect.runPromise(
      involvedIssuesFrom("assigned", {
        payload: {
          results: [
            {
              id: "1",
              number: 33,
              state: "open",
              hl_title: "Choose and validate Coadra&#39;s &amp; Acepe&#39;s &quot;second&quot; vertical",
              num_comments: 0,
              labels: [],
              created: "2026-07-21T15:12:25.000Z",
              repo: { repository: { name: "coadra", owner_login: "flazouh" } }
            }
          ],
          page: 1,
          page_count: 1,
          result_count: 1
        }
      })
    )

    expect(issues[0]?.title).toBe('Choose and validate Coadra\'s & Acepe\'s "second" vertical')
  })

  test("refuses a payload that is not theirs, rather than inventing issues", async () => {
    const outcome = await Effect.runPromise(
      involvedIssuesFrom("assigned", { payload: { results: [{ number: "seven" }] } }).pipe(
        Effect.map(() => "decoded" as const),
        Effect.catch(() => Effect.succeed("refused" as const))
      )
    )

    expect(outcome).toBe("refused")
  })
})
