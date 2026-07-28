import { Data, Effect, Option, Schema } from "effect"
import type {
  AutoMerge,
  BlockerAbout,
  BranchUpdate,
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
  ReviewThread,
  ThreadAnchor
} from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import {
  CreatedComment,
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
const decodeCreated = Schema.decodeUnknownEffect(CreatedComment)
const decodeCommit = Schema.decodeUnknownEffect(CommitRoute)

const GHOST = "ghost"

type WireAuthor = {
  readonly login: string
  readonly isAgent?: boolean | null | undefined
  readonly avatarUrl?: string | null | undefined
}

const participantOf = (author: WireAuthor | null): Participant =>
  author === null
    ? { login: GHOST, isAutomated: false, faceUrl: Option.none() }
    : {
        login: author.login,
        isAutomated: author.isAgent === true,
        faceUrl: Option.fromNullOr(author.avatarUrl ?? null)
      }

/**
 * The thread GitHub hands back when a comment has just been written.
 *
 * The same shape their page data uses for threads that were already there, so
 * a remark posted a second ago and one posted last week are the same thing to
 * everything downstream of here.
 */
export const toCreatedThread = Effect.fn("toCreatedThread")(function* (
  raw: unknown,
  at: ThreadAnchor
) {
  const payload = yield* decodeCreated(raw)

  return {
    id: payload.thread.id,
    isResolved: payload.thread.isResolved,
    at: Option.some(at),
    comments: payload.thread.commentsData.comments.map((comment) => ({
      author: participantOf(comment.author),
      body: comment.body,
      html: comment.bodyHTML,
      createdAt: comment.createdAt
    }))
  } satisfies ReviewThread
})

/**
 * A marker key back into a side and a line.
 *
 * `R105` is line 105 of the file as it will be, `L27` line 27 of the file as it
 * was. Anything else is a spelling we have not seen, and a thread put on the
 * wrong line is worse than a thread left in the column, so it is dropped.
 */
const spotAt = (key: string): { side: "before" | "after"; line: number } | null => {
  const found = /^([LR])(\d+)$/.exec(key)
  if (found === null) return null

  return { side: found[1] === "L" ? "before" : "after", line: Number(found[2]) }
}

/**
 * Which file and line each review thread belongs to.
 *
 * Built by walking the files rather than the threads, because the payload only
 * relates the two in that direction: a thread carries no path, and the file's
 * `markersMap` is the only thing that names both.
 */
const anchorsIn = (
  summaries: ReadonlyArray<{
    readonly path: string
    readonly markersMap?: Record<
      string,
      { readonly threads: ReadonlyArray<{ readonly id: number; readonly start?: string | null }> }
    >
  }>
): ReadonlyMap<string, ThreadAnchor> => {
  const found = new Map<string, ThreadAnchor>()

  for (const summary of summaries) {
    for (const [key, marker] of Object.entries(summary.markersMap ?? {})) {
      const spot = spotAt(key)
      if (spot === null) continue

      for (const thread of marker.threads) {
        const from = thread.start === undefined || thread.start === null ? null : spotAt(thread.start)
        found.set(String(thread.id), {
          path: summary.path,
          side: spot.side,
          line: spot.line,
          startLine: from?.line ?? spot.line
        })
      }
    }
  }

  return found
}

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
 * The sentences a failed condition actually objected to.
 *
 * GitHub gathers every rule that failed into one message, and gathers them by
 * appending: a repository whose branch rule and whose ruleset both want another
 * approval sends "New changes require approval from someone other than the last
 * pusher." twice in a row, which reads as a stutter rather than as two rules.
 * Repeats are dropped and the order is kept, so the reader gets each distinct
 * objection once, in the order GitHub raised them.
 *
 * Absent, empty, or nothing but markup means there is nothing here to prefer,
 * and the caller falls back to the rule's own description.
 */
const whatWentWrong = (message?: string | null): string | undefined => {
  if (message === null || message === undefined) return undefined

  const said = plainText(message)
  if (said.length === 0) return undefined

  const sentences = said
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)

  return [...new Set(sentences)].join(" ")
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
      readonly message?: string | null | undefined
      readonly type?: string | null | undefined
      readonly ruleRollups?:
        | ReadonlyArray<{
          readonly result: string
          readonly ruleType?: string | null
          readonly bypassable?: boolean | null
        }>
        | null
        | undefined
    }>
  },
  queue: Option.Option<MergeQueue>,
  autoMerge: Option.Option<AutoMerge>,
  mayBypass: boolean,
  update: Option.Option<BranchUpdate>,
  channels: ReadonlyArray<string>
): MergeState => {
  const isMergeable =
    requirements.state === "MERGEABLE" || requirements.state === "MERGEABLE_IF_STATUSES_PASS"
  const failed = requirements.conditions
    .filter((condition) => condition.result === "FAILED")
    .map((condition) => ({
      name: condition.displayName,
      explanation: whatWentWrong(condition.message) ?? condition.description,
      bypassable: canBeGonePast(condition.ruleRollups),
      about: whatItIsAbout(condition)
    }))

  const rest = { queue, autoMerge, mayBypass, update, channels }
  if (isMergeable || failed.length > 0) return { isMergeable, blockers: failed, ...rest }

  return {
    isMergeable,
    ...rest,
    blockers: [
      {
        name: "Not ready to merge",
        explanation: `GitHub answered ${requirements.state} and listed nothing failing.`,
        bypassable: false,
        about: Option.none()
      }
    ]
  }
}

