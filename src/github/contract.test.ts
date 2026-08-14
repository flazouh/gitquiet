import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { type FixtureName, loadFixture } from "../../tests/fixtures"
import { reParented } from "../../tests/reParented"
import {
  ChangesRoute,
  CommitAnswer,
  CommitDiffsRoute,
  MergeBoxRoute,
  StatusChecksRoute,
  whyItWouldNotDecode
} from "./wire"
import { whereverItIs } from "./wherever"

/**
 * The early-warning system for undocumented endpoints. These fixtures are
 * recorded from live GitHub; if a schema stops decoding one, the payload we
 * depend on has changed shape and the build says so.
 */

type Decoder = (input: unknown) => Effect.Effect<unknown, unknown>

/** Read as production reads it: the schema describes the answer, not the envelope. */
const finding = (schema: Parameters<typeof whereverItIs>[0]): Decoder => whereverItIs(schema)

const contracts: ReadonlyArray<readonly [FixtureName, Decoder]> = [
  ["changes", finding(ChangesRoute)],
  ["approved-changes", finding(ChangesRoute)],
  ["status-checks", finding(StatusChecksRoute)],
  ["approved-status-checks", finding(StatusChecksRoute)],
  ["merge-box", finding(MergeBoxRoute)],
  ["merge-box-approved", finding(MergeBoxRoute)],
  ["merge-box-stacked-bottom", finding(MergeBoxRoute)],
  ["merge-box-stacked-middle", finding(MergeBoxRoute)],
  ["merge-box-stacked-top", finding(MergeBoxRoute)],
  ["merge-box-stacked-draft-below", finding(MergeBoxRoute)],
  ["commit", finding(CommitAnswer)],
  ["commit-extra-diffs", finding(CommitDiffsRoute)]
]

describe("recorded GitHub payloads still match the schemas we decode with", () => {
  for (const [name, decode] of contracts) {
    test(`${name}.json decodes`, async () => {
      await Effect.runPromise(decode(loadFixture(name)))
    })
  }
})

describe("a payload GitHub has parented somewhere new", () => {
  for (const [name, decode] of contracts) {
    test(`${name}.json still decodes, without anybody naming the new key`, async () => {
      await Effect.runPromise(decode(reParented(loadFixture(name))))
    })
  }
})

describe("when GitHub stops sending something we read", () => {
  const withoutTitle = {
    payload: {
      pullRequestsChangesRoute: {
        pullRequest: {
          number: 1,
          state: "OPEN",
          author: { login: "someone" },
          baseBranch: "main",
          headBranch: "feature",
          commitsCount: 1
        },
        user: { currentUserLogin: "viewer", lastReviewOid: null },
        comparison: { fullDiff: { baseOid: "aaa", headOid: "bbb" } },
        diffSummaries: [],
        commits: [],
        markers: { threads: {} }
      }
    }
  }

  test("the failure names the missing field rather than crashing somewhere else", async () => {
    const error = await Effect.runPromise(
      Effect.flip(finding(ChangesRoute)(withoutTitle))
    )

    expect(String(error)).toContain("title")
  })

  test("says which field and what arrived there, for whoever is reading", async () => {
    // What the drift check and the diagnoser print. Both used to print a stack
    // trace through Effect's internals instead, because a refusal on its own
    // stringifies to `Error` — so the two shape changes that took a real pull
    // request off the screen had to be found by decoding route by route.
    const queued = {
      ...withoutTitle,
      payload: {
        pullRequestsChangesRoute: {
          ...withoutTitle.payload.pullRequestsChangesRoute,
          pullRequest: {
            ...withoutTitle.payload.pullRequestsChangesRoute.pullRequest,
            title: "Something",
            state: "PARKED"
          }
        }
      }
    }

    const error = await Effect.runPromise(
      Effect.flip(finding(ChangesRoute)(queued))
    )

    // Named from where their envelope ends, since the reader no longer knows or
    // cares which key this week's payload was parented under.
    expect(whyItWouldNotDecode(error)).toBe(
      'pullRequest.state: Expected "OPEN" | "CLOSED" | "MERGED" | "DRAFT" | "QUEUED", got "PARKED"'
    )
  })

  test("passes anything that is not a refusal through as itself", () => {
    expect(whyItWouldNotDecode(new Error("the socket went away"))).toBe(
      "Error: the socket went away"
    )
  })
})
