import { Context, Data, Effect, Layer, Option } from "effect"
import type {
  Check,
  CheckNote,
  LogLine,
  CommitDetail,
  FetchedDiff,
  NewComment,
  PullRequestSnapshot,
  ReviewThread
} from "../domain/PullRequest"
import type { PullRequestRef, RepoRef } from "../domain/PullRequestRef"
import { checkRunIn, notesIn } from "./annotations"
import { linesIn, tailOf } from "./logs"
import { recall, remember } from "./cache"
import {
  type HeldBack,
  type RawPayloads,
  toCommit,
  toCreatedThread,
  toDiffs,
  toExtraDiffs,
  toHeldBack,
  toSnapshot
} from "./snapshot"
import type { AsyncDiffLoad } from "./wire"

export type GatewayFailure = "unreachable" | "rejected" | "undecodable" | "not-recorded"

export class GatewayError extends Data.TaggedError("GatewayError")<{
  /**
   * Where it happened. A repository is enough, because the calls that fail
   * about a commit have no pull request to name and a reader shown the error
   * is being told which page could not be read, not which number it had.
   */
  readonly reference: RepoRef
  readonly route: string
  readonly reason: GatewayFailure
  readonly detail: string
}> {}

/**
 * The only adapter to GitHub, and the system's single seam. It speaks the
 * vocabulary in CONTEXT.md rather than GitHub's field names, so everything
 * above it is insulated from both GitHub's schema and the choice of transport.
 */
