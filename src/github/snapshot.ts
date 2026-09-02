import { Data, Effect, Option } from "effect"
import type {
  AutoMerge,
  BlockerAbout,
  BranchUpdate,
  Chain,
  MergeMethod,
  MergeQueue,
  MergeState,
  ChangeType,
  ChangedFile,
  Check,
  CommitDetail,
  CheckState,
  DiffLine,
  DiffLineKind,
  FetchedDiff,
  FileDiff,
  Participant,
  PullRequestSnapshot,
  PullRequestState,
  Remark,
  Review,
  ReviewDecision,
  ReviewThread,
  Seat,
  Stack,
  ThreadAnchor
} from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { plainText } from "./plainText"
import { whereverItIs } from "./wherever"
import {
  type AsyncDiffLoad,
  CreatedComment,
  ChangesRoute,
  type CommitDiffEntry,
  CommitDiffsRoute,
  CommitAnswer,
  DescriptionRoute,
  DiffEntriesRoute,
  HeaderRoute,
  IssueCommentsRoute,
  MergeBoxRoute,
  PreviewStackRoute,
  StatusChecksRoute
} from "./wire"

export type RawPayloads = {
  readonly changes: unknown
  readonly statusChecks: unknown
  /**
   * What `page_data/merge_box` said, or `null` where GitHub would not serve it.
   *
   * `null` is our word for a route that did not answer at all — see
   * `whateverIsAt` — and it is the only value here that skips a decode. Anything
   * else is put through the shape in `wire.ts` and fails the read if it has
   * changed, which is what keeps an outage and a drift telling apart.
   */
  readonly mergeBox: unknown
  readonly description: unknown
  /** What `page_data/header` said, or `null`. Read as `mergeBox` above. */
  readonly header: unknown
  readonly issueComments: unknown
  /**
   * What `page_data/preview_stack` said, where anything did.
   *
   * Optional, unlike the six above, and the one payload here whose absence is
   * ordinary rather than a bug: every pull request read before this route was
   * asked for is in the store without it, and every one of those is a pull request
   * with no proposal rather than a miss.
   */
  readonly preview?: unknown
}

export class NotAuthenticated extends Data.TaggedError("NotAuthenticated")<{
  readonly reference: PullRequestRef
}> {}

const decodeChanges = whereverItIs(ChangesRoute)
const decodeStatusChecks = whereverItIs(StatusChecksRoute)
export const decodeMergeBox = whereverItIs(MergeBoxRoute)
const decodeDescription = whereverItIs(DescriptionRoute)
const decodeHeader = whereverItIs(HeaderRoute)
const decodeIssueComments = whereverItIs(IssueCommentsRoute)
const decodePreviewStack = whereverItIs(PreviewStackRoute)
const decodeDiffEntries = whereverItIs(DiffEntriesRoute)
const decodeCreated = whereverItIs(CreatedComment)
const decodeCommit = whereverItIs(CommitAnswer)
const decodeCommitDiffs = whereverItIs(CommitDiffsRoute)

const GHOST = "ghost"

type WireAuthor = {
  readonly login: string
  readonly isAgent?: boolean | null | undefined
  readonly avatarUrl?: string | null | undefined
}

/**
 * The suffix GitHub puts on an app's login, and the only mark of one on a
 * payload that omits `isAgent` — `railway-app[bot]`, `github-actions[bot]`.
 * A login cannot otherwise end in a bracket, so nothing else matches it.
 */
const APP = /\[bot\]$/

