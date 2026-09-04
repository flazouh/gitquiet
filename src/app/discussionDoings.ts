import { Effect } from "effect"
import type { DiscussionRef } from "../domain/discussions"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * Everything else GitHub offers on one thing, in their own words.
 *
 * Asked when a reader opens the menu rather than when the discussion is read. That is when their
 * own page asks, and a thread of thirty comments would otherwise be thirty-one requests to draw
 * one page.
 */
export const discussionDoings = Effect.fn("discussionDoings")(function* (
  reference: DiscussionRef,
  on: "Discussion" | "DiscussionComment",
  id: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.discussionDoings(reference, on, id)
})
