import { Context, Data, Effect, Layer, Option } from "effect"
import type {
  Check,
  CheckNote,
  CommitDetail,
  FetchedDiff,
  PullRequestSnapshot
} from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { checkRunIn, notesIn } from "./annotations"
import { recall, remember } from "./cache"
import { type RawPayloads, toCommit, toDiffs, toSnapshot } from "./snapshot"

export type GatewayFailure = "unreachable" | "rejected" | "undecodable" | "not-recorded"

export class GatewayError extends Data.TaggedError("GatewayError")<{
  readonly reference: PullRequestRef
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
     * One commit of the branch, with everything it changed.
     *
     * Read from the page GitHub serves for a commit rather than from the pull
     * request's routes: a commit belongs to the repository, not to the pull
     * request that happens to carry it.
     */
    readonly commit: (
      reference: PullRequestRef,
      sha: string
    ) => Effect.Effect<CommitDetail, GatewayError>
    /**
     * Merges the pull request, the way their own merge button does.
     *
     * The only call here that changes anything at GitHub, and the only one
     * whose failure a reader has to be told about: everything else can be
     * retried by looking again.
     */
    readonly merge: (
      reference: PullRequestRef,
      method: MergeMethod
    ) => Effect.Effect<void, GatewayError>
  }
>()("GitHubGateway") {}

/** The three ways GitHub will put a branch into another one. */
export type MergeMethod = "MERGE" | "SQUASH" | "REBASE"

const CHANGES = "/changes"
const STATUS_CHECKS = "/page_data/status_checks"
const MERGE_BOX = "/page_data/merge_box?merge_method=MERGE&bypass_requirements=false"
const DESCRIPTION = "/page_data/description"
const MERGE = "/page_data/merge"

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

    commit: Effect.fn("GitHubGateway.commit")(function* (reference: PullRequestRef, sha: string) {
      const route = commitRoute(sha)
      const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

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

      const raw = yield* Effect.tryPromise({
        try: (): Promise<unknown> => response.json(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
      })

      return yield* toCommit(raw).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
          )
        )
      )
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
    commit: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    // A recording is the pull request's own routes, and the Checks tab is not
    // one of them: nothing was written against these checks here.
    notes: () => Effect.succeed([]),
    merge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference))
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
    commit: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    notes: () => Effect.succeed([]),
    // Nothing to merge into: these snapshots are made up, and a test that wants
    // to watch a merge should say so with its own gateway.
    merge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference))
  })
