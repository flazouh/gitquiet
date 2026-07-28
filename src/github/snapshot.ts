import { Data, Effect, Option, Schema } from "effect"
import type {
  MergeQueue,
  MergeState,
  ChangeType,
  ChangedFile,
  Check,
  CommitDetail,
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
import {
  ChangesRoute,
  CommitRoute,
  DescriptionRoute,
  DiffEntriesRoute,
  MergeBoxRoute,
  StatusChecksRoute
} from "./wire"

export type RawPayloads = {
  readonly changes: unknown
  readonly statusChecks: unknown
  readonly mergeBox: unknown
  readonly description: unknown
}

export class NotAuthenticated extends Data.TaggedError("NotAuthenticated")<{
  readonly reference: PullRequestRef
}> {}

const decodeChanges = Schema.decodeUnknownEffect(ChangesRoute)
const decodeStatusChecks = Schema.decodeUnknownEffect(StatusChecksRoute)
const decodeMergeBox = Schema.decodeUnknownEffect(MergeBoxRoute)
const decodeDescription = Schema.decodeUnknownEffect(DescriptionRoute)
const decodeDiffEntries = Schema.decodeUnknownEffect(DiffEntriesRoute)
const decodeCommit = Schema.decodeUnknownEffect(CommitRoute)

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

/**
 * Whether this can be merged, and what stands in the way if it cannot.
 *
 * GitHub has more than one word for yes. `MERGEABLE` is everything settled;
 * `MERGEABLE_IF_STATUSES_PASS` is what a repository with required checks
 * answers — the merge is allowed and their own button is green, since GitHub
 * re-reads those checks as it merges. It does not mean a check is running: a
 * pull request whose every check has passed still comes back that way. Reading
 * only the first word left a button disabled beneath the word "blocked" and an
 * empty list of reasons, which is the worst of both: it says no and will not
 * say why.
 *
 * A state we do not know is still a no — guessing yes would offer a merge
 * GitHub is going to refuse — but it says which state it was, so the next
 * unfamiliar word arrives as a sentence rather than as silence.
 */
const mergeState = (
  requirements: {
    readonly state: string
    readonly conditions: ReadonlyArray<{
      readonly displayName: string
      readonly description: string
      readonly result: string
    }>
  },
  queue: Option.Option<MergeQueue>
): MergeState => {
  const isMergeable =
    requirements.state === "MERGEABLE" || requirements.state === "MERGEABLE_IF_STATUSES_PASS"
  const failed = requirements.conditions
    .filter((condition) => condition.result === "FAILED")
    .map((condition) => ({ name: condition.displayName, explanation: condition.description }))

  if (isMergeable || failed.length > 0) return { isMergeable, blockers: failed, queue }

  return {
    isMergeable,
    queue,
    blockers: [
      {
        name: "Not ready to merge",
        explanation: `GitHub answered ${requirements.state} and listed nothing failing.`
      }
    ]
  }
}

/**
 * The queue, when the repository has one.
 *
 * `mergeQueue` is the field that answers the question: it is the queue itself,
 * and it is null on every repository that merges directly. The entry beside it
 * is this pull request's place in the line, and exists only once it is standing
 * in it — so being in the queue and there being a queue are read from two
 * different fields, which is how a pull request that could be queued and one
 * that already is are told apart.
 */
const mergeQueue = (pullRequest: {
  readonly isInMergeQueue?: boolean | null | undefined
  readonly mergeQueue?: { readonly url?: string | null | undefined } | null | undefined
  readonly mergeQueueEntry?: { readonly position?: number | null | undefined } | null | undefined
  readonly viewerCanAddAndRemoveFromMergeQueue?: boolean | null | undefined
}): Option.Option<MergeQueue> => {
  const queue = pullRequest.mergeQueue
  const entry = pullRequest.mergeQueueEntry
  if (queue === null || queue === undefined) return Option.none()

  const waiting = pullRequest.isInMergeQueue === true || (entry !== null && entry !== undefined)
  return Option.some({
    waiting,
    position: Option.fromNullishOr(entry?.position),
    viewerCanQueue: pullRequest.viewerCanAddAndRemoveFromMergeQueue === true,
    url: Option.fromNullishOr(queue.url)
  })
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

const fileDiffOf = (content: DiffEntriesRoute[number]): FileDiff => ({
  isBinary: content.isBinary,
  isTruncated: content.isTooBig || content.truncatedReason !== null,
  lines: content.diffLines.map(diffLineOf)
})

/**
 * The diffs that were missing from the page, in the same shape as those that
 * were not: the route serving them answers with what the page embeds.
 */
export const toDiffs = Effect.fn("toDiffs")(function* (raw: unknown) {
  const entries = yield* decodeDiffEntries(raw)
  return entries.map((entry) => ({ path: entry.path, diff: fileDiffOf(entry) }))
})

/**
 * The words out of a fragment of GitHub's rendered markdown.
 *
 * Only ever used on a commit headline, which is one line of text in a div —
 * not a general HTML reader, and not asked to be one.
 */
const plainText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim()

/**
 * One commit and its files, in the shapes the rest of the interface reads.
 *
 * Every file arrives with its diff already attached, unlike a pull request
 * where GitHub sends a handful and holds the rest back — a commit is small
 * enough that they send the lot, so nothing here has to be fetched twice.
 */
export const toCommit = Effect.fn("toCommit")(function* (raw: unknown) {
  const { payload } = yield* decodeCommit(raw)
  const author = payload.commit.authors[0]
  const headline =
    payload.commit.shortMessage ?? plainText(payload.commit.shortMessageMarkdown ?? "")

  const files: ReadonlyArray<ChangedFile> = payload.diffEntryData.map((entry) => ({
    path: entry.path,
    digest: entry.pathDigest,
    changeType: changeTypeOf(entry.status),
    linesAdded: entry.linesAdded,
    linesDeleted: entry.linesDeleted,
    readByViewer: false,
    diff: Option.some({
      isBinary: entry.isBinary,
      isTruncated: entry.isTooBig || (entry.truncatedReason ?? null) !== null,
      lines: entry.diffLines.map(diffLineOf)
    })
  }))

  const detail: CommitDetail = {
    sha: payload.commit.oid,
    abbreviatedSha: payload.commit.oid.slice(0, 7),
    headline,
    bodyHtml: Option.fromNullOr(payload.commit.bodyMessageHtml ?? null),
    author: author?.login ?? author?.displayName ?? GHOST,
    avatarUrl: Option.fromNullOr(author?.avatarUrl ?? null),
    createdAt: payload.commit.authoredDate,
    files
  }

  return detail
})

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
  const descriptionPayload = yield* decodeDescription(raw.description)

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
          html: comment.bodyHTML,
          createdAt: comment.createdAt
        }
      })
    })
  )

  const diffsByPath = new Map<string, FileDiff>(
    route.diffContents.map((content) => [content.path, fileDiffOf(content)])
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
    description: { markdown: descriptionPayload.body, html: descriptionPayload.bodyHtml },
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
    merge: mergeState(mergePayload.mergeRequirements, mergeQueue(mergePayload.pullRequest))
  }

  return snapshot
})
