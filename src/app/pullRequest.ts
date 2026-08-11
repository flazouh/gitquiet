import { Effect, Option } from "effect"
import type { Check, NewComment } from "../domain/PullRequest"
import type { PullRequestRef, RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway, type Review, type UpdateMethod } from "../ports/GitHubGateway"

/**
 * Everything the page needs to render, gathered in one place so the React layer
 * stays ignorant of the gateway.
 *
 * Asked for twice at once — which is what resting on a row and then pressing it is
 * — this costs one set of requests rather than two: the gateway folds identical
 * reads that are in the air together, so the press waits on what the pointer began.
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
 * The steps a check ran as, for the dialog that lists them.
 */
export const loadCheckSteps = Effect.fn("loadCheckSteps")(function* (
  reference: PullRequestRef,
  check: Check
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.steps(reference, check)
})

/**
 * One commit of the branch, for the page that shows it on its own.
 */
export const loadCommit = Effect.fn("loadCommit")(function* (reference: RepoRef, sha: string) {
  const gateway = yield* GitHubGateway
  return yield* gateway.commit(reference, sha)
})

/**
 * The same commit as the last time it was read, without asking GitHub.
 *
 * Worth more here than on any other page, because a commit that has landed does not
 * change: what comes back is right rather than nearly right, and the live read behind it
 * only confirms it and fills in the diffs.
 */
export const rememberedCommit = Effect.fn("rememberedCommit")(function* (
  reference: RepoRef,
  sha: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedCommit(reference, sha)
})

/** Reads a commit ahead of being asked for it, so that opening it is a storage read. */
export const warmCommit = Effect.fn("warmCommit")(function* (reference: RepoRef, sha: string) {
  const gateway = yield* GitHubGateway
  yield* Effect.asVoid(gateway.commit(reference, sha))
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

/**
 * Says something about the pull request itself.
 *
 * The remark comes back rather than a re-read of the whole card, because the one
 * thing that changed is the thing the reader just wrote and they should see it
 * where they wrote it. Everything else on the card is still true.
 */
/** Marks one thread resolved, which is the act that ends a finding. */
export const settleThread = Effect.fn("settleThread")(function* (
  reference: PullRequestRef,
  threadId: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.settle(reference, threadId)
})

/** Opens a resolved thread again, which is the other half of resolving one. */
export const unsettleThread = Effect.fn("unsettleThread")(function* (
  reference: PullRequestRef,
  threadId: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.unsettle(reference, threadId)
})

/** Answers inside a thread, and says what the thread holds now. */
export const replyInThread = Effect.fn("replyInThread")(function* (
  reference: PullRequestRef,
  commentId: string,
  body: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.reply(reference, commentId, body)
})

export const postRemark = Effect.fn("postRemark")(function* (
  reference: PullRequestRef,
  body: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.remark(reference, body)
})

/**
 * Merges it, squashing the branch into one commit.
 *
 * Two routes, because GitHub has two and each refuses the other's pull request.
 * Which one is not a guess this can make for itself: a stack is only visible in
 * the merge state, so the surface holding one says so, and a surface that holds
 * no merge state gets the ordinary route.
 *
 * That default is what a Working Set row gets. A row carries six fields and no
 * merge state, so it cannot know, and merging a layer of a stack from the list
 * comes back with GitHub's sentence about the branch being out of date. Better
 * than the alternative, which is a read of the merge box for every row before
 * anybody presses anything, and still the reason the card is where a stack is
 * merged from.
 */
export const mergePullRequest = Effect.fn("mergePullRequest")(function* (
  reference: PullRequestRef,
  asStack = false
) {
  const gateway = yield* GitHubGateway

  yield* asStack ? gateway.mergeStack(reference, "SQUASH") : gateway.merge(reference, "SQUASH")
})

/**
 * Makes the stack GitHub offers to make out of this pull request.
 *
 * Nothing is handed in but the pull request, although the stack is several of
 * them. Which ones are in the chain is GitHub's answer and the gateway reads it
 * as part of the write, so the strip that asked cannot make a stack out of a
 * chain that has changed since it was drawn.
 */
export const makeStack = Effect.fn("makeStack")(function* (reference: PullRequestRef) {
  const gateway = yield* GitHubGateway

  yield* gateway.makeStack(reference)
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

/**
 * Says what the reader thinks of it, against the commit they read.
 *
 * The commit is asked for rather than read here, because the reader judged what was on the
 * screen: a verdict sent against whatever the branch moved to in the meantime is a verdict
 * about something nobody read.
 */
export const submitReview = Effect.fn("submitReview")(function* (
  reference: PullRequestRef,
  review: Review
) {
  const gateway = yield* GitHubGateway

  yield* gateway.review(reference, review)
})

/** Closes it without merging, which GitHub lets whoever did it undo. */
export const closePullRequest = Effect.fn("closePullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.close(reference)
})

/** Opens a closed one again, which is that undo. */
export const reopenPullRequest = Effect.fn("reopenPullRequest")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.reopen(reference)
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
 * Deletes the branch a finished pull request was made from.
 *
 * Offered off `headRef.mayDelete` and nowhere else, GitHub answering that for
 * every case this cannot see: a fork, a protected branch, a repository that
 * deletes head branches on merge without being asked.
 */
export const deleteHeadBranch = Effect.fn("deleteHeadBranch")(function* (
  reference: PullRequestRef
) {
  const gateway = yield* GitHubGateway

  yield* gateway.deleteBranch(reference)
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