export class GitHubGateway extends Context.Service<
  GitHubGateway,
  {
    readonly snapshot: (
      reference: PullRequestRef
    ) => Effect.Effect<PullRequestSnapshot, GatewayError>
    /**
     * The pull request as it was the last time it was read, without asking
     * GitHub anything.
     *
     * Answers in about as long as a storage read against the second or more a
     * live read costs, which is the difference between a page that appears and
     * a page that loads. Nothing it gives is current, and nothing above it
     * should treat it as though it were: it is what goes on the screen while
     * {@link snapshot} finds out what actually is.
     *
     * It cannot fail. No store, an entry written by an older build, a payload
     * GitHub has since changed — all of them mean the same thing to whoever
     * asked, which is that the network is the only way to find out.
     */
    readonly remembered: (
      reference: PullRequestRef
    ) => Effect.Effect<Option.Option<PullRequestSnapshot>>
    /**
     * The content for files the page arrived without.
     *
     * `head` is the commit the diff is against, which the snapshot carries as
     * its head sha.
     */
    readonly diffs: (
      reference: PullRequestRef,
      head: string,
      paths: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<FetchedDiff>, GatewayError>
    /**
     * What GitHub wrote against a check that has something to say.
     *
     * Empty for a check with nothing written against it, and for one whose
     * page no longer looks the way this reads — both of which are ordinary,
     * and neither of which is a failure.
     */
    readonly notes: (
      reference: PullRequestRef,
      check: Check
    ) => Effect.Effect<ReadonlyArray<CheckNote>, GatewayError>
    /**
     * One step's log, for the note that points into it.
     *
     * A step at a time rather than the whole job: a job's log runs to
     * megabytes and a step's to a few kilobytes, and a note names its step.
     */
    readonly log: (
      reference: PullRequestRef,
      sha: string,
      check: Check,
      step: number
    ) => Effect.Effect<ReadonlyArray<LogLine>, GatewayError>
    /**
     * The end of a check's whole log, for a check that pointed at no line.
     *
     * A check that passed, and a check that failed without writing anything
     * against itself, both leave the dialog with nothing to show. The end of
     * the log is where both of them say what happened.
     */
    readonly tail: (
      reference: PullRequestRef,
      sha: string,
      check: Check,
      keep: number
    ) => Effect.Effect<ReadonlyArray<LogLine>, GatewayError>
    /**
     * One commit of the branch, with everything it changed.
     *
     * Read from the page GitHub serves for a commit rather than from the pull
     * request's routes: a commit belongs to the repository, not to the pull
     * request that happens to carry it.
     */
    readonly commit: (
      reference: RepoRef,
      sha: string
    ) => Effect.Effect<CommitDetail, GatewayError>
    /**
     * The content for files a commit page arrived without.
     *
     * A commit page embeds diffs until it has spent a byte budget and sends
     * every file after that as a name and a status, exactly as a pull request
     * page does. What differs is how the rest are asked for: their route takes
     * no list of paths — it accepts one and ignores it — and hands out batches
     * walking forward from a cursor, so reaching a file means passing every file
     * before it.
     *
     * Which is why this answers with everything it walked past rather than only
     * what was asked for. Whoever asked keeps the lot, so the walk is paid for
     * once instead of once per file.
     */
    readonly commitDiffs: (
      reference: RepoRef,
      sha: string,
      paths: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<FetchedDiff>, GatewayError>
    /**
     * Merges the pull request, the way their own merge button does.
     *
     * The only call here that changes anything at GitHub, and the only one
     * whose failure a reader has to be told about: everything else can be
     * retried by looking again.
     */
    /**
     * Writes a comment against some lines, the way their own box does.
     *
     * Posted at once rather than held as part of a review: a remark typed into
     * a diff is a remark meant to be read, and a batch that has to be submitted
     * somewhere else is how comments end up sitting unsent for a day.
     */
    readonly comment: (
      reference: PullRequestRef,
      note: NewComment
    ) => Effect.Effect<ReviewThread, GatewayError>
    readonly merge: (
      reference: PullRequestRef,
      method: MergeMethod
    ) => Effect.Effect<void, GatewayError>
    /**
     * Puts it in the queue, on the repositories that land through one.
     *
     * Their own route for this is `enable_auto_merge`, which on a queue
     * repository takes neither a merge method nor a commit message: `GROUP` or
     * `SOLO`, and GitHub does the rest when this pull request's turn comes.
     */
    readonly enqueue: (
      reference: PullRequestRef,
      how: QueueMethod
    ) => Effect.Effect<void, GatewayError>
    /** Takes it back out of the queue, which is a route of its own. */
    readonly dequeue: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Calls off a merge GitHub is holding.
     *
     * Undoes {@link enqueue} on a repository with a queue and an ordinary
     * auto-merge on one without, because to GitHub those were the same request.
     */
    readonly cancelAutoMerge: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Brings the branch up to date with the one it would land on.
     *
     * `MERGE` puts the base into the branch and always works; `REBASE` rewrites
     * the branch and often cannot. Which is asked for is GitHub's own verdict,
     * read off the pull request, rather than a choice made here.
     */
    readonly updateBranch: (
      reference: PullRequestRef,
      how: UpdateMethod
    ) => Effect.Effect<void, GatewayError>
    /**
     * Closes it without merging, the way their own button at the foot of the
     * conversation does.
     *
     * Nothing is lost by it — a closed pull request keeps its branch, its
     * comments and its diff, and GitHub will reopen it — but it is still the
     * one control here that ends the reading, so its refusals are worth
     * repeating word for word.
     */
    readonly close: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Takes it out of draft, which is the whole of what a draft is stopping.
     *
     * GitHub refuses to merge a draft and says so as a condition about the
     * pull request's state, so this is the one write here that turns a blocker
     * into no blocker rather than changing what is being reviewed.
     */
    readonly markReady: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /** Puts it back, for a pull request opened before it was meant to be read. */
    readonly toDraft: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
  }
>()("GitHubGateway") {}

/** The three ways GitHub will put a branch into another one. */
export type MergeMethod = "MERGE" | "SQUASH" | "REBASE"

/**
 * The two ways into a merge queue.
 *
 * `GROUP` is what their own button sends: batched with whatever else is
 * waiting. `SOLO` asks to be tested and merged alone, and is a separate
 * permission.
 */
export type QueueMethod = "GROUP" | "SOLO"

/** The two ways of catching a branch up with its base. */
export type UpdateMethod = "MERGE" | "REBASE"

const CHANGES = "/changes"
const STATUS_CHECKS = "/page_data/status_checks"
const MERGE_BOX = "/page_data/merge_box?merge_method=MERGE&bypass_requirements=false"
const DESCRIPTION = "/page_data/description"
const MERGE = "/page_data/merge"
const COMMENT = "/page_data/create_review_comment"
const ENQUEUE = "/page_data/enable_auto_merge"
const DEQUEUE = "/page_data/dequeue_pull_request"
const CANCEL_AUTO_MERGE = "/page_data/disable_auto_merge"
const UPDATE_BRANCH = "/page_data/update_pull_request_branch"
const CLOSE = "/page_data/close_pull_request"
const MARK_READY = "/page_data/mark_ready_for_review"
const TO_DRAFT = "/page_data/convert_to_draft"

// GitHub answers 406 to these routes without the XMLHttpRequest header.
const REQUIRED_HEADERS = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest"
}

/**
 * What their own merge button sends, less what it turns out not to need.
 *
 * Recorded from a real merge and then cut down against a scratch pull request
 * one header at a time: the nonce and the client version their bundle attaches
 * are not checked, but `GitHub-Verified-Fetch` is — it is what stands in for a
 * CSRF token on these routes, and the cookies do the rest.
 */
const WRITING_HEADERS = {
  ...REQUIRED_HEADERS,
  "Content-Type": "application/json",
  "GitHub-Verified-Fetch": "true"
}

const decodeInto = (reference: PullRequestRef, raw: RawPayloads) =>
  toSnapshot(reference, raw).pipe(
    Effect.catch((cause) =>
      Effect.fail(
        new GatewayError({
          reference,
          route: CHANGES,
          reason: "undecodable",
          detail: String(cause)
        })
      )
    )
  )

const fetchRoute = Effect.fn("fetchRoute")(function* (
  reference: PullRequestRef,
  route: string
) {
  const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${route}`

  const response = yield* Effect.tryPromise({
    try: (): Promise<Response> =>
      fetch(url, { headers: REQUIRED_HEADERS, credentials: "include" }),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  if (!response.ok) {
    return yield* new GatewayError({
      reference,
      route,
      reason: "rejected",
      detail: `HTTP ${response.status}`
    })
  }

  return yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
  })
})

/**
 * A write whose answer is only whether it worked.
 *
 * The queue routes return a sentence and nothing else, so there is nothing to
 * decode and one thing to report: what GitHub said when it said no. Routes that
 * hand back an object worth reading — a merge, a posted comment — keep their
 * own bodies rather than pretending this shape fits them.
 */
const posting = Effect.fn("posting")(function* (
  reference: PullRequestRef,
  route: string,
  body?: Readonly<Record<string, string>>
) {
  const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${route}`

  const response = yield* Effect.tryPromise({
    try: (): Promise<Response> =>
      fetch(url, {
        method: "POST",
        headers: WRITING_HEADERS,
        credentials: "include",
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  const said = yield* Effect.promise(() => response.text().catch(() => ""))

  if (!response.ok) {
    return yield* new GatewayError({
      reference,
      route,
      reason: "rejected",
      detail: reasonGiven(said) ?? `HTTP ${response.status}`
    })
  }
})

/**
 * The route their own Files tab uses for the diffs it was not given.
 *
 * The paths are encoded twice on purpose: the parameter is a comma-separated
 * list of already-encoded paths, so a path containing a comma survives the
 * round trip. `ctx` asks for the default amount of context around each hunk.
 */
const diffEntriesRoute = (head: string, paths: ReadonlyArray<string>): string => {
  const list = paths.map((path) => encodeURIComponent(path)).join(",")
  return `/page_data/diff_entries?paths=${encodeURIComponent(list)}&ctx=${encodeURIComponent(":::")}&w=0&range=${head}`
}

/**
 * A commit's own page, asked for as data.
 *
 * The `_pjax` parameter is what their navigation sends when it wants the next
 * page's payload instead of a document, and it answers with the same JSON the
 * page would have been built from — diff lines and all.
 */
const commitRoute = (sha: string): string =>
  `/commit/${sha}?_pjax=%23repo-content-pjax-container`

/**
 * One batch of the files a commit page did not send, asked for as their own
 * page asks for it while being scrolled.
 *
 * `start_entry`, `bytes` and `lines` are the cursor GitHub gave with the last
 * answer, handed straight back. A `paths` parameter is accepted here and
 * ignored, so there is no asking for a file by name — the walk is the only way.
 */
const commitDiffsRoute = (sha: string, held: HeldBack, from: AsyncDiffLoad): string =>
  `/diffs?commit=${sha}&sha2=${held.sha2}&sha1=${held.sha1}&start_entry=${from.startIndex}&bytes=${from.byteCount}&lines=${from.lineShownCount}`

/**
 * How far the walk will go before giving up.
 *
 * The largest commit on a real pull request — a merge of five hundred and
 * seventy-five files — was covered in twenty batches. This is above that and
 * below forever, so a route that answered `loadMore` for ever cannot hang the
 * panel that asked.
 */
const MOST_BATCHES = 30

/**
 * A repository route read as JSON.
 *
 * Beside {@link fetchRoute}, which knows the pull request's number. A commit
 * belongs to the repository rather than to the pull request carrying it, so its
 * routes have no number to put in the path.
 */
const readRepoRoute = Effect.fn("GitHubGateway.readRepoRoute")(function* (
  reference: RepoRef,
  route: string
) {
  const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

  const response = yield* Effect.tryPromise({
    try: (): Promise<Response> => fetch(url, { headers: REQUIRED_HEADERS, credentials: "include" }),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  if (!response.ok) {
    return yield* new GatewayError({
      reference,
      route,
      reason: "rejected",
      detail: `HTTP ${response.status}`
    })
  }

  return yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
  })
})

/** What a payload that would not decode becomes, on the way out of here. */
const undecodableFrom =
  (reference: RepoRef, route: string) =>
  (cause: unknown): Effect.Effect<never, GatewayError> =>
    Effect.fail(new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) }))

export const layer = Layer.succeed(GitHubGateway, {
    snapshot: Effect.fn("GitHubGateway.snapshot")(function* (reference: PullRequestRef) {
      const raw = yield* Effect.all(
        {
          changes: fetchRoute(reference, CHANGES),
          statusChecks: fetchRoute(reference, STATUS_CHECKS),
          mergeBox: fetchRoute(reference, MERGE_BOX),
          description: fetchRoute(reference, DESCRIPTION)
        },
        { concurrency: "unbounded" }
      )

      const snapshot = yield* decodeInto(reference, raw)

      // Kept only once it has decoded, and forked rather than waited for. The
      // pull request this was read for is about to be on the screen either way;
      // the write only affects how quickly the next visit is, and paying for
      // that now would be an odd trade.
      yield* Effect.forkDetach(remember(reference, raw))

      return snapshot
    }),

    remembered: Effect.fn("GitHubGateway.remembered")(function* (reference: PullRequestRef) {
      const raw = yield* recall(reference)
      if (Option.isNone(raw)) return Option.none<PullRequestSnapshot>()

      // Decoded through exactly the path a live read takes. A payload kept
      // before a schema changed fails here and is a miss, where a stored
      // snapshot would have been a lie in the right shape.
      return yield* decodeInto(reference, raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<PullRequestSnapshot>()))
      )
    }),

    comment: Effect.fn("GitHubGateway.comment")(function* (
      reference: PullRequestRef,
      note: NewComment
    ) {
      const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${COMMENT}`
      // Their own box sends the range twice — once flat, once inside the
      // positioning it wants back — and refuses a body that carries only one
      // of them. A single line is a range whose ends agree.
      const range = note.startLine === note.line ? {} : { startLine: note.startLine, startSide: "right" }
      const body = {
        comparisonStartOid: note.baseSha,
        comparisonEndOid: note.headSha,
        text: note.body,
        submitBatch: true,
        path: note.path,
        line: note.line,
        side: "right",
        subjectType: "line",
        ...range,
        positioning: {
          type: "line",
          baseCommitOid: note.baseSha,
          headCommitOid: note.headSha,
          commitOid: note.headSha,
          path: note.path,
          line: note.line,
          ...range
        }
      }

      const response = yield* Effect.tryPromise({
        try: (): Promise<Response> =>
          fetch(url, {
            method: "POST",
            headers: WRITING_HEADERS,
            credentials: "include",
            body: JSON.stringify(body)
          }),
        catch: (cause) =>
          new GatewayError({
            reference,
            route: COMMENT,
            reason: "unreachable",
            detail: String(cause)
          })
      })

      const said = yield* Effect.promise(() => response.text().catch(() => ""))

      if (!response.ok) {
        return yield* new GatewayError({
          reference,
          route: COMMENT,
          reason: "rejected",
          detail: reasonGiven(said) ?? `HTTP ${response.status}`
        })
      }

      return yield* toCreatedThread(JSON.parse(said), {
        path: note.path,
        side: "after",
        line: note.line,
        startLine: note.startLine
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({
              reference,
              route: COMMENT,
              reason: "undecodable",
              detail: String(cause)
            })
          )
        )
      )
    }),

    merge: Effect.fn("GitHubGateway.merge")(function* (
      reference: PullRequestRef,
      method: MergeMethod
    ) {
      const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${MERGE}`

      const response = yield* Effect.tryPromise({
        try: (): Promise<Response> =>
          fetch(url, {
            method: "POST",
            headers: WRITING_HEADERS,
            credentials: "include",
            // Their button sends a commit title and message as well; left out, so
            // GitHub writes the same ones it would have suggested.
            body: JSON.stringify({ mergeMethod: method, bypassBranchProtections: false })
          }),
        catch: (cause) =>
          new GatewayError({ reference, route: MERGE, reason: "unreachable", detail: String(cause) })
      })

      const said = yield* Effect.promise(() => response.text().catch(() => ""))

      if (!response.ok) {
        return yield* new GatewayError({
          reference,
          route: MERGE,
          reason: "rejected",
          // Their refusals are a sentence in a JSON body, and that sentence is
          // the only thing worth putting in front of whoever pressed the button.
          detail: reasonGiven(said) ?? `HTTP ${response.status}`
        })
      }
    }),

    enqueue: Effect.fn("GitHubGateway.enqueue")(function* (
      reference: PullRequestRef,
      how: QueueMethod
    ) {
      // Their own button sends `GROUP` here, in the field a repository without
      // a queue uses for SQUASH or REBASE. The route is not fussy about it —
      // a value it cannot read is ignored rather than refused, and the request
      // succeeds having done something else — so nothing else goes in the body.
      yield* posting(reference, ENQUEUE, { mergeMethod: how })
    }),

    dequeue: Effect.fn("GitHubGateway.dequeue")(function* (reference: PullRequestRef) {
      yield* posting(reference, DEQUEUE)
    }),

    cancelAutoMerge: Effect.fn("GitHubGateway.cancelAutoMerge")(function* (
      reference: PullRequestRef
    ) {
      yield* posting(reference, CANCEL_AUTO_MERGE)
    }),

    updateBranch: Effect.fn("GitHubGateway.updateBranch")(function* (
      reference: PullRequestRef,
      how: UpdateMethod
    ) {
      yield* posting(reference, UPDATE_BRANCH, { updateMethod: how })
    }),

    close: Effect.fn("GitHubGateway.close")(function* (reference: PullRequestRef) {
      yield* posting(reference, CLOSE)
    }),

    markReady: Effect.fn("GitHubGateway.markReady")(function* (reference: PullRequestRef) {
      yield* posting(reference, MARK_READY)
    }),

    toDraft: Effect.fn("GitHubGateway.toDraft")(function* (reference: PullRequestRef) {
      yield* posting(reference, TO_DRAFT)
    }),

    notes: Effect.fn("GitHubGateway.notes")(function* (reference: PullRequestRef, check: Check) {
      const run = checkRunIn(check)
      // Only Actions checks have one of these pages. A check from anything
      // else links somewhere we know nothing about, and has no notes here.
      if (run === undefined) return []

      const route = `/checks?check_run_id=${run}`
      const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${route}`

      const response = yield* Effect.tryPromise({
        try: (): Promise<Response> =>
          // Their Checks tab as a document, because the annotations are written
          // into it and published nowhere else. Deliberately not the JSON
          // routes: those answer with a shell GitHub fills in later.
          fetch(url, { headers: { Accept: "text/html" }, credentials: "include" }),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
      })

      if (!response.ok) {
        return yield* new GatewayError({
          reference,
          route,
          reason: "rejected",
          detail: `HTTP ${response.status}`
        })
      }

      const html = yield* Effect.tryPromise({
        try: (): Promise<string> => response.text(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
      })

      return notesIn(html)
    }),

    log: Effect.fn("GitHubGateway.log")(function* (
      reference: PullRequestRef,
      sha: string,
      check: Check,
      step: number
    ) {
      const run = checkRunIn(check)
      if (run === undefined) return []

      const route = `/checks/${run}/logs/${step}`
      const url = `https://github.com/${reference.owner}/${reference.repo}/commit/${sha}${route}`

      const response = yield* Effect.tryPromise({
        try: (): Promise<Response> =>
          // Credentials deliberately left at their default. This route answers
          // with a redirect to the cloud storage the log actually lives in,
          // which allows any origin to read it but not to send anything of its
          // own: asking for cookies to be included makes that allowance void
          // and the read fails outright. The default sends them to GitHub,
          // which needs them, and drops them at the redirect, which does not.
          fetch(url, { headers: { Accept: "text/plain" } }),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
      })

      if (!response.ok) {
        return yield* new GatewayError({
          reference,
          route,
          reason: "rejected",
          detail: `HTTP ${response.status}`
        })
      }

      const log = yield* Effect.tryPromise({
        try: (): Promise<string> => response.text(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
      })

      return linesIn(log)
    }),

    tail: Effect.fn("GitHubGateway.tail")(function* (
      reference: PullRequestRef,
      sha: string,
      check: Check,
      keep: number
    ) {
      const run = checkRunIn(check)
      if (run === undefined) return []

      const route = `/checks/${run}/logs`
      const url = `https://github.com/${reference.owner}/${reference.repo}/commit/${sha}${route}`

      const response = yield* Effect.tryPromise({
        try: (): Promise<Response> => fetch(url, { headers: { Accept: "text/plain" } }),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
      })

      if (!response.ok || response.body === null) {
        return yield* new GatewayError({
          reference,
          route,
          reason: "rejected",
          detail: `HTTP ${response.status}`
        })
      }

      // Read in pieces and thrown away as it goes. A whole job's log has no
      // upper bound worth trusting, and the end is the part being asked for.
      const tail = yield* Effect.tryPromise({
        try: () => tailOf(response.body as ReadableStream<Uint8Array>, keep),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
      })

      return linesIn(tail.text, tail.startAt)
    }),

    commit: Effect.fn("GitHubGateway.commit")(function* (reference: RepoRef, sha: string) {
      const route = commitRoute(sha)
      const raw = yield* readRepoRoute(reference, route)

      return yield* toCommit(raw).pipe(Effect.catch(undecodableFrom(reference, route)))
    }),

    commitDiffs: Effect.fn("GitHubGateway.commitDiffs")(function* (
      reference: RepoRef,
      sha: string,
      paths: ReadonlyArray<string>
    ) {
      const page = commitRoute(sha)
      const held = yield* toHeldBack(yield* readRepoRoute(reference, page)).pipe(
        Effect.catch(undecodableFrom(reference, page))
      )

      if (Option.isNone(held)) return []

      // Struck off as they arrive. The walk is over once nothing asked for is
      // still missing, which on most commits is the first batch.
      const missing = new Set(paths)
      const found: Array<FetchedDiff> = []
      let from = Option.some(held.value.from)
      let batches = 0

      while (Option.isSome(from) && missing.size > 0 && batches < MOST_BATCHES) {
        const route = commitDiffsRoute(sha, held.value, from.value)
        const batch = yield* toExtraDiffs(yield* readRepoRoute(reference, route)).pipe(
          Effect.catch(undecodableFrom(reference, route))
        )
        batches += 1

        for (const diff of batch.diffs) {
          found.push(diff)
          missing.delete(diff.path)
        }

        from = batch.from
      }

      return found
    }),

    diffs: Effect.fn("GitHubGateway.diffs")(function* (
      reference: PullRequestRef,
      head: string,
      paths: ReadonlyArray<string>
    ) {
      const route = diffEntriesRoute(head, paths)
      const raw = yield* fetchRoute(reference, route)

      return yield* toDiffs(raw).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
          )
        )
      )
    })
})

