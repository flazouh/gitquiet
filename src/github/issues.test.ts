import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { involvedIssuesWithAPullRequest, loadFixture } from "../../tests/fixtures"
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
