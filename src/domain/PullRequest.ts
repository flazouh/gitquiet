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

export type ThreadComment = {
  readonly author: Participant
  readonly body: string
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

export type MergeState = {
  readonly isMergeable: boolean
  readonly blockers: ReadonlyArray<MergeBlocker>
}

export type Viewer = {
  readonly login: string
  /** Absent until the Participant has reviewed this pull request at least once. */
  readonly lastReviewPoint: Option.Option<string>
}

export type PullRequestSnapshot = {
  readonly reference: PullRequestRef
  readonly title: string
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