const participantOf = (author: WireAuthor | null): Participant =>
  author === null
    ? { login: GHOST, isAutomated: false, faceUrl: Option.none() }
    : {
        login: author.login,
        // The suffix as well as the flag, which is what the remarks already do.
        // Devin's review comments come back with `isAgent` false and no
        // `automatedComment`, so the flag alone made the same app a machine in
        // the conversation and a colleague on a line of code.
        isAutomated: author.isAgent === true || APP.test(author.login),
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
      id: comment.databaseId === null ? undefined : comment.databaseId?.toString(),
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
/** GitHub's own marker for a thread about the file rather than a line of it. */
const THE_FILE = "FILE"

/**
 * Where a marker puts a thread: on some lines, or on the whole file.
 *
 * `R150` and `L12` name a side and a line. `FILE` names no line at all, and
 * used to be dropped here along with the path beside it — so a File Remark
 * reached the conversation saying nothing about which file it was about. It is
 * read now, and the path travels with it.
 *
 * Anything else is a marker nothing here knows, and is skipped rather than
 * guessed at.
 */
const spotAt = (
  key: string
): { side: "before" | "after"; line: number } | typeof THE_FILE | null => {
  if (key === THE_FILE) return THE_FILE

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
        if (spot === THE_FILE) {
          found.set(String(thread.id), { path: summary.path })
          continue
        }

        // The start of a range, where their marker names one. A start that read
        // as the file marker would be a range beginning nowhere, which is not a
        // thing their payload says; it falls back to the end, as a missing one does.
        const from = thread.start === undefined || thread.start === null ? null : spotAt(thread.start)
        const started = from === null || from === THE_FILE ? spot.line : from.line

        found.set(String(thread.id), {
          path: summary.path,
          lines: { side: spot.side, line: spot.line, startLine: started }
        })
      }
    }
  }

  return found
}

/**
 * `QUEUED` is deliberately not a state of its own up here.
 *
 * A pull request in the merge queue is open, and where it stands in the line is
 * already on the merge state — position, whether it is waiting, and what may be
 * done about it. Carrying it twice would mean every reader of a state deciding
 * which copy wins, and the one it would be read for most, "can this still be
 * acted on", is answered the same way for both.
 */