/** The sentence out of GitHub's answer, when it left one. */
const reasonGiven = (body: string): string | undefined => {
  try {
    const said: unknown = JSON.parse(body)
    const message = (said as { message?: unknown })?.message
    return typeof message === "string" && message.length > 0 ? message : undefined
  } catch {
    return undefined
  }
}

export type Recording = {
  readonly reference: PullRequestRef
  readonly payloads: RawPayloads
}

const notRecorded = (reference: PullRequestRef) =>
  new GatewayError({
    reference,
    route: CHANGES,
    reason: "not-recorded",
    detail: `No recording for ${reference.owner}/${reference.repo}#${reference.number}`
  })

/** The same, for the calls that are about a repository rather than a number. */
const nothingRecordedFor = (reference: RepoRef) =>
  new GatewayError({
    reference,
    route: CHANGES,
    reason: "not-recorded",
    detail: `No recording for ${reference.owner}/${reference.repo}`
  })

const sameReference = (left: PullRequestRef, right: PullRequestRef): boolean =>
  left.owner === right.owner && left.repo === right.repo && left.number === right.number

/**
 * The same decoding path as the live gateway, fed from recorded payloads
 * instead of the network, so tests exercise real decoding rather than a
 * hand-written stand-in that cannot drift with GitHub.
 */
