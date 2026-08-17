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
import type { PullRequestRef } from "../../../src/domain/PullRequestRef"
import type { GitHubGateway } from "../../../src/ports/GitHubGateway"
import { PullRequestScreen } from "../../../src/ui/PullRequestScreen"
import { gatewayFrom } from "./gateway"
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
  if (snapshot === null) return "MERGE"

  // Two Options deep, and a miss at either depth is the same answer: nothing was
  // said, so ask for the merge GitHub would have chosen anyway.
  return Option.match(Option.flatMap(snapshot.merge, (said) => said.update), {
    onNone: () => "MERGE" as const,
    onSome: (update) => update.how
  })
}

export const PullRequest = ({
  reference,
  onBack
}: {
  readonly reference: PullRequestRef
  /** Back to the list, which is the only place a window can have come from. */
  readonly onBack: () => void
}) => {
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
          merge: () => through(mergePullRequest(reference)),
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
         * Stepping aside is going back, because there is nothing behind this. On a
         * page, a failed read hands the reader GitHub's own card underneath ours;
         * here the same failure has to hand them something, and the list they came
         * from is the only something there is.
         */
        onStepAside={onBack}
        /*
         * No offer to read GitHub's page instead, because that offer is a promise
         * this window cannot keep. On a page it means handing the tab back to
         * GitHub and remembering that the reader wants that from now on — a real
         * choice between two interfaces over the same thing. Here the alternative
         * would be a browser we do not have, so what the button did was navigate
         * the webview to github.com and leave the reader inside an app that had
         * become a page with no way out of it. The link beside it still goes to
         * GitHub; it opens where links open.
         */
        // Signed in by the time this is drawn: the keychain answered and GitHub
        // named the reader before the window rendered anything at all.
        signedIn={() => true}
      />
    </Supplied>
  )
}
