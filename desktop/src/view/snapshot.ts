import { Option } from "effect"
import { fromPatch } from "../../../src/domain/fromPatch"
import { blockersOf } from "../../../src/domain/landing"
import type {
  ChangedFile,
  Check,
  Commit,
  CommitDetail,
  FileDiff,
  MergeState,
  Participant,
  PullRequestSnapshot,
  Remark,
  Review,
  ReviewThread,
  ThreadComment
} from "../../../src/domain/PullRequest"
import type { PullRequestRef } from "../../../src/domain/PullRequestRef"
import type {
  CardFacts,
  CommitDetailFacts,
  FaceFacts,
  FileFacts,
  RemarkFacts,
  SaidFacts,
  ThreadFacts
} from "../shared/wire"

/**
 * A pull request card, built from what the main process read.
 *
 * The crossing is plain JSON, so everything the interface's own types express with
 * an `Option` arrives here as a `null` and is put back together on this side. That
 * is the whole of this file, with one exception worth reading: a file's content
 * arrives as patch text and becomes diff lines, because the documented API hands
 * diffs over the way git does rather than the way GitHub's own page does.
 */

const faceOf = (face: FaceFacts): Participant => ({
  login: face.login,
  isAutomated: face.isAutomated,
  faceUrl: Option.fromNullishOr(face.faceUrl)
})

const saidOf = (said: SaidFacts): ThreadComment => ({
  author: faceOf(said.author),
  body: said.body,
  html: said.html,
  createdAt: said.createdAt
})

/**
 * Where a file's content is, in the interface's own way of saying it.
 *
 * `None` means "not read yet" and is what makes the browser go and ask, so the
 * two kinds of nothing-to-show have to be a `Some` of an empty diff instead —
 * otherwise a binary file is a file the interface fetches forever.
 */
/**
 * One conversation about some lines.
 *
 * Its own function because it is wanted twice: every thread on a card is built
 * from this, and so is the one thread a posted comment becomes. A comment written
 * here and a comment read back from GitHub must be the same object, or the remark
 * a reader has just made will draw differently from the ones above it until the
 * page is read again.
 */
export const threadOf = (thread: ThreadFacts): ReviewThread => ({
  id: thread.id,
  isResolved: thread.isResolved,
  at: Option.fromNullishOr(thread.at),
  comments: thread.comments.map(saidOf)
})

/**
 * One remark, wanted twice for the same reason a thread is: the card is built from
 * these, and so is the one a reader has just written.
 */
export const remarkOf = (one: RemarkFacts): Remark => ({
  id: one.id,
  author: faceOf(one.author),
  body: one.body,
  html: one.html,
  createdAt: one.createdAt
})

const diffOf = (file: FileFacts): Option.Option<FileDiff> => {
  switch (file.content) {
    case "here":
      return Option.some({
        isBinary: false,
        isTruncated: false,
        lines: fromPatch(file.patch ?? "")
      })
    case "withheld":
      return Option.some({ isBinary: false, isTruncated: true, lines: [] })
    case "binary":
      return Option.some({ isBinary: true, isTruncated: false, lines: [] })
    case "unasked":
      return Option.none()
  }
}

const fileOf = (file: FileFacts): ChangedFile => ({
  path: file.path,
  digest: file.digest,
  changeType: file.changeType,
  linesAdded: file.linesAdded,
  linesDeleted: file.linesDeleted,
  readByViewer: file.readByViewer,
  diff: diffOf(file)
})

/** A commit panel, from the facts the main process read. */
export const commitDetailFrom = (facts: CommitDetailFacts): CommitDetail => ({
  sha: facts.sha,
  abbreviatedSha: facts.abbreviatedSha,
  headline: facts.headline,
  bodyHtml: Option.fromNullishOr(facts.bodyHtml),
  author: facts.author,
  avatarUrl: Option.fromNullishOr(facts.avatarUrl),
  createdAt: facts.createdAt,
  files: facts.files.map(fileOf)
})

/**
 * The statuses that mean GitHub would take a merge now.
 *
 * `HAS_HOOKS` is clean with a pre-receive hook still to run, and `UNSTABLE` is
 * clean apart from a check nobody required — GitHub's own page offers the merge
 * button on both, so this does too.
 */
const WOULD_MERGE = new Set(["CLEAN", "HAS_HOOKS", "UNSTABLE"])