/**
 * The channels whose firing would change what the merge card says.
 *
 * Three of the nine GitHub publishes for a pull request. Subscribing to all
 * nine would re-read the whole thing every time a deployment finished, which
 * costs the reader four requests to say nothing new.
 */
const worthWatching = (
  channels?:
    | {
      readonly mergeQueueChannel?: string | null
      readonly gitMergeStateChannel?: string | null
      readonly reviewStateChannel?: string | null
    }
    | null
    | undefined
): ReadonlyArray<string> =>
  [
    channels?.mergeQueueChannel,
    channels?.gitMergeStateChannel,
    channels?.reviewStateChannel
  ].filter((channel): channel is string => typeof channel === "string" && channel.length > 0)

/**
 * Which part of this page a blocker sends the reader to, if any.
 *
 * The rule types come first because they are structure: `REQUIRED_STATUS_CHECKS`
 * is GitHub's own name for the rule, not a phrase in a sentence. Where there is
 * no rule to read — plenty of conditions carry none — what is left is the
 * message, which is the only field written to tell a human what failed.
 *
 * Reading English is a guess, and it is made to fail quietly: a message this
 * does not recognise leaves the blocker with nowhere to go, which is where
 * every blocker started.
 */
const whatItIsAbout = (condition: {
  readonly type?: string | null | undefined
  readonly message?: string | null | undefined
  readonly description?: string | null | undefined
  readonly ruleRollups?: ReadonlyArray<{ readonly ruleType?: string | null }> | null | undefined
}): Option.Option<BlockerAbout> => {
  const failing = (condition.ruleRollups ?? []).map((rollup) => rollup.ruleType ?? "")
  if (failing.includes("REQUIRED_STATUS_CHECKS")) return Option.some("checks")

  const said = plainText(`${condition.message ?? ""} ${condition.description ?? ""}`).toLowerCase()
  if (said.includes("status check")) return Option.some("checks")
  if (said.includes("conversation")) return Option.some("conversation")

  return Option.none()
}

/**
 * Whether every rule that failed under a condition may be gone past.
 *
 * Every one, not any: a condition that holds one bypassable rule and one that
 * is not remains a wall, and reporting it as passable would offer a merge that
 * comes back refused. A condition GitHub sent no rules for is not bypassable,
 * because nothing said it was.
 */
const canBeGonePast = (
  rollups?: ReadonlyArray<{ readonly result: string; readonly bypassable?: boolean | null }> | null
): boolean => {
  const failed = (rollups ?? []).filter((rollup) => rollup.result === "FAILED")
  return failed.length > 0 && failed.every((rollup) => rollup.bypassable === true)
}

