import { Effect } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * A repository's recent workflow runs, folded into the work they belong to.
 *
 * One read and no stages, unlike the pull request list beside it. Their Actions page carries
 * every row's ref, outcome, duration and pull request in the document it is served as, so
 * there is no second request for this screen to draw an early version of.
 */
export const loadStrands = Effect.fn("loadStrands")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.strands(repo)
})

/**
 * The same list as the last visit left it, without asking GitHub.
 *
 * What the screen paints with while the live read is in the air. Nothing where this
 * repository's Actions tab has not been opened on this browser before.
 */
export const rememberedStrands = Effect.fn("rememberedStrands")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedStrands(repo)
})

/**
 * Reads the list ahead of being asked for it, so that opening it is a storage read.
 *
 * Nothing about caching here, because reading is what fills the store: the gateway keeps
 * what it decodes. Warming the list and opening it are the same call, and the only
 * difference is who asked.
 */
export const warmStrands = Effect.fn("warmStrands")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  yield* Effect.asVoid(gateway.strands(repo))
})