export const layerFromRecordings = (recordings: ReadonlyArray<Recording>) =>
  Layer.succeed(GitHubGateway, {
    snapshot: (reference: PullRequestRef) => {
      const recording = recordings.find((candidate) =>
        sameReference(candidate.reference, reference)
      )
      if (recording === undefined) return Effect.fail(notRecorded(reference))
      return decodeInto(reference, recording.payloads)
    },
    // Nothing was read before this test began. A test that wants to watch what
    // a remembered pull request does to the screen says so with a layer of its
    // own, which is what the seam is for.
    remembered: () => Effect.succeed(Option.none()),
    // A recording is one page as GitHub served it, and the files it held back
    // are exactly the ones no recording contains.
    diffs: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    commit: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    commitDiffs: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    // A recording is the pull request's own routes, and the Checks tab is not
    // one of them: nothing was written against these checks here.
    notes: () => Effect.succeed([]),
    log: () => Effect.succeed([]),
    tail: () => Effect.succeed([]),
    comment: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    merge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    enqueue: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    dequeue: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    cancelAutoMerge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    updateBranch: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    close: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    markReady: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    toDraft: (reference: PullRequestRef) => Effect.fail(notRecorded(reference))
  })

/**
 * Serves snapshots built by hand, for the cases no real payload can express —
 * a Participant who is the Author of the pull request they are looking at, for
 * instance. Decoding is covered by {@link layerFromRecordings}.
 */