type UpdateMethod = {
  readonly name: string
  readonly allowableStatus?: string | null
  readonly isDefault?: boolean | null
  readonly failureReason?: string | null
}

/**
 * The catching-up on offer, for a branch the base has left behind.
 *
 * Nothing at all unless GitHub said `BEHIND`. Every other state — level,
 * conflicted, blocked on a rule — either needs no update or needs something an
 * update would not fix, and a button for it would be a lie either way.
 *
 * Which of `MERGE` and `REBASE` is offered is GitHub's choice, not a
 * preference to be surfaced: it marks one default, and where it marks none the
 * merge is the one that always works.
 */
const branchUpdate = (pullRequest: {
  readonly mergeStateStatus?: string | null | undefined
  readonly viewerUpdateMethods?: ReadonlyArray<UpdateMethod> | null | undefined
}): Option.Option<BranchUpdate> => {
  if (pullRequest.mergeStateStatus !== "BEHIND") return Option.none()

  const methods = pullRequest.viewerUpdateMethods ?? []
  const allowed = methods.filter((method) => method.allowableStatus === "ALLOWED")
  const chosen =
    allowed.find((method) => method.isDefault === true) ??
    allowed[0] ??
    methods.find((method) => method.isDefault === true) ??
    methods[0]

  return Option.some({
    how: chosen?.name === "REBASE" ? "REBASE" : "MERGE",
    mayUpdate: allowed.length > 0,
    refusal: Option.fromNullishOr(chosen?.failureReason)
  })
}

/**
 * The merge GitHub is already holding, if somebody armed one.
 */
const autoMergeOf = (pullRequest: {
  readonly autoMergeRequest?: { readonly mergeMethod?: string | null } | null | undefined
  readonly viewerCanDisableAutoMerge?: boolean | null | undefined
}): Option.Option<AutoMerge> => {
  const armed = pullRequest.autoMergeRequest
  if (armed === null || armed === undefined) return Option.none()

  return Option.some({
    method: Option.fromNullishOr(armed.mergeMethod),
    viewerCanCancel: pullRequest.viewerCanDisableAutoMerge === true
  })
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
  readonly viewerMergeActions?:
    | ReadonlyArray<{
      readonly name: string
      readonly allowableStatus?: string | null | undefined
    }>
    | null
    | undefined
}): Option.Option<MergeQueue> => {
  const queue = pullRequest.mergeQueue
  const entry = pullRequest.mergeQueueEntry
  if (queue === null || queue === undefined) return Option.none()

  const waiting = pullRequest.isInMergeQueue === true || (entry !== null && entry !== undefined)
  // Absent means no, as an unfamiliar state does elsewhere here. A payload that
  // stopped carrying the field would otherwise turn every queue into one this
  // pull request is welcome to join.
  const action = pullRequest.viewerMergeActions?.find(({ name }) => name === "MERGE_QUEUE")

  return Option.some({
    waiting,
    position: Option.fromNullishOr(entry?.position),
    viewerCanQueue: pullRequest.viewerCanAddAndRemoveFromMergeQueue === true,
    mayJoin: action?.allowableStatus === "ALLOWED",
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

  const anchors = anchorsIn(route.diffSummaries)

  const threads: ReadonlyArray<ReviewThread> = Object.values(route.markers.threads).map(
    (thread) => ({
      id: thread.id,
      isResolved: thread.isResolved,
      at: Option.fromNullOr(anchors.get(thread.id) ?? null),
      comments: thread.commentsData.comments.map((comment) => {
        const author = participantOf(comment.author)
        return {
          author: {
            ...author,
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
    baseSha: route.comparison.fullDiff.baseOid,
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
    merge: mergeState(
      mergePayload.mergeRequirements,
      mergeQueue(mergePayload.pullRequest),
      autoMergeOf(mergePayload.pullRequest),
      mergePayload.pullRequest.viewerCanAdminBypassMergeRequirements === true,
      branchUpdate(mergePayload.pullRequest),
      worthWatching(mergePayload.pullRequest.mergeBoxAliveChannels)
    )
  }

  return snapshot
})
