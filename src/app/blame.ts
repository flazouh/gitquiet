import { Effect } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"

/** One file's blame, for the screen `docs/spec/blame.md` describes. */
export const loadBlame = Effect.fn("loadBlame")(function* (
  repo: RepoRef,
  branch: string,
  path: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.blameAt(repo, branch, path)
})
