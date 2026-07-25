import { Effect } from "effect"
import { CourtOverrides } from "../attention/CourtOverrides"
import type { CourtOverride } from "../domain/Attention"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../github/GitHubGateway"

/**
 * Everything the Control Center needs to render, gathered in one place so the
 * React layer stays ignorant of both the gateway and the store.
 */
export const loadPullRequest = Effect.fn("loadPullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway
  const courts = yield* CourtOverrides

  const snapshot = yield* gateway.snapshot(reference)
  const overrides = yield* courts.all(reference)

  return { snapshot, overrides }
})

export const correctCourt = Effect.fn("correctCourt")(function* (
  reference: PullRequestRef,
  override: CourtOverride
) {
  const courts = yield* CourtOverrides
  yield* courts.correct(reference, override)
})
