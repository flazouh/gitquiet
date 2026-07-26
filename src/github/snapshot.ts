import { Data, Effect, Option, Schema } from "effect"
import type {
  ChangeType,
  Check,
  CheckState,
  DiffLine,
  DiffLineKind,
  FileDiff,
  Participant,
  PullRequestSnapshot,
  PullRequestState,
  Review,
  ReviewDecision,
  ReviewThread
} from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { ChangesRoute, MergeBoxRoute, StatusChecksRoute } from "./wire"

export type RawPayloads = {
  readonly changes: unknown
  readonly statusChecks: unknown
  readonly mergeBox: unknown
}

export class NotAuthenticated extends Data.TaggedError("NotAuthenticated")<{
  readonly reference: PullRequestRef
}> {}

const decodeChanges = Schema.decodeUnknownEffect(ChangesRoute)
const decodeStatusChecks = Schema.decodeUnknownEffect(StatusChecksRoute)
const decodeMergeBox = Schema.decodeUnknownEffect(MergeBoxRoute)

const GHOST = "ghost"

type WireAuthor = { readonly login: string; readonly isAgent?: boolean | null | undefined }

const participantOf = (author: WireAuthor | null): Participant =>
  author === null
    ? { login: GHOST, isAutomated: false }
    : { login: author.login, isAutomated: author.isAgent === true }

const stateOf = (state: "OPEN" | "CLOSED" | "MERGED" | "DRAFT"): PullRequestState => {
  switch (state) {
    case "OPEN":
      return "open"
    case "CLOSED":
      return "closed"
    case "MERGED":
      return "merged"
    case "DRAFT":
      return "draft"
  }
}

const changeTypeOf = (
  changeType: "ADDED" | "MODIFIED" | "REMOVED" | "DELETED" | "RENAMED" | "COPIED" | "CHANGED"
): ChangeType => {
  switch (changeType) {
    case "ADDED":
      return "added"
    case "MODIFIED":
      return "modified"
    case "REMOVED":
    case "DELETED":
      return "deleted"
    case "RENAMED":
      return "renamed"
    case "COPIED":
      return "copied"
    case "CHANGED":
      return "changed"
  }
}

const checkStateOf = (state: StatusChecksRoute["statusChecks"][number]["state"]): CheckState => {
  switch (state) {
    case "SUCCESS":
      return "succeeded"
    case "FAILURE":
    case "ERROR":
    case "TIMED_OUT":
    case "STARTUP_FAILURE":
    case "ACTION_REQUIRED":
      return "failed"
    case "IN_PROGRESS":
      return "running"
    case "PENDING":
    case "QUEUED":
    case "WAITING":
    case "REQUESTED":
    case "EXPECTED":
      return "queued"
    case "CANCELLED":
      return "cancelled"
    case "SKIPPED":
    case "STALE":
      return "skipped"
    case "NEUTRAL":
      return "neutral"
  }
}

const lineKindOf = (type: "HUNK" | "CONTEXT" | "ADDITION" | "DELETION"): DiffLineKind => {
  switch (type) {
    case "HUNK":
      return "hunk"
    case "CONTEXT":
      return "context"
    case "ADDITION":
      return "added"
    case "DELETION":
      return "deleted"
  }
}

/**
 * GitHub reports both a left and a right number on every line, including the
 * side the line does not exist on, so each side is kept only where it means
 * something: the old number on deletions, the new number on additions.
 */
const diffLineOf = (line: {
  readonly type: "HUNK" | "CONTEXT" | "ADDITION" | "DELETION"
  readonly text: string
  readonly left: number | null
  readonly right: number | null
}): DiffLine => {
  const kind = lineKindOf(line.type)
  const hasBefore = kind === "context" || kind === "deleted"
  const hasAfter = kind === "context" || kind === "added"
  return {
    kind,
    text: line.text,
    beforeLine: hasBefore ? Option.fromNullOr(line.left) : Option.none(),
    afterLine: hasAfter ? Option.fromNullOr(line.right) : Option.none()
  }
}

