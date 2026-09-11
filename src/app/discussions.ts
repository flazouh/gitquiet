import { Effect } from "effect"
import type { DiscussionList } from "../domain/discussionRoutes"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * One page of a repository's discussions: the rows, the categories and the paging together.
 *
 * One read, as the Actions and Releases tabs are, and for the same reason as the Releases tab:
 * GitHub still renders this list on the server, so everything the screen draws is in the one
 * document. There is nothing here for a second request to add.
 */
export const loadDiscussions = Effect.fn("loadDiscussions")(function* (list: DiscussionList) {
  const gateway = yield* GitHubGateway
  return yield* gateway.discussions(list)
})

/**
 * The same page as the last visit left it, without asking GitHub.
 *
 * What the screen paints with while the live read is in the air. Nothing where this address has
 * not been read on this browser before, and nothing kept under one category is ever handed to
 * another: the store is keyed by `listRouteOf`, which is the whole address.
 */
export const rememberedDiscussions = Effect.fn("rememberedDiscussions")(function* (
  list: DiscussionList
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedDiscussions(list)
})