const stateOf = (state: "OPEN" | "CLOSED" | "MERGED" | "DRAFT" | "QUEUED"): PullRequestState => {
  switch (state) {
    case "OPEN":
    case "QUEUED":
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
/** Where GitHub's word for a seat puts a layer, drawn foundation first. */
const SEAT: Record<string, Seat> = { BEFORE: "below", CURRENT: "here", AFTER: "above" }

/**
 * What a layer's state is, forgivingly.
 *
 * The five words `stateOf` handles, and `open` for anything else. This is
 * another pull request described in passing by the payload of the one being
 * read, so a sixth word must cost that layer its badge and nothing more.
 */
const layerState = (state: string): PullRequestState =>
  state === "CLOSED" || state === "MERGED" || state === "DRAFT"
    ? stateOf(state)
    : "open"

/**
 * The stack, out of the merge requirement GitHub files it under.
 *
 * Same repository as the pull request being read, always: GitHub's own rule is
 * that a stack is pull requests within one repository, so a layer needs only
 * its number to be somewhere this interface can go.
 *
 * Reversed on the way through. GitHub sends the top first, which is the order
 * their own panel draws and the opposite of the order the thing lands in. Every
 * question asked of a stack here — what a press takes with it, what is holding
 * it up, which layer is the foundation — is answered by counting from the
 * bottom, so the bottom is where the list starts.
 */
/**
 * Whether a merge box describes a layer of a stack, by the one rule there is.
 *
 * Asked in two places. The card reads a whole {@link Stack} out of these same
 * conditions; a row in a list asks only this much, to pick between the two merge
 * routes before it presses. That second reading used to be
 * `stackedBaseRefName != null`, which the payload sets from any seat, so the two
 * disagreed — and a disagreement here is a refused press, each route turning
 * away the other's pull request with a sentence about a branch being out of date.
 */
export const stacked = (
  conditions: ReadonlyArray<{
    readonly type?: string | null | undefined
    readonly stack?: { readonly number: number } | null | undefined
    readonly entries?: ReadonlyArray<unknown> | null | undefined
  }>
): boolean => {
  const condition = conditions.find((one) => one.type === "STACK")
  return (
    condition?.stack !== undefined &&
    condition.stack !== null &&
    condition.entries !== undefined &&
    condition.entries !== null
  )
}

const stackIn = (
  reference: PullRequestRef,
  /** The base branch of the pull request being read, which is the stack's floor only from the foundation. */
  baseBranch: string,
  /** The branch the stack lands on, as the payload names it from any seat. */
  stacksBase: string | null | undefined,
  conditions: ReadonlyArray<{
    readonly type?: string | null | undefined
    readonly stack?: { readonly number: number } | null | undefined
    readonly entries?:
      | ReadonlyArray<{
        readonly pull: {
          readonly number: number
          readonly title: string
          readonly state: string
          readonly headBranch: string
        }
        readonly position: string
      }>
      | null
      | undefined
  }>
): Option.Option<Stack> => {
  const condition = conditions.find((one) => one.type === "STACK")
  const held = condition?.stack
  const entries = condition?.entries
  if (!stacked(conditions) || held === undefined || held === null || entries === undefined || entries === null) {
    return Option.none()
  }

  const layers = [...entries]
    .reverse()
    .map((entry) => ({
      reference: { owner: reference.owner, repo: reference.repo, number: entry.pull.number },
      title: entry.pull.title,
      headBranch: entry.pull.headBranch,
      state: layerState(entry.pull.state),
      // An unknown word for a seat is read as `above`, which is the reading
      // that costs least: a layer wrongly placed above is one a press does not
      // claim to land, where the same layer wrongly placed below is a promise
      // to land something this cannot see the state of.
      seat: SEAT[entry.position] ?? "above"
    }))

  // The stack's own base, which is one branch for the whole of it and so the
  // same answer from every seat. Where the payload leaves it out this reader's
  // base stands in, and only from the foundation: from anywhere else it is the
  // layer directly underneath rather than the floor. See `Stack.floor`.
  const floor = Option.orElse(Option.fromNullishOr(stacksBase), () =>
    layers.some((layer) => layer.seat === "below") ? Option.none() : Option.some(baseBranch)
  )

  return Option.some({ number: held.number, layers, floor })
}

/**
 * The chain GitHub would make, out of the route that offers it.
 *
 * Reversed on the way through, as a stack is, because GitHub sends the top first
 * and everything asked of a chain here counts from the foundation.
 *
 * The seat is worked out rather than read. A stack's entries arrive marked
 * `BEFORE`, `CURRENT` and `AFTER` against the pull request being read; a proposal's
 * do not, because the route is asked about one pull request and answers about the
 * chain rather than about the asking. The number does it instead, which is the
 * same comparison GitHub's own dialog makes when it marks a row as the page.
 *
 * The floor is the foundation's base branch. Every entry carries one, so this is
 * the one thing about a proposal that is easier than about a stack — there the
 * base is nowhere in the entries and had to be found on the merge box beside them.
 */
const proposalIn = (
  reference: PullRequestRef,
  entries: ReadonlyArray<{
    readonly number: number
    readonly title: string
    readonly state: string
    readonly headBranch: string
    readonly baseBranch: string
  }>
): Option.Option<Chain> => {
  // A chain with no links in it, which is what an empty body would be. Both
  // drawings decline below two layers, and there is nothing here to propose.
  if (entries.length < 2) return Option.none()

  const landing = [...entries].reverse()
  const here = landing.findIndex((entry) => entry.number === reference.number)
  const foundation = landing[0]
  if (foundation === undefined) return Option.none()

  const layers = landing.map((entry, at) => ({
    reference: { owner: reference.owner, repo: reference.repo, number: entry.number },
    title: entry.title,
    headBranch: entry.headBranch,
    state: layerState(entry.state),
    // Where the reader stands in the list, not which number is larger. A pull
    // request opened later can sit lower in a chain, so the order the entries
    // arrive in is the only thing that says which side of the reader one is on.
    seat: at === here ? ("here" as const) : at < here ? ("below" as const) : ("above" as const)
  }))

  return Option.some({ layers, floor: Option.some(foundation.baseBranch) })
}

const whatIsInTheWay = (
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
      readonly conflicts?: ReadonlyArray<string> | null | undefined
      readonly isConflictResolvableInWeb?: boolean | null | undefined
    }>
  } | null,
  /** Whether this pull request is standing in the merge queue. */
  inQueue: boolean
): Pick<MergeState, "isMergeable" | "blockers"> => {
  // Null once it has landed. Nothing is required of a pull request that is
  // already in, and saying "not ready to merge" over one would be this reading
  // an absence as a refusal.
  if (requirements === null) return { isMergeable: false, blockers: [] }

  const isMergeable =
    requirements.state === "MERGEABLE" || requirements.state === "MERGEABLE_IF_STATUSES_PASS"
  // Their "must be open and not in draft mode" condition fails on a pull request
  // in the queue, because the state it reads is QUEUED rather than OPEN. Their
  // own page hides the requirements behind the queue box, so nobody sees it
  // there; drawn here it was the queue objecting to a pull request it had
  // already taken. Only while standing in the line: a draft the queue has not
  // taken fails the same condition for the reason it names.
  const failed = requirements.conditions
    .filter((condition) => condition.result === "FAILED")
    .filter((condition) => !(inQueue && condition.type === "PULL_REQUEST_STATE"))
    .map((condition) => ({
      name: condition.displayName,
      explanation: whatWentWrong(condition.message) ?? condition.description,
      bypassable: canBeGonePast(condition.ruleRollups),
      about: whatItIsAbout(condition),
      // Only the conflict condition carries either, and both arrive null on a
      // pull request with nothing to say — which is also every payload
      // remembered before these were read at all.
      files: condition.conflicts ?? [],
      mayResolve: condition.isConflictResolvableInWeb === true
    }))

  if (isMergeable || failed.length > 0) return { isMergeable, blockers: failed }

  return {
    isMergeable,
    blockers: [
      {
        name: "Not ready to merge",
        explanation: `GitHub answered ${requirements.state} and listed nothing failing.`,
        bypassable: false,
        about: Option.none(),
        files: [],
        mayResolve: false
      }
    ]
  }
}