export const layerFromSnapshots = (snapshots: ReadonlyArray<PullRequestSnapshot>) =>
  Layer.succeed(GitHubGateway, {
    snapshot: (reference: PullRequestRef) => {
      const found = snapshots.find((candidate) =>
        sameReference(candidate.reference, reference)
      )
      return found === undefined ? Effect.fail(notRecorded(reference)) : Effect.succeed(found)
    },
    remembered: () => Effect.succeed(Option.none()),
    diffs: (reference: PullRequestRef, _head: string, paths: ReadonlyArray<string>) => {
      const found = snapshots.find((candidate) => sameReference(candidate.reference, reference))
      if (found === undefined) return Effect.fail(notRecorded(reference))

      return Effect.succeed(
        found.files.flatMap((file) =>
          paths.includes(file.path) && Option.isSome(file.diff)
            ? [{ path: file.path, diff: file.diff.value }]
            : []
        )
      )
    },
    commit: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    commitDiffs: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    notes: () => Effect.succeed([]),
    log: () => Effect.succeed([]),
    tail: () => Effect.succeed([]),
    // Nothing to merge into: these snapshots are made up, and a test that wants
    // to watch a merge should say so with its own gateway.
    comment: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    merge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    enqueue: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    dequeue: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    cancelAutoMerge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    updateBranch: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    close: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    markReady: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    toDraft: (reference: PullRequestRef) => Effect.fail(notRecorded(reference))
  })
