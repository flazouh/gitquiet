import { Effect, Option } from "effect"
import { useCallback, useRef } from "react"
import {
  cancelAutoMerge,
  closePullRequest,
  convertToDraft,
  dequeuePullRequest,
  enqueuePullRequest,
  loadCommit,
  loadCommitDiffs,
  loadDiffs,
  loadPullRequest,
  markReadyForReview,
  mergePullRequest,
  postRemark,
  postReviewComment,
  rememberedPullRequest,
  updatePullRequestBranch
} from "../../../src/app/pullRequest"
import type { NewComment, PullRequestSnapshot } from "../../../src/domain/PullRequest"
import { type PullRequestRef, toUrl } from "../../../src/domain/PullRequestRef"
import type { GitHubGateway } from "../../../src/ports/GitHubGateway"
import { PullRequestScreen } from "../../../src/ui/PullRequestScreen"
import { gatewayFrom } from "./gateway"
import { openOutside } from "./outside"
import { Supplied } from "./supplied"

/**
 * One pull request, in a window.
 *
 * The same screen the extension puts over GitHub's own conversation tab, reading
 * and writing through the same port. What is different is underneath it and not in
 * here: the extension's card is assembled from six of GitHub's private routes and
 * this one from the documented API, and the screen cannot tell.
 *
 * Check-dialog log reads are still unwired (private routes). Commits use the
 * documented REST commit endpoint.
 */

/**
 * The gateway, built per ask with no rows in it.
 *
 * The list hands its rows over because it fetched them all at once; a card has
 * nothing of the sort to hand, and asks for itself. An empty array is therefore
 * the whole truth rather than a placeholder.
 */
const through = <A, E>(work: Effect.Effect<A, E, GitHubGateway>) =>
  Effect.provide(work, gatewayFrom([]))

/**
 * GitHub's own verdict on how this branch would be caught up, or their default.
 *
 * Read off the snapshot rather than chosen: a repository that forbids rebasing has
 * said so, and asking for one anyway is a refusal the reader did not need.
 */
const howToCatchUp = (snapshot: PullRequestSnapshot | null): "MERGE" | "REBASE" => {
  const update = snapshot?.merge.update
  return update !== undefined && Option.isSome(update) ? update.value.how : "MERGE"
}

export const PullRequest = ({ reference }: { readonly reference: PullRequestRef }) => {
  /*
   * The last read, kept for the one write that needs to know what it is acting on:
   * whether a branch is caught up by merging or rebasing is GitHub's verdict, and
   * it arrives with the pull request rather than being ours to choose.
   */
  const latest = useRef<PullRequestSnapshot | null>(null)

  const read = useCallback(
    () =>
      through(loadPullRequest(reference)).pipe(
        Effect.tap((loaded) =>
          Effect.sync(() => {
            latest.current = loaded.snapshot
          })
        )
      ),
    [reference]
  )

  const readDiffs = useCallback(
    (paths: ReadonlyArray<string>, head: string) => through(loadDiffs(reference, head, paths)),
    [reference]
  )

  const readCommit = useCallback(
    (sha: string) => through(loadCommit(reference, sha)),
    [reference]
  )

  const readCommitDiffs = useCallback(
    (sha: string, paths: ReadonlyArray<string>) => through(loadCommitDiffs(reference, sha, paths)),
    [reference]
  )

  /*
   * The card as it was the last time this pull request was open, on screen in the
   * time a storage read takes rather than the two to three seconds GitHub needs.
   *
   * Everything but the code: the diffs are not kept, so the header, the checks, the
   * conversation and the file tree are all there and the patches arrive with the
   * read. Replaced whole the moment GitHub answers, and a failure shows the failure
   * — what is remembered is worth showing while waiting and never worth mistaking
   * for an answer.
   */
  const remembered = useCallback(() => through(rememberedPullRequest(reference)), [reference])

  /*
   * A remark on some lines, written where the lines are.
   *
   * The same seam the extension uses, so the box, the range it was dragged over and
   * the thread that appears under it are all the shared screen's work. What is new
   * on this platform is only where it is sent: GitHub's documented route for a pull
   * request review comment, rather than the private one their own page posts to.
   */
  const say = useCallback(
    (note: NewComment) => through(postReviewComment(reference, note)),
    [reference]
  )

  /* And on the pull request itself, which is where most of what is said goes. */
  const remark = useCallback((body: string) => through(postRemark(reference, body)), [reference])

  return (
    <Supplied>
      <PullRequestScreen
        reference={reference}
        load={read}
        preload={remembered}
        fetchDiffs={readDiffs}
        loadCommit={readCommit}
        fetchCommitDiffs={readCommitDiffs}
        postComment={say}
        postRemark={remark}
        actions={{
          // The card hands down the way this repository merges, having read it
          // off the state it drew the button from. Nothing here reads it again.
          merge: (method) => through(mergePullRequest(reference, method)),
          enqueue: () => through(enqueuePullRequest(reference)),
          dequeue: () => through(dequeuePullRequest(reference)),
          cancel: () => through(cancelAutoMerge(reference)),
          update: () =>
            through(
              updatePullRequestBranch(reference, howToCatchUp(latest.current))
            ),
          close: () => through(closePullRequest(reference)),
          markReady: () => through(markReadyForReview(reference)),
          toDraft: () => through(convertToDraft(reference))
          /*
           * Nothing else to wire. The screen puts every write through its own
           * read — the card wears the state the verb leads to at once, and the
           * read behind it either agrees or puts it back — so the two callbacks
           * that used to ask for the whole pull request again are gone, along
           * with the socket seam this window borrowed to reach them. That seam
           * only ever fires where GitHub gave channels to listen on, and a card
           * built in this window has none, so it never fired at all.
           */
        }}
        /*
         * Stepping aside is this pull request in the reader's browser, because
         * there is no page behind this one to give back.
         *
         * It was the way back to the list, which read as the truth on the failure
         * screen and as a lie in the bar: the same callback draws GitHub's own mark
         * up there, so the corner of the window offered GitHub's page and returned
         * the list. Going back is the mark for Home now, in that same strip, on both
         * screens — so this can say what it does.
         */
        onStepAside={() => openOutside(toUrl(reference))}
        // Signed in by the time this is drawn: the keychain answered and GitHub
        // named the reader before the window rendered anything at all.
        signedIn={() => true}
      />
    </Supplied>
  )
}
