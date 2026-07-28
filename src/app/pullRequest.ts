import { Effect, Option } from "effect"
import type { Check } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../github/GitHubGateway"

/**
 * Everything the page needs to render, gathered in one place so the React layer
 * stays ignorant of the gateway.
 */
export const loadPullRequest = Effect.fn("loadPullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  const snapshot = yield* gateway.snapshot(reference)

  return { snapshot }
})

/**
 * The same thing, as it was the last time this pull request was read, without
 * asking GitHub anything.
 *
 * Answers in about as long as a storage read takes, against the second or more
 * a live read costs, which is the difference between a page that appears and a
 * page that loads. Nothing here is trusted to be current: it is what goes on
 * the screen while {@link loadPullRequest} finds out what actually is.
 */
export const rememberedPullRequest = Effect.fn("rememberedPullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  const snapshot = yield* gateway.remembered(reference)

  return Option.map(snapshot, (found) => ({ snapshot: found }))
})

/**
 * Merges it, squashing the branch into one commit.
 *
 * Squash rather than a merge commit because that is what the button has always
 * said, and because a repository that forbids it says so in the merge
 * requirements this refuses on.
 */
/**
 * What GitHub wrote against one check, for the dialog that shows it.
 */
export const loadCheckNotes = Effect.fn("loadCheckNotes")(function* (
  reference: PullRequestRef,
  check: Check
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.notes(reference, check)
})

/**
 * One commit of the branch, for the page that shows it on its own.
 */
export const loadCommit = Effect.fn("loadCommit")(function* (
  reference: PullRequestRef,
  sha: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.commit(reference, sha)
})

export const mergePullRequest = Effect.fn("mergePullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.merge(reference, "SQUASH")
})

/**
 * The diffs for files the page arrived without, several at a time.
 *
 * Many paths in one request because GitHub takes them that way, which is what
 * lets the interface read ahead of whoever is clicking. Paths GitHub says
 * nothing about are simply missing from the answer: a binary file and a file
 * whose content was held back arrive the same way, and neither is an error.
 */
export const loadDiffs = Effect.fn("loadDiffs")(function* (
  reference: PullRequestRef,
  head: string,
  paths: ReadonlyArray<string>
) {
  const gateway = yield* GitHubGateway

  return yield* gateway.diffs(reference, head, paths)
})