const mergeOf = (facts: CardFacts): MergeState => {
  const required = facts.checks.filter((check) => check.isRequired)

  return {
    isMergeable: WOULD_MERGE.has(facts.merge.status),
    /*
     * Only the required checks are counted into the blockers. A failing check
     * nobody required does not hold a merge, and drawing it as though it did would
     * put a red row on a card whose merge button is offered anyway.
     */
    blockers: blockersOf({
      state: facts.state,
      mergeable: facts.merge.mergeable,
      status: facts.merge.status,
      unresolved: facts.threads.filter((thread) => !thread.isResolved).length,
      changesRequested: facts.reviews.some((one) => one.decision === "changes-requested"),
      failedChecks: required.filter((check) => check.state === "failed").length,
      runningChecks: required.filter((check) => check.state === "running" || check.state === "queued")
        .length
    }),
    queue: Option.map(Option.fromNullishOr(facts.merge.queue), (queue) => ({
      waiting: queue.waiting,
      position: Option.fromNullishOr(queue.position),
      viewerCanQueue: queue.mayQueue,
      // Whether this one would be taken now is the same question as whether it
      // would merge now, on a repository that merges through a queue.
      mayJoin: WOULD_MERGE.has(facts.merge.status),
      url: Option.fromNullishOr(queue.url)
    })),
    autoMerge: Option.map(Option.fromNullishOr(facts.merge.autoMerge), (auto) => ({
      method: Option.fromNullishOr(auto.method),
      viewerCanCancel: auto.mayCancel
    })),
    // Present only while behind, which is what makes it worth a button.
    update:
      facts.merge.status === "BEHIND"
        ? Option.some({
            // GitHub's own update is a merge unless the repository says otherwise,
            // and the documented API does not say otherwise.
            how: "MERGE" as const,
            mayUpdate: facts.merge.mayUpdateBranch,
            refusal: Option.fromNullishOr(facts.merge.whyNotUpdate[0] ?? null)
          })
        : Option.none(),
    mayBypass: facts.merge.mayBypass,
    /*
     * None, because a stack is a thing GitHub keeps and only tells their own page
     * about. The merge box on github.com carries the stack's number, its layers and
     * the branch they land on; the documented API carries none of it, so this window
     * cannot say whether a pull request is a layer of one. None is that, and the
     * screen draws an ordinary merge rather than a stack it half knows about.
     */
    stack: Option.none(),
    // Their signed socket tokens are minted for a page of theirs, and there is no
    // page of theirs here.
    channels: []
  }
}

export const snapshotFrom = (
  reference: PullRequestRef,
  facts: CardFacts
): PullRequestSnapshot => ({
  reference,
  title: facts.title,
  description: { markdown: facts.markdown, html: facts.html },
  state: facts.state,
  openedAt: Option.fromNullishOr(facts.openedAt),
  closedAt: Option.fromNullishOr(facts.closedAt),
  mergedAt: Option.fromNullishOr(facts.mergedAt),
  author: faceOf(facts.author),
  baseBranch: facts.baseBranch,
  headBranch: facts.headBranch,
  /*
   * Neither verb offered, because the crossing does not carry the two answers yet.
   *
   * Both false is the ordinary reading of this rather than a gap being papered over:
   * it is what a repository that deletes its own head branches leaves behind, and what
   * a branch on somebody else's fork says. The card draws no offer to delete or to put
   * back, which is worth more than an offer built on a guess — GitHub refuses a delete
   * this reader may not make, and the refusal arrives after the press.
   */
  headRef: { mayDelete: false, mayRestore: false },
  /*
   * None, for the reason `stack` above is None: what GitHub would stack out of this
   * branch is something their merge box says and the documented API does not.
   */
  proposal: Option.none(),
  headSha: facts.headSha,
  baseSha: facts.baseSha,
  viewer: {
    login: facts.viewerLogin,
    lastReviewPoint: Option.fromNullishOr(facts.lastReviewPoint)
  },
  files: facts.files.map(fileOf),
  commits: facts.commits.map(
    (one): Commit => ({
      sha: one.sha,
      abbreviatedSha: one.abbreviatedSha,
      author: one.author,
      headline: one.headline,
      createdAt: one.createdAt
    })
  ),
  threads: facts.threads.map(threadOf),
  remarks: facts.remarks.map(remarkOf),
  checks: facts.checks.map(
    (check): Check => ({
      name: check.name,
      state: check.state,
      isRequired: check.isRequired,
      summary: check.summary,
      url: check.url,
      durationSeconds: check.durationSeconds
    })
  ),
  /*
   * Some, always, and the two Options below are the same answer to the same question.
   *
   * On GitHub's page both of these come out of one private route — the merge box —
   * which served a crash page through the incident of 2026-08-17, so the screen learned
   * to draw a pull request without them. Here they come out of the documented API,
   * which either answers the pull request or fails the read: there is no half of a card
   * to represent, so what this window has is always an answer.
   *
   * Wrapped rather than left bare, which is the bug this replaced. `PullRequestScreen`
   * reads the merge state with `Option.map`, and a plain object handed to that is not a
   * None — it is taken for a Some and mapped over its `value`, which is `undefined`. So
   * every card threw on `said.channels` during render, and with no error boundary above
   * it React took the whole window down: pressing any row in the Working Set blanked
   * the app.
   */
  reviews: Option.some(
    facts.reviews.map((one): Review => ({ reviewer: faceOf(one.reviewer), decision: one.decision }))
  ),
  merge: Option.some(mergeOf(facts))
})

