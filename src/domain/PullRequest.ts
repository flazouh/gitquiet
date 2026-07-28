import type { Option } from "effect"
import type { PullRequestRef } from "./PullRequestRef"

export type Participant = {
  readonly login: string
  readonly isAutomated: boolean
  /**
   * GitHub's own URL for their face, when the payload carried one.
   *
   * Worth keeping rather than deriving from the login: an app's avatar lives
   * under an installation id that its name says nothing about, so `Copilot`
   * cannot be turned back into the picture everyone recognises.
   */
  readonly faceUrl: Option.Option<string>
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

/**
 * The line a review thread hangs off.
 *
 * A remark about code is only half a remark without it: read in a column on
 * the far side of the screen, "this breaks on empty input" is a sentence
 * someone has to go hunting for.
 */
export type ThreadAnchor = {
  readonly path: string
  /** Which side of the diff the line is numbered on. */
  readonly side: "before" | "after"
  /** The line it is hung from, which for a range is the last of them. */
  readonly line: number
  /** The first line of the range, equal to {@link line} for a single line. */
  readonly startLine: number
}

/**
 * A remark about some lines, on its way to GitHub.
 *
 * Both commits travel with it because a comment is anchored to a comparison
 * rather than to a file: the same line number means something different once
 * the branch moves, and GitHub refuses a comment that cannot say which pair of
 * commits it was written against.
 */
export type NewComment = {
  readonly path: string
  /** The last line of the range, which for a single line is the only one. */
  readonly line: number
  readonly startLine: number
  readonly body: string
  readonly baseSha: string
  readonly headSha: string
}

export type ReviewThread = {
  readonly id: string
  readonly isResolved: boolean
  /** Absent on a thread about the pull request rather than about a line. */
  readonly at: Option.Option<ThreadAnchor>
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
 * Where in the log a note was written: which step of the job, and which line.
 *
 * Both are GitHub's own numbering, taken from the link they put on the note.
 * The step is what a log is fetched by — a job keeps one log per step, a few
 * kilobytes each rather than the megabytes the whole job comes to.
 */
export type LogSpot = {
  readonly step: number
  readonly line: number
}

/**
 * One thing GitHub wrote against a check: which step, and what it said.
 *
 * The message is often the whole story — "the 'client-id' input must be set" —
 * and occasionally only "Process completed with exit code 1", which is why it
 * carries the spot in the log where it happened.
 */
export type CheckNote = {
  readonly level: CheckNoteLevel
  /** The step it happened in, as GitHub names it: "Install dependencies". */
  readonly where: string
  readonly message: string
  /** Where to look in the log, when GitHub said. */
  readonly at: Option.Option<LogSpot>
}

export type LogTone = "plain" | "error" | "warning" | "notice" | "group" | "ended"

/** The eight colours a terminal has, which is all a log ever asks for. */
export type LogColour =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "grey"

/** A file a log line names, at the line it names it at. */
export type FileRef = {
  readonly path: string
  readonly line: number
  readonly column: Option.Option<number>
}

/**
 * A stretch of a log line that something is known about.
 *
 * A line is cut wherever its colour changes or a file is named, so the panel
 * can colour one part and make another part a link without either of them
 * having to know about the other.
 */
export type LogPiece = {
  readonly text: string
  readonly colour: Option.Option<LogColour>
  readonly file: Option.Option<FileRef>
}

/**
 * One line of a job's log, as it should be read rather than as it was stored.
 *
 * Every stored line begins with a nanosecond timestamp, may be coloured with
 * escape sequences, and may be wrapped in one of GitHub's `##[...]` markers.
 * None of the three is worth a reader's attention as written, so all three come
 * off here and what they meant is kept: the marker as a tone, the sequences as
 * coloured pieces.
 */
export type LogLine = {
  /** GitHub's own line number, which is what an annotation points at. */
  readonly at: number
  /** The words alone, which is what a search matches and a copy copies. */
  readonly text: string
  readonly tone: LogTone
  readonly pieces: ReadonlyArray<LogPiece>
}

/**
 * A log as it is shown: loose lines, and groups that can be left shut.
 */
export type LogPart =
  | { readonly kind: "line"; readonly line: LogLine }
  | {
      readonly kind: "group"
      readonly title: LogLine
      readonly lines: ReadonlyArray<LogLine>
      /** The worst thing inside, so a shut group can still say it holds an error. */
      readonly worst: LogTone
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

/**
 * The part of this page that would answer a blocker.
 *
 * Only the two there is somewhere to go for. A blocker about a draft, or about
 * push access, is answered somewhere else entirely, and a button that scrolls
 * to nothing in particular is worse than no button.
 */
export type BlockerAbout = "checks" | "conversation"

export type MergeBlocker = {
  readonly name: string
  readonly explanation: string
  /** Where on this page the reader would go to deal with it. */
  readonly about: Option.Option<BlockerAbout>
  /**
   * Whether GitHub's own rules allow an administrator past this one.
   *
   * Per rule rather than per pull request, and useless on its own: a rule that
   * may be bypassed still cannot be, by someone without the permission. It
   * pairs with {@link MergeState.mayBypass}.
   */
  readonly bypassable: boolean
}

/**
 * A merge GitHub is holding until it becomes possible.
 *
 * The state "merge when ready" leaves behind, and the reason a card that reads
 * only the queue is wrong about a repository that has one: joining a queue
 * arms an auto-merge, and the pull request does not enter the line until its
 * requirements pass. Nothing has visibly happened, and something has.
 */
export type BranchUpdate = {
  /** What pressing it does, in GitHub's word for it. */
  readonly how: "MERGE" | "REBASE"
  /** Whether the Participant may do it from here. */
  readonly mayUpdate: boolean
  /**
   * Why not, when GitHub said. Usually write access to somebody else's fork,
   * which is not something this extension could work out for itself.
   */
  readonly refusal: Option.Option<string>
}

export type AutoMerge = {
  /** How it will be merged when the moment comes, in GitHub's word for it. */
  readonly method: Option.Option<string>
  /** Whether the Participant may call it off again. */
  readonly viewerCanCancel: boolean
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
  /**
   * Whether GitHub would take this one into the queue now.
   *
   * Separate from {@link viewerCanQueue}, which is about the Participant rather
   * than about this pull request: someone who may queue anything still cannot
   * queue a pull request with an unresolved thread. GitHub answers both, and a
   * button that reads only the permission offers a refusal.
   */
  readonly mayJoin: boolean
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
  /** A merge already armed and waiting for this to become mergeable. */
  readonly autoMerge: Option.Option<AutoMerge>
  /**
   * The catching-up this branch needs, when the base has moved on without it.
   *
   * Present only while the pull request is behind, which is what makes it
   * worth putting a button on: a branch that is level needs nothing.
   */
  readonly update: Option.Option<BranchUpdate>
  /** Whether the Participant may merge past the rules that failed. */
  readonly mayBypass: boolean
  /**
   * GitHub's signed tokens for the things this card is about.
   *
   * Opaque here on purpose: they are handed back to GitHub's own socket, which
   * says a line when the queue moves or the merge state changes. Reading them
   * would be reading somebody else's private format.
   */
  readonly channels: ReadonlyArray<string>
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
  /** The commit the branch is compared against, which a comment is anchored to. */
  readonly baseSha: string
  readonly viewer: Viewer
  readonly files: ReadonlyArray<ChangedFile>
  readonly commits: ReadonlyArray<Commit>
  readonly threads: ReadonlyArray<ReviewThread>
  readonly checks: ReadonlyArray<Check>
  readonly reviews: ReadonlyArray<Review>
  readonly merge: MergeState
}