/** One of the three this can post, rather than any word GitHub puts in that field. */
const sendable = (name: string): name is MergeMethod =>
  name === "MERGE" || name === "SQUASH" || name === "REBASE"

/** One thing GitHub offers, with the two verdicts it gives everything it offers. */
type Offered = {
  readonly name: string
  readonly allowableStatus?: string | null | undefined
  readonly isDefault?: boolean | null | undefined
}

/**
 * One way in, as the merge box reports it, with the methods it would accept.
 *
 * Named once because two readers want it and want different parts: the queue
 * asks whether this pull request may join the line, and the card asks which of
 * the three a press would send. Spelled out twice, they drifted.
 */
type MergeAction = Offered & {
  readonly mergeMethods?: ReadonlyArray<Offered> | null | undefined
}

/**
 * The one to offer out of a list GitHub gave a verdict on, allowed first.
 *
 * Their own rule for a dropdown, and it holds for both lists shaped this way:
 * the default where the default is allowed, any other allowed one where it is
 * not, and nothing where none of them is. What "allowed" means is GitHub's to
 * say and differs per repository and per base branch, so the flag is read
 * rather than worked out.
 */
const allowedChoice = <A extends Offered>(offers: ReadonlyArray<A>): A | undefined => {
  const allowed = offers.filter((offer) => offer.allowableStatus === "ALLOWED")
  return allowed.find((offer) => offer.isDefault === true) ?? allowed[0]
}

/**
 * Which way a press would land this, out of the ways GitHub says are allowed.
 *
 * Read off the direct merge's own list of methods. GitHub answers per way in —
 * the queue, the direct merge — and each carries the three methods with a
 * verdict apiece and one of them marked the default. The direct merge's list is
 * the one that decides here, because a repository with a queue is not sent a
 * merge method at all: joining the line posts `GROUP` or `SOLO` instead.
 *
 * The direct merge's own `allowableStatus` is deliberately not read. It answers
 * whether the press would go through now, which is what the conditions are for,
 * and it is `BLOCKED` on every pull request held up by anything at all — a
 * failing check included. Reading it would strip the button back to the plain
 * word exactly where a reader most wants to know what the press would write.
 *
 * None where nothing in the list is both allowed and sendable, which greys the
 * button rather than guessing at a word GitHub might refuse.
 */
