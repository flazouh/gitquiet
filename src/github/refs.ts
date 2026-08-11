import { Effect, Option, Schema } from "effect"
import type { Participant } from "../domain/PullRequest"
import { ContributorsRoute, RefsRoute } from "./wire"

const decode = Schema.decodeUnknownEffect(RefsRoute)
const decodeAuthors = Schema.decodeUnknownEffect(ContributorsRoute)

/**
 * Every branch name a repository has.
 *
 * The whole list in one answer, because that is the only shape their route
 * offers: it takes a `q` and ignores it. So the narrowing happens where the
 * typing is, and this is read once per repository and kept.
 */
export const branchesFrom = (raw: unknown): Effect.Effect<ReadonlyArray<string>, unknown> =>
  decode(raw).pipe(Effect.map((said) => said.refs))

/**
 * Everybody who has written a commit on the repository.
 *
 * Read as `Participant`, the same shape a face is drawn from everywhere else, so
 * the author filter's rows carry a picture rather than a column of logins.
 *
 * `isAutomated` is false for all of them, because the route does not say and
 * guessing from a name ending in `[bot]` would be this file deciding who is a
 * person.
 */
export const authorsFrom = (
  raw: unknown
): Effect.Effect<ReadonlyArray<Participant>, unknown> =>
  decodeAuthors(raw).pipe(
    Effect.map((said) =>
      said.authors.map((one) => ({
        login: one.login,
        isAutomated: false,
        faceUrl: Option.fromNullishOr(one.primaryAvatarUrl)
      }))
    )
  )
