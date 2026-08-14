import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { type FixtureName, loadFixture } from "../../tests/fixtures"
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
  ["changes", Schema.decodeUnknownEffect(ChangesRoute)],
  ["approved-changes", Schema.decodeUnknownEffect(ChangesRoute)],
  ["status-checks", Schema.decodeUnknownEffect(StatusChecksRoute)],
  ["approved-status-checks", Schema.decodeUnknownEffect(StatusChecksRoute)],
  ["merge-box", Schema.decodeUnknownEffect(MergeBoxRoute)],
  ["merge-box-approved", Schema.decodeUnknownEffect(MergeBoxRoute)],
  ["merge-box-stacked-bottom", Schema.decodeUnknownEffect(MergeBoxRoute)],
  ["merge-box-stacked-middle", Schema.decodeUnknownEffect(MergeBoxRoute)],
  ["merge-box-stacked-top", Schema.decodeUnknownEffect(MergeBoxRoute)],
  ["merge-box-stacked-draft-below", Schema.decodeUnknownEffect(MergeBoxRoute)],
  ["commit", finding(CommitAnswer)],
  ["commit-extra-diffs", Schema.decodeUnknownEffect(CommitDiffsRoute)]
]

describe("recorded GitHub payloads still match the schemas we decode with", () => {
  for (const [name, decode] of contracts) {
    test(`${name}.json decodes`, async () => {
      await Effect.runPromise(decode(loadFixture(name)))
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
      Effect.flip(Schema.decodeUnknownEffect(ChangesRoute)(withoutTitle))
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
      Effect.flip(Schema.decodeUnknownEffect(ChangesRoute)(queued))
    )

    expect(whyItWouldNotDecode(error)).toBe(
      'payload.pullRequestsChangesRoute.pullRequest.state: Expected "OPEN" | "CLOSED" | "MERGED" | "DRAFT" | "QUEUED", got "PARKED"'
    )
  })

  test("passes anything that is not a refusal through as itself", () => {
    expect(whyItWouldNotDecode(new Error("the socket went away"))).toBe(
      "Error: the socket went away"
    )
  })
})