export const landingMethods = (pullRequest: {
  readonly viewerMergeActions?: ReadonlyArray<MergeAction> | null | undefined
}): { readonly on: Option.Option<MergeMethod>; readonly among: ReadonlyArray<MergeMethod> } => {
  const direct = pullRequest.viewerMergeActions?.find(({ name }) => name === "DIRECT_MERGE")
  // Narrowed before the choice rather than after it, so a fourth word in that
  // field costs the reader the method GitHub prefers and not the button.
  const ours = (direct?.mergeMethods ?? []).flatMap((method) =>
    sendable(method.name) ? [{ ...method, name: method.name }] : []
  )

  const on = Option.fromNullishOr(allowedChoice(ours)?.name)
  return {
    on,
    // In GitHub's order and not with the default first: their own dropdown lists
    // the three the same way round every time, and a list that reorders itself
    // per repository is a list nobody's hand learns. Empty where nothing can be
    // sent, so the two answers agree about a repository with no way in.
    among: Option.isNone(on)
      ? []
      : ours.filter((method) => method.allowableStatus === "ALLOWED").map(({ name }) => name)
  }
}

/**
 * The channels whose firing would change what this page says.
 *
 * Six of the nine GitHub publishes for a pull request. The three left out say
 * nothing this page shows — a deployment finishing costs four requests to
 * redraw the same words — and everything else is in, because a page that is
 * wrong is worse than a page that asked twice. A draft marked ready changes the
 * badge, the blocker and both buttons at once; a workflow finishing changes
 * every line of the checks; a remark left changes the conversation. Watching
 * only the merge, queue and review topics is how a page sits there for half an
 * hour calling a pull request a draft that nobody can merge for an entirely
 * different reason.
 */
