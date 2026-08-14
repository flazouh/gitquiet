import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { withSizes, withStandings } from "../domain/workingSet"
import { involvedFrom, involvedIn, sizeIn, standingsIn } from "./involved"
import type { DeferredRoute, WorkingSetRow } from "./wire"

const row = (over: Partial<WorkingSetRow> = {}): WorkingSetRow => ({
  id: 4153828483,
  number: 1457,
  title: "price claude turns from the streamed usage",
  repoNameWithOwner: "octo-org/octo-repo",
  permalink: "https://github.com/octo-org/octo-repo/pull/1457",
  author: { displayLogin: "flazouh" },
  state: "OPEN",
  isDraft: false,
  isReadByCurrentUser: true,
  commentCount: 4,
  createdAt: "2026-07-28T19:43:33+02:00",
  updatedAt: "2026-07-29T04:19:41+02:00",
  headSha: "0f95bb9db765f8134a8c33b4f6ecbdb21666e32e",
  labels: [],
  assignees: [],
  ...over
})

const one = (over: Partial<WorkingSetRow> = {}) =>
  Option.getOrThrow(involvedFrom(Option.some("needs-action"), row(over)))

describe("reading a Working Set row as an Involved Pull Request", () => {
  test("addresses it by owner, repository and number", () => {
    // `owner/repo` in one string is how the Working Set names a repository, and
    // splitting it is what makes the row openable at all.
    expect(one().reference).toEqual({
      owner: "octo-org",
      repo: "octo-repo",
      number: 1457
    })
  })

  test("keeps GitHub's numeric id, which the deferred read is keyed by", () => {
    expect(one().id).toBe(4153828483)
  })

  test("a draft arrives as open with a flag, and becomes a draft", () => {
    // GitHub reports a draft as OPEN with isDraft set. Everything above this
    // treats draft as a state of its own, because a draft can be neither merged
    // nor queued.
    expect(one({ state: "OPEN", isDraft: true }).state).toBe("draft")
  })

  test("merged and closed carry through as themselves", () => {
    expect(one({ state: "MERGED" }).state).toBe("merged")
    expect(one({ state: "CLOSED" }).state).toBe("closed")
  })

  test("a row whose repository name will not split is dropped, not fatal", () => {
    // One unaddressable row must cost that row and nothing else. Refusing the
    // payload would cost the Participant their whole Working Set.
    expect(involvedFrom(Option.some("needs-action"), row({ repoNameWithOwner: "noslash" }))).toEqual(
      Option.none()
    )
    expect(involvedFrom(Option.some("needs-action"), row({ repoNameWithOwner: "a/b/c" }))).toEqual(Option.none())
    expect(involvedFrom(Option.some("needs-action"), row({ repoNameWithOwner: "/octo-repo" }))).toEqual(Option.none())
  })

  test("the dropped row does not take the rest of the listing with it", () => {
    const listed = involvedIn(Option.some("needs-action"), [
      row({ number: 1, repoNameWithOwner: "noslash" }),
      row({ number: 2 }),
      row({ number: 3 })
    ])

    expect(listed.map((involved) => involved.reference.number)).toEqual([2, 3])
  })

  test("an author whose account is gone becomes ghost", () => {
    expect(one({ author: null }).author.login).toBe("ghost")
  })

  test("an agent's pull request is an automated Participant", () => {
    expect(one({ authoredByAgent: true }).author.isAutomated).toBe(true)
    expect(one().author.isAutomated).toBe(false)
  })

  test("GitHub's reason is kept where it came, and absent where it did not", () => {
    // The shelf routes fill `category` in; a plain query leaves it null.
    expect(one({ category: "CI_FAILING" }).why).toEqual(Option.some("CI_FAILING"))
    expect(one().why).toEqual(Option.none())
    expect(one({ category: null }).why).toEqual(Option.none())
  })

  test("the row's Alive token becomes a channel to watch", () => {
    expect(one({ commitHeadShaChannel: "eyJjIjoicmVwbz" }).channels).toEqual(["eyJjIjoicmVwbz"])
  })

  test("no token, or an empty one, is nothing to subscribe to", () => {
    // An empty string handed to their socket is a subscription to nothing that
    // still counts as a subscription.
    expect(one().channels).toEqual([])
    expect(one({ commitHeadShaChannel: null }).channels).toEqual([])
    expect(one({ commitHeadShaChannel: "" }).channels).toEqual([])
  })

  test("checks and reviews are absent until the deferred read has answered", () => {
    expect(one().checks).toEqual(Option.none())
    expect(one().reviewed).toEqual(Option.none())
  })
})

