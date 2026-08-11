/**
 * Who can be mentioned in a repository, and what can be referred to by number.
 *
 * One read for both, asked once when a box opens rather than on a keystroke: their suggester
 * answers with the whole list and takes no query, so everything after the read is local. See
 * `suggesting.ts` in the domain for the filtering and `src/github/suggesting.ts` for the route.
 */

import { Effect } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"

export const loadSuggesting = Effect.fn("loadSuggesting")(function* (reference: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.suggesting(reference)
})
