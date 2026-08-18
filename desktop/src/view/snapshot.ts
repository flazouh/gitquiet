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
    // Their signed socket tokens are minted for a page of theirs, and there is no
    // page of theirs here.
    channels: [],
    /*
     * The way in, which the facts this window reads do not carry.
     *
     * The extension reads it off GitHub's own merge box, which answers with the
     * three methods and a verdict apiece. Nothing in {@link MergeFacts} says, so
     * this keeps posting the commonest of the three and repeats GitHub's refusal
     * on a repository that allows only a merge commit. What would fill it is the
     * repository itself — `allow_merge_commit`, `allow_squash_merge` and
     * `allow_rebase_merge` are documented fields — read into `MergeFacts` on the
     * other side of this wire, where every other conclusion about merging is
     * drawn.
     */
    method: Option.some("SQUASH"),
    /*
     * The stack, which GitHub keeps and only their own routes report.
     *
     * None rather than a chain of one layer: what reads this asks whether a press
     * would land more than this pull request, and a stack this window invented would
     * answer yes about pull requests nobody stacked. The window merges one at a time
     * until the documented API grows a way to say otherwise.
     */
    stack: Option.none()
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
  headSha: facts.headSha,
  baseSha: facts.baseSha,
  /*
   * Nothing to do with the branch after the fact, because nothing on this wire says.
   *
   * Both false is the ordinary reading rather than a gap: a repository that deletes
   * its head branches on merge has already done it, and a branch on somebody else's
   * fork was never this reader's to touch. What it costs is the pair of buttons on a
   * merged pull request, and the alternative is offering a press that fails.
   */
  headRef: { mayDelete: false, mayRestore: false },
  /*
   * And no stack GitHub would offer to make out of this one. Their preview route is
   * private, and this window reads the documented API.
   */
  proposal: Option.none(),
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
   * The verdicts and the merge box, as answers rather than as facts.
   *
   * Both are `Option` on the screen, and both are `Some` here, which is not the same
   * statement twice. On GitHub's page they arrive on one private route that can fail
   * on its own, and None is how the screen is told nobody said. This wire carries
   * them with the card or carries no card at all, so there is always an answer — and
   * it has to be shaped like one. Handed over bare, a plain state read as None with
   * a value inside it, and the screen threw on the first field it took out: every
   * pull request opened in this window was a blank page.
   */
  reviews: Option.some(
    facts.reviews.map((one): Review => ({ reviewer: faceOf(one.reviewer), decision: one.decision }))
  ),
  merge: Option.some(mergeOf(facts))
})