const worthWatching = (
  channels?:
    | {
      readonly mergeQueueChannel?: string | null
      readonly gitMergeStateChannel?: string | null
      readonly reviewStateChannel?: string | null
      readonly stateChannel?: string | null
      readonly workflowsChannel?: string | null
      readonly pullRequestChannel?: string | null
    }
    | null
    | undefined
): ReadonlyArray<string> =>
  [
    channels?.mergeQueueChannel,
    channels?.gitMergeStateChannel,
    channels?.reviewStateChannel,
    channels?.stateChannel,
    channels?.workflowsChannel,
    channels?.pullRequestChannel
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

type UpdateMethod = Offered & {
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
  // Past the allowed ones as well, unlike the merge method: this button is
  // drawn either way, and a refused update is the sentence saying why.
  const allowed = allowedChoice(methods)
  const chosen = allowed ?? methods.find((method) => method.isDefault === true) ?? methods[0]
  const how = chosen?.name === "REBASE" ? "REBASE" : "MERGE"

  /*
   * The ways worth offering beside it, which is the allowed ones and the one on
   * the button.
   *
   * The button's own way is in the list whether GitHub allowed it or not,
   * because the button is drawn either way and a caret whose menu did not
   * contain the word above it would be a menu that cannot get back to where it
   * started. Nothing is offered at all where that is the only entry — see
   * `MergeState.methods` for the same rule on the merge.
   */
  const ways = ["MERGE" as const, "REBASE" as const].filter(
    (way) =>
      way === how ||
      methods.some((method) => method.name === way && method.allowableStatus === "ALLOWED")
  )

  return Option.some({
    how,
    ways,
    mayUpdate: allowed !== undefined,
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
  readonly viewerMergeActions?: ReadonlyArray<MergeAction> | null | undefined
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

const lineKindOf = (
  type: "HUNK" | "CONTEXT" | "ADDITION" | "DELETION" | "INJECTED_CONTEXT"
): DiffLineKind => {
  switch (type) {
    case "HUNK":
      return "hunk"
    case "CONTEXT":
    // A line GitHub added to the diff on its own account, which arrives in
    // hunks made entirely of them with both numbers equal. Unchanged content
    // shown for company, which is what a context line is — and what GitHub's
    // own HTML for it draws.
    case "INJECTED_CONTEXT":
      return "context"
    case "ADDITION":
      return "added"
    case "DELETION":
      return "deleted"
  }
}

/**
 * The marker column, which is one character wide and belongs to us from here.
 *
 * GitHub marks an injected line `~` where it marks a context line with a space.
 * Nothing above this seam knows that character: the prose diff cuts the column
 * off by width, and the patch handed to the diff engine is only a patch while
 * every line begins with a space, a plus or a minus. So the marker is made the
 * space it means, and the line goes on as the context line it is.
 */
const markerOf = (type: string, text: string): string =>
  type === "INJECTED_CONTEXT" ? ` ${text.slice(1)}` : text

/**
 * GitHub reports both a left and a right number on every line, including the
 * side the line does not exist on, so each side is kept only where it means
 * something: the old number on deletions, the new number on additions.
 */
const diffLineOf = (line: {
  readonly type: "HUNK" | "CONTEXT" | "ADDITION" | "DELETION" | "INJECTED_CONTEXT"
  readonly text: string
  readonly left: number | null
  readonly right: number | null
}): DiffLine => {
  const kind = lineKindOf(line.type)
  const hasBefore = kind === "context" || kind === "deleted"
  const hasAfter = kind === "context" || kind === "added"
  return {
    kind,
    text: markerOf(line.type, line.text),
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
 * A commit's file, whose content GitHub may not have sent.
 *
 * The absent case is not a failure and not an empty diff: it is a file whose
 * content has to be asked for, which is what {@link Option.none} means
 * everywhere else a file arrives without one.
 */
const commitFileOf = (entry: CommitDiffEntry): ChangedFile => ({
  path: entry.path,
  digest: entry.pathDigest,
  changeType: changeTypeOf(entry.status),
  // GitHub sends no counts with a held-back file. Zero is what the interface
  // already draws for a file it has nothing to say about, and a guess would be
  // worse than a blank.
  linesAdded: entry.linesAdded ?? 0,
  linesDeleted: entry.linesDeleted ?? 0,
  readByViewer: false,
  diff:
    entry.diffLines === undefined
      ? Option.none()
      : Option.some({
          isBinary: entry.isBinary ?? false,
          isTruncated: (entry.isTooBig ?? false) || (entry.truncatedReason ?? null) !== null,
          lines: entry.diffLines.map(diffLineOf)
        })
})

/**
 * One commit and its files, in the shapes the rest of the interface reads.
 *
 * Only the first few files arrive with their diffs. GitHub embeds content until
 * it has spent a byte budget — eight of twenty-two on one recorded commit, seven
 * of five hundred and seventy-five on another — and sends the rest as a name and
 * a status, to be fetched as they are reached. Which is what a pull request
 * page does too, so the file browser already knows how to show one.
 */
export const toCommit = Effect.fn("toCommit")(function* (raw: unknown) {
  const payload = yield* decodeCommit(raw)
  const author = payload.commit.authors[0]
  const headline =
    payload.commit.shortMessage ?? plainText(payload.commit.shortMessageMarkdown ?? "")

  const files: ReadonlyArray<ChangedFile> = payload.diffEntryData.map(commitFileOf)

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

/**
 * What a commit page says about the files it did not send.
 *
 * The two shas are what their route for those files is keyed by, and the cursor
 * is where to start. All three come off the same page the commit itself was read
 * from, so nothing here is guessed and nothing is remembered between calls.
 */
export type HeldBack = {
  readonly sha1: string
  readonly sha2: string
  readonly from: AsyncDiffLoad
}

export const toHeldBack = Effect.fn("toHeldBack")(function* (raw: unknown) {
  const payload = yield* decodeCommit(raw)
  const from = payload.asyncDiffLoadInfo ?? null
  const sha1 = payload.commit.sha1 ?? null
  const sha2 = payload.commit.sha2 ?? payload.commit.oid

  // A commit whose files all arrived, and a root commit with nothing to diff
  // against, both leave nothing to ask for.
  if (from === null || sha1 === null || payload.moreDiffsToLoad !== true) {
    return Option.none<HeldBack>()
  }

  return Option.some<HeldBack>({ sha1, sha2, from })
})

/**
 * One batch of the files a commit page held back.
 *
 * `from` is where the batch after this one starts, absent once there are none
 * left — the walk stops on that rather than on counting files, because only
 * GitHub knows how many it will put in a batch.
 */
export type ExtraDiffs = {
  readonly diffs: ReadonlyArray<FetchedDiff>
  readonly from: Option.Option<AsyncDiffLoad>
}

export const toExtraDiffs = Effect.fn("toExtraDiffs")(function* (raw: unknown) {
  const batch = yield* decodeCommitDiffs(raw)

  const diffs = batch.extraDiffEntries.flatMap((entry) => {
    const file = commitFileOf(entry)
    return Option.isNone(file.diff) ? [] : [{ path: file.path, diff: file.diff.value }]
  })

  const extra: ExtraDiffs = {
    diffs,
    from: batch.loadMore ? Option.fromNullOr(batch.asyncDiffLoadInfo ?? null) : Option.none()
  }

  return extra
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
  const descriptionPayload = yield* decodeDescription(raw.description)
  const issueComments = yield* decodeIssueComments(raw.issueComments)
  /*
   * The three payloads here allowed to be missing.
   *
   * The routes above fail the read, because a pull request drawn without its
   * checks or its threads is a lie in the right shape. These three are not, and
   * what separates them is whether a reader could act on the wrong answer.
   *
   * A proposal is a strip above the header saying these two could be one stack:
   * absent, the interface is exactly what it was yesterday, and refusing the whole
   * pull request over it would trade the page for a decoration.
   *
   * The header carries three moments and nothing else, each already an Option
   * below. Absent, the reader loses the age beside the badge and keeps everything
   * they came to act on.
   *
   * The merge box is the one whose absence has to be said out loud, and it is
   * carried as None rather than as an empty merge state for exactly that reason —
   * see `merge` on `PullRequestSnapshot`. What it costs the page is the card, the
   * verdicts given so far, and the two branch permissions.
   *
   * GitHub served the header and the merge box their crash page on
   * `OpenRouterIncubator/ori` #2087 during their incident of 2026-08-17, at a
   * reported 20% error rate, and the whole pull request was refused over it.
   */
  const preview = yield* decodePreviewStack(raw.preview ?? null).pipe(
    Effect.catch(() => Effect.succeed(null))
  )
  /*
   * Asked only where GitHub sent something, and still allowed to fail on the shape.
   *
   * The reading already tells the two apart: `whateverIsAt` hands back nothing for a
   * refusal, an unreachable network or a body that is not JSON, and the payload itself
   * for everything else. Catching a decode failure here as well would fold the two into
   * one, and they are opposite facts about GitHub. A route that did not answer is an
   * outage, and the next read fixes it. A route that answered in a shape this does not
   * know is a drift, and the next read does not fix anything — somebody has to change
   * this file. That is the whole reason the shapes in `wire.ts` are strict, and it is
   * the alarm the reader gets the "Something GitHub sends has changed" screen from.
   *
   * `preview` above is the exception because `null` is an answer there: GitHub sends it
   * under a 200 for a pull request they would not stack.
   */
  const headerPayload = raw.header === null ? null : yield* decodeHeader(raw.header)
  const mergePayload = raw.mergeBox === null ? null : yield* decodeMergeBox(raw.mergeBox)

  const route = changes
  const viewerLogin = route.user.currentUserLogin
  if (viewerLogin === null) {
    return yield* new NotAuthenticated({ reference })
  }

  const anchors = anchorsIn(route.diffSummaries)

  const threads: ReadonlyArray<ReviewThread> = Object.values(route.markers.threads).map(
    (thread) => ({
      id: thread.id,
      isResolved: thread.isResolved,
      canReply: thread.viewerCanReply ?? true,
      at: Option.fromNullOr(anchors.get(thread.id) ?? null),
      comments: thread.commentsData.comments.map((comment) => {
        const author = participantOf(comment.author)
        return {
          id: comment.databaseId === null ? undefined : comment.databaseId?.toString(),
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

  // Minimised remarks are left out rather than dimmed: GitHub folds them away
  // on their own page, and what is behind the fold is a duplicate deploy notice
  // or an off-topic aside somebody has already decided is not worth reading.
  const remarks: ReadonlyArray<Remark> = issueComments.flatMap((comment) =>
    comment.isHidden
      ? []
      : [
          {
            id: comment.id,
            author: {
              login: comment.authorLogin,
              isAutomated: APP.test(comment.authorLogin),
              faceUrl: Option.fromNullishOr(comment.authorAvatarUrl)
            },
            body: comment.body,
            html: comment.bodyHtml,
            createdAt: comment.createdAt
          }
        ]
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

  /** What the merge box said, absent as one value so the two fields off it agree. */
  const box = Option.fromNullOr(mergePayload)

  // A pending review is an unsubmitted draft, so it is not yet a review at all.
  const reviews: Option.Option<ReadonlyArray<Review>> = Option.map(box, (said) =>
    said.pullRequest.latestOpinionatedReviews.flatMap((review) =>
      review.state === "PENDING"
        ? []
        : [{ reviewer: participantOf(review.author), decision: decisionOf(review.state) }]
    )
  )

  const snapshot: PullRequestSnapshot = {
    reference,
    title: route.pullRequest.title,
    // A description nobody wrote is empty text rather than absent: everything
    // downstream asks whether there is anything to draw, and "" answers that.
    description: { markdown: descriptionPayload.body ?? "", html: descriptionPayload.bodyHtml },
    state: stateOf(route.pullRequest.state),
    openedAt: Option.fromNullishOr(headerPayload?.pullRequest.createdTime),
    closedAt: Option.fromNullishOr(headerPayload?.pullRequest.closedTime),
    mergedAt: Option.fromNullishOr(headerPayload?.pullRequest.mergedTime),
    author: participantOf(route.pullRequest.author),
    baseBranch: route.pullRequest.baseBranch,
    headBranch: route.pullRequest.headBranch,
    // Absent reads as no rather than as unknown, which is the reading that
    // cannot go wrong: a control this never offers is one GitHub was never
    // asked to refuse, and an offer made off a payload that said nothing is a
    // branch deleted on a guess.
    headRef: {
      mayDelete: mergePayload?.pullRequest.viewerCanDeleteHeadRef === true,
      mayRestore: mergePayload?.pullRequest.viewerCanRestoreHeadRef === true
    },
    proposal: preview === null ? Option.none() : proposalIn(reference, preview),
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
    remarks,
    checks,
    reviews,
    merge: Option.map(box, (said) => {
      const landing = landingMethods(said.pullRequest)
      const queue = mergeQueue(said.pullRequest)
      return {
        ...whatIsInTheWay(
          said.mergeRequirements,
          Option.exists(queue, (said) => said.waiting)
        ),
        queue,
        autoMerge: autoMergeOf(said.pullRequest),
        mayBypass: said.pullRequest.viewerCanAdminBypassMergeRequirements === true,
        update: branchUpdate(said.pullRequest),
        channels: worthWatching(said.pullRequest.mergeBoxAliveChannels),
        stack: stackIn(
          reference,
          route.pullRequest.baseBranch,
          said.pullRequest.stackedBaseRefName,
          said.mergeRequirements?.conditions ?? []
        ),
        method: landing.on,
        methods: landing.among
      }
    })
  }

  return snapshot
})
