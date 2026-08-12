import { Effect } from "effect"
import { GitHubGateway } from "../ports/GitHubGateway"
import type { Press } from "../domain/notices"

/**
 * The reader's inbox, ready for a screen.
 *
 * One read and no stages, and this is the lightest page here: their `/notifications` is
 * Rails-rendered, so every row's reason, read state, subject state and write forms arrive in
 * the one document. Nothing is folded on the way through either — the grouping is
 * `docketsOf` in `domain/notices.ts`, which the screen calls on what it draws, so a reader
 * marking a row read regroups without another request.
 */
export const loadNotices = Effect.fn("loadNotices")(function* (query: string) {
  const gateway = yield* GitHubGateway
  return yield* gateway.notices(query)
})

/**
 * The same inbox as the last visit left it, without asking GitHub.
 *
 * What the screen paints with while the live read is in the air, and worth more here than on
 * any other page: an inbox is the first thing a reader opens and the thing they come back to
 * between everything else. Nothing where this browser has not opened it before.
 */
export const rememberedNotices = Effect.fn("rememberedNotices")(function* (query: string) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedNotices(query)
})

/**
 * Reads the inbox ahead of being asked for it, so that opening it is a storage read.
 *
 * Nothing about caching here, because reading is what fills the store: the gateway keeps
 * what it parses. Warming the inbox and opening it are the same call, and the only
 * difference is who asked. The link this fires on is their own bell in the site header,
 * which is on every page of GitHub.
 */
export const warmNotices = Effect.fn("warmNotices")(function* (query: string) {
  const gateway = yield* GitHubGateway
  yield* Effect.asVoid(gateway.notices(query))
})

/**
 * Does one thing to one Notice: marks it, unmarks it, archives it, or stops the thread.
 *
 * The {@link Press} read off the row rather than a kind and an id, because the token is
 * per-form and the route is GitHub's. A screen that could name a press it never read would
 * be a screen offering a button GitHub did not put on the row.
 */
export const pressNotice = Effect.fn("pressNotice")(function* (press: Press) {
  const gateway = yield* GitHubGateway
  yield* gateway.pressNotice(press)
})
