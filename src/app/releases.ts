import { Effect } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * A repository's releases, as the Versions on the first page of their list.
 *
 * One read, as the Actions tab is, and for the opposite reason: their Actions rows are complete
 * because GitHub renders that list on the server, and their release notes are complete because
 * GitHub renders the notes on the server and then hides the long ones with a CSS rule. Either
 * way there is nothing here for a second request to add.
 */
export const loadReleases = Effect.fn("loadReleases")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.releases(repo)
})

/**
 * The files of one Version, which is the one thing their list page withholds.
 *
 * Asked for after the list rather than beside it, because the tag has to come out of the list
 * first. Asked for once, for the newest Version, because that is the Version a reader downloads.
 */
export const loadBuilds = Effect.fn("loadBuilds")(function* (repo: RepoRef, tag: string) {
  const gateway = yield* GitHubGateway
  return yield* gateway.builds(repo, tag)
})

/**
 * The same list as the last visit left it, without asking GitHub.
 *
 * What the screen paints with while the live read is in the air. Nothing where this repository's
 * releases have not been read on this browser before.
 */
export const rememberedReleases = Effect.fn("rememberedReleases")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedReleases(repo)
})
