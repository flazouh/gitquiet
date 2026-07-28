import type { Option } from "effect"
import type { PullRequestRef } from "./PullRequestRef"

export type Participant = {
  readonly login: string
  readonly isAutomated: boolean
}

export type PullRequestState = "open" | "closed" | "merged" | "draft"

export type ChangeType = "added" | "modified" | "deleted" | "renamed" | "copied" | "changed"

export type DiffLineKind = "hunk" | "context" | "added" | "deleted"

export type DiffLine = {
  readonly kind: DiffLineKind
  readonly text: string
  readonly beforeLine: Option.Option<number>
  readonly afterLine: Option.Option<number>
}

export type FileDiff = {
  readonly isBinary: boolean
  readonly isTruncated: boolean
  readonly lines: ReadonlyArray<DiffLine>
}

/** One file's content, as it comes back from a request for several of them. */
export type FetchedDiff = {
  readonly path: string
  readonly diff: FileDiff
}

export type ChangedFile = {
  readonly path: string
  /** Identifies this version of the file, so Reviewed State expires when it changes. */
  readonly digest: string
  readonly changeType: ChangeType
  readonly linesAdded: number
  readonly linesDeleted: number
  readonly readByViewer: boolean
  /** GitHub sends content for only some changed files, so this is often absent. */
  readonly diff: Option.Option<FileDiff>
}

export type Commit = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly author: string
  readonly headline: string
  readonly createdAt: string
}

/**
 * One commit with what it changed, as its own thing to look at.
 *
 * The files are the same {@link ChangedFile} the pull request is read through,
 * so the tree, the diff and every setting over them work here without knowing
 * which of the two they are showing.
 */
export type CommitDetail = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly headline: string
  /** GitHub's rendering of the rest of the message, when there is any. */
  readonly bodyHtml: Option.Option<string>
  readonly author: string
  readonly avatarUrl: Option.Option<string>
  readonly createdAt: string
  readonly files: ReadonlyArray<ChangedFile>
}

export type ThreadComment = {
  readonly author: Participant
  readonly body: string
  /** GitHub's own rendering of {@link body}, so ours reads as theirs does. */
  readonly html: string
  readonly createdAt: string
}

export type ReviewThread = {
  readonly id: string
  readonly isResolved: boolean
  readonly comments: ReadonlyArray<ThreadComment>
}

export type CheckState =
  | "succeeded"
  | "failed"
  | "running"
  | "queued"
  | "cancelled"
  | "skipped"
  | "neutral"

export type CheckNoteLevel = "failure" | "warning" | "notice"

/**
 * One thing GitHub wrote against a check: which step, and what it said.
 *
 * Not the log. The log lives in cloud storage behind a signed link no page may
 * read; this is the summary GitHub itself shows beside a red check, which is
 * usually the sentence worth reading and occasionally only "Process completed
 * with exit code 1" — in which case saying exactly that, and offering the log
 * link, is still better than saying nothing.
 */
export type CheckNote = {
  readonly level: CheckNoteLevel
  /** The step it happened in, as GitHub names it: "Install dependencies". */
  readonly where: string
  readonly message: string
}

export type Check = {
  readonly name: string
  readonly state: CheckState
  readonly isRequired: boolean
  /** GitHub's one-line account of the outcome, shown without opening a log. */
  readonly summary: string
  readonly url: string
  readonly durationSeconds: number
}

export type ReviewDecision = "approved" | "changes-requested" | "commented" | "dismissed"

export type Review = {
  readonly reviewer: Participant
  readonly decision: ReviewDecision
}

export type MergeBlocker = {
  readonly name: string
  readonly explanation: string
}

/**
 * The line a repository makes pull requests stand in before they land.
 *
 * A queue changes what merging even means: nothing goes straight into the base
 * branch, it is enqueued, tested against whatever is ahead of it, and merged by
 * GitHub when its turn comes. A button that says "Squash and merge" on such a
 * repository is either refused or, worse, jumps the line — so the interface has
 * to know a queue exists before it offers anything.
 */
export type MergeQueue = {
  /** Whether this pull request is already standing in it. */
  readonly waiting: boolean
  /** Its place in the line, when GitHub says which. The first is 1. */
  readonly position: Option.Option<number>
  /** Whether the Participant may add it to the queue, or take it out again. */
  readonly viewerCanQueue: boolean
  /** The queue's own page, for the things this interface does not do itself. */
  readonly url: Option.Option<string>
}

export type MergeState = {
  /**
   * Whether GitHub would accept a merge now.
   *
   * True for both of the words GitHub uses for yes: everything settled, and
   * everything settled subject to the required checks it re-reads at merge
   * time. Whether any of those checks is still running is a question the checks
   * themselves answer, not this.
   */
  readonly isMergeable: boolean
  readonly blockers: ReadonlyArray<MergeBlocker>
  /** The queue this lands through, on the repositories that have one. */
  readonly queue: Option.Option<MergeQueue>
}

export type Viewer = {
  readonly login: string
  /** Absent until the Participant has reviewed this pull request at least once. */
  readonly lastReviewPoint: Option.Option<string>
}

/**
 * What the Author wrote about their own pull request, in both the form they
 * wrote it and the form GitHub renders it in.
 */
export type Description = {
  readonly markdown: string
  readonly html: string
}

export type PullRequestSnapshot = {
  readonly reference: PullRequestRef
  readonly title: string
  readonly description: Description
  readonly state: PullRequestState
  readonly author: Participant
  readonly baseBranch: string
  readonly headBranch: string
  readonly headSha: string
  readonly viewer: Viewer
  readonly files: ReadonlyArray<ChangedFile>
  readonly commits: ReadonlyArray<Commit>
  readonly threads: ReadonlyArray<ReviewThread>
  readonly checks: ReadonlyArray<Check>
  readonly reviews: ReadonlyArray<Review>
  readonly merge: MergeState
}
