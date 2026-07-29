import { Effect, Option } from "effect"
import type { Check, NewComment } from "../domain/PullRequest"
import type { PullRequestRef, RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway, type UpdateMethod } from "../github/GitHubGateway"

/**
 * Everything the page needs to render, gathered in one place so the React layer
 * stays ignorant of the gateway.
 */
export const loadPullRequest = Effect.fn("loadPullRequest")(function* (reference: PullRequestRef) {
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
 * One step's log, for the note in the dialog that points into it.
 */
export const loadCheckLog = Effect.fn("loadCheckLog")(function* (
  reference: PullRequestRef,
  sha: string,
  check: Check,
  step: number
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.log(reference, sha, check, step)
})

/**
 * The end of a check's log, for a dialog with no note to point the way.
 */
export const loadCheckTail = Effect.fn("loadCheckTail")(function* (
  reference: PullRequestRef,
  sha: string,
  check: Check,
  keep: number
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.tail(reference, sha, check, keep)
})

/**
 * One commit of the branch, for the page that shows it on its own.
 */
export const loadCommit = Effect.fn("loadCommit")(function* (reference: RepoRef, sha: string) {
  const gateway = yield* GitHubGateway
  return yield* gateway.commit(reference, sha)
})

/**
 * The diffs for files a commit page arrived without.
 *
 * A commit page embeds content until it has spent a byte budget and sends the
 * rest as names, so this is how most of a commit of any size is read. Beside
 * {@link loadDiffs}, which does the same for a pull request through a route that
 * takes the paths it wants.
 */
export const loadCommitDiffs = Effect.fn("loadCommitDiffs")(function* (
  reference: RepoRef,
  sha: string,
  paths: ReadonlyArray<string>
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.commitDiffs(reference, sha, paths)
})

export const postReviewComment = Effect.fn("postReviewComment")(function* (
  reference: PullRequestRef,
  note: NewComment
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.comment(reference, note)
})

export const mergePullRequest = Effect.fn("mergePullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.merge(reference, "SQUASH")
})

/**
 * Joins the queue, batched, which is what their own button does.
 *
 * `SOLO` is not offered: it asks GitHub to test and land this pull request by
 * itself, which delays everything behind it, and it is a choice nobody makes
 * from a card that has no room to explain the cost.
 */
export const enqueuePullRequest = Effect.fn("enqueuePullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.enqueue(reference, "GROUP")
})

export const dequeuePullRequest = Effect.fn("dequeuePullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.dequeue(reference)
})

/**
 * Catches the branch up with the one it would land on.
 *
 * How is GitHub's own verdict, carried on the pull request, rather than a
 * choice made here: a rebase it has already said it cannot generate comes back
 * refused, and the merge it offers instead always works.
 */
export const updatePullRequestBranch = Effect.fn("updatePullRequestBranch")(function* (
  reference: PullRequestRef,
  how: UpdateMethod
) {
  const gateway = yield* GitHubGateway

  yield* gateway.updateBranch(reference, how)
})

/** Calls off the merge GitHub is holding, queue or no queue. */
export const cancelAutoMerge = Effect.fn("cancelAutoMerge")(function* (reference: PullRequestRef) {
  const gateway = yield* GitHubGateway

  yield* gateway.cancelAutoMerge(reference)
})

/** Closes it without merging, which GitHub lets whoever did it undo. */
export const closePullRequest = Effect.fn("closePullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.close(reference)
})

/** Takes it out of draft, so that everything about merging becomes possible. */
export const markReadyForReview = Effect.fn("markReadyForReview")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.markReady(reference)
})

/** Puts it back into draft, undoing the above. */
export const convertToDraft = Effect.fn("convertToDraft")(function* (reference: PullRequestRef) {
  const gateway = yield* GitHubGateway

  yield* gateway.toDraft(reference)
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
