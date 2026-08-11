import { Effect, Option } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * A repository's tab row, which the bar stands on and cannot work out for itself.
 *
 * Which tabs a repository has is not in its address: Issues, Discussions, Actions and
 * Projects can each be switched off, Insights is at `/network/dependencies`, and the counts
 * beside Issues and Pull requests are GitHub's. It was read off their live row until now,
 * which meant the bar had to wait for their header to hydrate under our own screen — and
 * where it drew first, it drew Code and Pull requests and nothing else.
 *
 * So it is read, kept and warmed like every other page here. The row barely changes, so a
 * kept one is right rather than nearly right, and the live read behind it only confirms it.
 */
export const loadTabs = Effect.fn("loadTabs")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.tabs(repo)
})

/** The row as it was last read, for the frame before anything is asked of GitHub. */
export const rememberedTabs = Effect.fn("rememberedTabs")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedTabs(repo)
})

/**
 * Reads the row ahead of being asked for it, so a repository opens with its own tabs.
 *
 * The heaviest warm of the lot for the smallest thing: the row is served in the document
 * for the front page and nowhere else, so this is three hundred kilobytes for a few hundred
 * bytes of tabs. It is paid once per repository and never again — the row is kept standing,
 * not browsed — and it is only ever asked for where the store has no row to show.
 */
export const warmTabs = Effect.fn("warmTabs")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway

  const had = yield* gateway.rememberedTabs(repo)
  if (Option.isSome(had)) return

  yield* Effect.asVoid(gateway.tabs(repo))
})
