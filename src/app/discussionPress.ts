import { Effect } from "effect"
import type { DiscussionPress } from "../domain/discussions"
import type { DiscussionRef } from "../domain/discussionRoutes"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * One of the four things a reader does to a discussion, and the discussion back.
 *
 * The discussion again rather than what the write answered, because their answer to one of these
 * is a page or a fragment of one. Reading it a second time costs one request and keeps this
 * codebase to one parser for a discussion instead of two.
 */
export const pressDiscussion = Effect.fn("pressDiscussion")(function* (
  reference: DiscussionRef,
  press: DiscussionPress
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.pressDiscussion(reference, press)
})
