import { Effect } from "effect"
import type { DiscussionRef } from "../domain/discussionRoutes"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * One discussion, whole.
 *
 * One read, because their page is one document. A pull request takes six requests to draw and an
 * issue takes one; this is the issue's kind of page, and for a plainer reason than the issue's —
 * GitHub has not rebuilt it in React yet, so the body, every comment and every reply are in the
 * markup before any script runs.
 */
export const loadDiscussion = Effect.fn("loadDiscussion")(function* (reference: DiscussionRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.discussion(reference)
})

/**
 * The discussion as the last visit left it, without asking GitHub.
 *
 * What the screen paints with while the live read is in the air. The body and the early comments
 * rarely change; the fact that does is the one this screen is about, so this is a first frame
 * rather than an answer.
 */
export const rememberedDiscussion = Effect.fn("rememberedDiscussion")(function* (
  reference: DiscussionRef
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedDiscussion(reference)
})