const deferred = (results: DeferredRoute["results"]): DeferredRoute => ({ results })

describe("what the deferred read adds", () => {
  test("a passing rollup carries its counts", () => {
    const standings = standingsIn(
      deferred([
        { id: 1, statusCheckRollup: { state: "SUCCESS", totalCount: 12, successCount: 12 } }
      ])
    )

    expect(standings.get(1)?.checks).toEqual(
      Option.some({ state: "passing", total: 12, passed: 12 })
    )
  })

  test("a failing rollup says how many did pass", () => {
    // Measured on a real pull request: thirteen checks, eleven of them green.
    // The row has room for that and no room for thirteen names.
    const standings = standingsIn(
      deferred([
        { id: 2, statusCheckRollup: { state: "FAILURE", totalCount: 13, successCount: 11 } }
      ])
    )

    expect(standings.get(2)?.checks).toEqual(
      Option.some({ state: "failing", total: 13, passed: 11 })
    )
  })

  test("errored and expected runs are running, not failing", () => {
    // Neither has reported a verdict on the branch, so neither is a check the
    // Participant can go and fix — which is the only thing calling it failing
    // would be for.
    for (const state of ["PENDING", "ERROR", "EXPECTED"] as const) {
      const standings = standingsIn(
        deferred([{ id: 3, statusCheckRollup: { state, totalCount: 4, successCount: 1 } }])
      )
      expect(standings.get(3)?.checks).toEqual(
        Option.some({ state: "running", total: 4, passed: 1 })
      )
    }
  })

  test("a pull request with no checks has none, whether null or absent", () => {
    // Both shapes come back from GitHub: explicitly null on one with no checks
    // configured, and missing altogether on another.
    expect(standingsIn(deferred([{ id: 4, statusCheckRollup: null }])).get(4)?.checks).toEqual(
      Option.none()
    )
    expect(standingsIn(deferred([{ id: 5 }])).get(5)?.checks).toEqual(Option.none())
  })

  test("review decisions come through as opinions", () => {
    const standings = standingsIn(
      deferred([
        { id: 6, reviewDecisionState: "APPROVED" },
        { id: 7, reviewDecisionState: "CHANGES_REQUESTED" },
        { id: 8, reviewDecisionState: "REVIEW_REQUIRED" },
        { id: 9, reviewDecisionState: null }
      ])
    )

    expect(standings.get(6)?.reviewed).toEqual(Option.some("approved"))
    expect(standings.get(7)?.reviewed).toEqual(Option.some("changes-requested"))
    expect(standings.get(8)?.reviewed).toEqual(Option.some("review-required"))
    expect(standings.get(9)?.reviewed).toEqual(Option.none())
  })
})

describe("joining the two reads", () => {
  test("a row gains what the deferred read said about it", () => {
    const joined = withStandings(
      [one({ id: 100 })],
      standingsIn(
        deferred([
          {
            id: 100,
            statusCheckRollup: { state: "SUCCESS", totalCount: 3, successCount: 3 },
            reviewDecisionState: "APPROVED"
          }
        ])
      )
    )

    expect(joined[0]?.checks).toEqual(Option.some({ state: "passing", total: 3, passed: 3 }))
    expect(joined[0]?.reviewed).toEqual(Option.some("approved"))
  })

  test("a row the deferred read skipped keeps its checks absent, not empty", () => {
    // The distinction the reader depends on: no checks configured is finished,
    // and not yet asked about is still loading. An empty rollup would draw the
    // first while meaning the second.
    const joined = withStandings([one({ id: 200 })], standingsIn(deferred([])))

    expect(joined[0]?.checks).toEqual(Option.none())
  })
})

describe("how big a pull request is", () => {
  test("GitHub's two counts arrive as a size", () => {
    // The whole payload, as served: seventy bytes, and `linesChanged` is their
    // sum, which nothing here needs to be told.
    expect(
      sizeIn({ diffstat: { linesAdded: 1777, linesDeleted: 198 } })
    ).toEqual({ added: 1777, deleted: 198 })
  })

  test("a row gains the size that was read for it", () => {
    const joined = withSizes(
      [one({ id: 300 })],
      new Map([[300, { added: 120, deleted: 8 }]])
    )

    expect(joined[0]?.size).toEqual(Option.some({ added: 120, deleted: 8 }))
  })

  test("a row nothing was read for stays absent rather than empty", () => {
    // Zero lines and not yet measured are different rows, and only one of them
    // is worth reading: `+0 −0` on a four thousand line change is a lie a row
    // has no way to correct.
    expect(withSizes([one({ id: 400 })], new Map())[0]?.size).toEqual(Option.none())
  })
})
