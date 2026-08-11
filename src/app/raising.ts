import { Effect } from "effect"
import type { Raising } from "@/domain/raising"
import type { RepoRef } from "@/domain/PullRequestRef"
import { GitHubGateway } from "@/ports/GitHubGateway"

/**
 * Raises an issue in a repository, and answers with where it landed.
 *
 * Thin, like every other write here, and for the same reason: the gateway holds
 * what GitHub needs and the screen holds what the reader typed, so there is
 * nothing left in the middle. It exists so that the screen never names the port,
 * which is what lets the form be tested without a network at all.
 *
 * Nothing is remembered afterwards. A cache of issues is a cache of what GitHub
 * has, and the issue's own page reads that page for itself; writing a made-up
 * row into the store here would only be a row the next read has to correct.
 */
export const raiseIssue = Effect.fn("raiseIssue")(function* (
  reference: RepoRef,
  draft: Raising
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.raise(reference, draft)
})