const decisionOf = (
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED"
): ReviewDecision => {
  switch (state) {
    case "APPROVED":
      return "approved"
    case "CHANGES_REQUESTED":
      return "changes-requested"
    case "COMMENTED":
      return "commented"
    case "DISMISSED":
      return "dismissed"
  }
}

export const toSnapshot = Effect.fn("toSnapshot")(function* (
  reference: PullRequestRef,
  raw: RawPayloads
) {
  const changes = yield* decodeChanges(raw.changes)
  const checksPayload = yield* decodeStatusChecks(raw.statusChecks)
  const mergePayload = yield* decodeMergeBox(raw.mergeBox)

  const route = changes.payload.pullRequestsChangesRoute
  const viewerLogin = route.user.currentUserLogin
  if (viewerLogin === null) {
    return yield* new NotAuthenticated({ reference })
  }

  const threads: ReadonlyArray<ReviewThread> = Object.values(route.markers.threads).map(
    (thread) => ({
      id: thread.id,
      isResolved: thread.isResolved,
      comments: thread.commentsData.comments.map((comment) => {
        const author = participantOf(comment.author)
        return {
          author: {
            login: author.login,
            isAutomated: author.isAutomated || comment.automatedComment?.aiAuthored === true
          },
          body: comment.body,
          createdAt: comment.createdAt
        }
      })
    })
  )

  const diffsByPath = new Map<string, FileDiff>(
    route.diffContents.map((content) => [
      content.path,
      {
        isBinary: content.isBinary,
        isTruncated: content.isTooBig || content.truncatedReason !== null,
        lines: content.diffLines.map(diffLineOf)
      }
    ])
  )

  const checks: ReadonlyArray<Check> = checksPayload.statusChecks.map((check) => ({
    name: check.displayName,
    state: checkStateOf(check.state),
    isRequired: check.isRequired,
    summary: check.description ?? "",
    url: check.targetUrl ?? "",
    durationSeconds: check.durationInSeconds
  }))

  // A pending review is an unsubmitted draft, so it is not yet a review at all.
  const reviews: ReadonlyArray<Review> =
    mergePayload.pullRequest.latestOpinionatedReviews.flatMap((review) =>
      review.state === "PENDING"
        ? []
        : [{ reviewer: participantOf(review.author), decision: decisionOf(review.state) }]
    )

  const snapshot: PullRequestSnapshot = {
    reference,
    title: route.pullRequest.title,
    state: stateOf(route.pullRequest.state),
    author: participantOf(route.pullRequest.author),
    baseBranch: route.pullRequest.baseBranch,
    headBranch: route.pullRequest.headBranch,
    headSha: route.comparison.fullDiff.headOid,
    viewer: {
      login: viewerLogin,
      lastReviewPoint: Option.fromNullOr(route.user.lastReviewOid)
    },
    files: route.diffSummaries.map((summary) => ({
      path: summary.path,
      digest: summary.pathDigest,
      changeType: changeTypeOf(summary.changeType),
      linesAdded: summary.linesAdded,
      linesDeleted: summary.linesDeleted,
      readByViewer: summary.markedAsViewed,
      diff: Option.fromNullOr(diffsByPath.get(summary.path) ?? null)
    })),
    commits: route.commits.map((commit) => ({
      sha: commit.oid,
      abbreviatedSha: commit.shortOid,
      author: commit.actorLogin ?? GHOST,
      headline: commit.messageHeadline,
      createdAt: commit.createdAt
    })),
    threads,
    checks,
    reviews,
    merge: {
      isMergeable: mergePayload.mergeRequirements.state === "MERGEABLE",
      blockers: mergePayload.mergeRequirements.conditions
        .filter((condition) => condition.result === "FAILED")
        .map((condition) => ({
          name: condition.displayName,
          explanation: condition.description
        }))
    }
  }

  return snapshot
})
