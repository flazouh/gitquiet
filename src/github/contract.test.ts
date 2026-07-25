import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { type FixtureName, loadFixture } from "../../tests/fixtures"
import { ChangesRoute, MergeBoxRoute, StatusChecksRoute } from "./wire"

/**
 * The early-warning system for undocumented endpoints. These fixtures are
 * recorded from live GitHub; if a schema stops decoding one, the payload we
 * depend on has changed shape and the build says so.
 */

type Decoder = (input: unknown) => Effect.Effect<unknown, unknown>

const contracts: ReadonlyArray<readonly [FixtureName, Decoder]> = [
  ["changes", Schema.decodeUnknownEffect(ChangesRoute)],
  ["approved-changes", Schema.decodeUnknownEffect(ChangesRoute)],
  ["status-checks", Schema.decodeUnknownEffect(StatusChecksRoute)],
  ["approved-status-checks", Schema.decodeUnknownEffect(StatusChecksRoute)],
  ["merge-box", Schema.decodeUnknownEffect(MergeBoxRoute)],
  ["merge-box-approved", Schema.decodeUnknownEffect(MergeBoxRoute)]
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
})
