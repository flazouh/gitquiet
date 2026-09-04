import { Effect, Layer, Option, UndefinedOr } from "effect"
import type {
  Check,
  CheckState,
  CommitDetail,
  FetchedDiff,
  MergeMethod,
  NewComment,
  Participant,
  PullRequestSnapshot,
  PullRequestState,
  Remark,
  ThreadAnchor
} from "../domain/PullRequest"
import type { PullRequestRef, RepoRef } from "../domain/PullRequestRef"
import type { Tab } from "../domain/tabs"
import type { Portrait } from "../domain/portrait"
import type { InvolvedPullRequest, Shelf, Sizes, Standings } from "../domain/workingSet"
import {
  GatewayError,
  GitHubGateway,
  WorkingSetError,
  type Found,
  type FoundDiscussions,
  type FoundIssues,
  type QueueMethod,
  type Review,
  type UpdateMethod,
  type Verdict
} from "../ports/GitHubGateway"
import { checkRunIn, notesIn } from "./annotations"
import {
  CHANGES,
  fetchRoute,
  ISSUE_COMMENTS,
  MERGE_BOX,
  PREVIEW_STACK,
  refusedBy,
  REQUIRED_HEADERS,
  saidAt,
  type Said
} from "./asking"
import { contributionsIn, contributionsRoute } from "./contributions"
import { askingOnce } from "./flight"
import { hovercardRoute, portraitIn } from "./hovercard"
import { payloadsThroughWorker } from "./throughTheWorker"
import {
  decodeDeferred,
  decodeDiffstat,
  decodeQuery,
  decodeShelf,
  involvedIn,
  sizeIn,
  standingsIn
} from "./involved"
import { linesIn } from "../domain/logs"
import { tailOf } from "./logs"
import { jobIn, runIn, stepsIn } from "./steps"
import { runsBehind, tolerating } from "./tolerance"
import type { Pressing, RunOpening, RunRef } from "../domain/run"
import { isKeptRun, pressOn, runOnPage } from "./runPage"
import { isKeptStrands, runsOnPage } from "./actionsList"
import { buildsOnPage, isKeptVersions, versionsOnPage } from "./releasesList"
import {
  categoriesOnPage,
  discussionsOnPage,
  hasMoreAfter,
  isKeptFound
} from "./discussionsList"
import { discussionOnPage, isKeptDiscussion } from "./discussionView"
import { doingsIn, menuRouteIn, sending, sendingOf } from "./discussionForms"
import { isKeptNotices, noticesOnPage } from "./notifications"
import { asKept, personKept } from "./keptPerson"
import { personOnPage } from "./person"
import { hasNextOnPage, repositoriesOnPage } from "./personRepos"
import { type Person, tabRoute } from "../domain/person"
import type { Notice, Press } from "../domain/notices"
import type { Version } from "../domain/release"
import { strandsIn, type Strand } from "../domain/strand"
import {
  forget,
  forgetRoute,
  recall,
  recallHash,
  recallRoute,
  recallRows,
  remember,
  rememberBranches,
  rememberHash,
  rememberLanded,
  rememberRoute,
  rememberSize,
  rememberStanding,
  rememberStat,
  recallStats
} from "./cache"
import type { Keeping } from "./cache"
import {
  type HeldBack,
  type RawPayloads,
  decodeMergeBox,
  toCommit,
  toCreatedThread,
  toDiffs,
  toExtraDiffs,
  toHeldBack,
  toSnapshot,
  landingMethods,
  stacked
} from "./snapshot"
import { happeningsFrom } from "./activity"
import { statIn } from "./diffStat"
import { authorsFrom, branchesFrom } from "./refs"
import type { Stat } from "../domain/commitList"
import { historyFrom, marksFrom } from "./commits"
import { embeddedPayloads } from "./embedded"
import { signOnWanted } from "./signOn"
import { involvedIssuesFrom, listedIssuesFrom } from "./issues"
import {
  decodeLatestCommit,
  decodeTreeCommitInfo,
  decodeTreeList,
  frontFrom,
  frontFromKept,
  isKeptFront,
  keptFrom,
  touchesFrom,
  wroteIn
} from "./repoHome"
import { commitFromKept, keptCommitFrom } from "./keptCommit"
import { keepTabs, keptTabs, tabsOnPage } from "./repoTabs"
import { openedFrom } from "./file"
import { blamedFrom } from "./blame"
import type { Named, Numbered, Suggesting } from "../domain/suggesting"
import type { Uploaded } from "../domain/attaching"
import { decodeAddedComment, issueFrom, remarkFrom } from "./issueView"
import { decodeMentionable, decodeReferable, numberedIn, peopleIn } from "./suggesting"
import { hashIn, hashOfMutationIn, nonceOn, releaseOn, servedFor, whenAsked } from "./persisted"
import { scopedRepositoryIn } from "./scoped"
import { decodeUploadedAsset, decodeUploadPolicy, repositoryNumberFor } from "./uploading"
import { asLanded, landedNow, recordLanded, seeded } from "./landed"
import { preloadedIn } from "./preloaded"
import { repositoriesFrom } from "./repositories"
import { decodeSidebar, standingFrom } from "./standing"
import type { Happening } from "../domain/activity"
import { type CommitList, type History, routeFor } from "../domain/commitList"
import {
  addressOf as discussionAddress,
  homePath,
  homeRef,
  listRouteOf,
  listWithinHome,
  type DiscussionList,
  type DiscussionPress,
  type DiscussionRef,
  type DiscussionSnapshot,
  type Home
} from "../domain/discussions"
import type { IssueSnapshot, Settling } from "../domain/Issue"
import type { InvolvedIssue, Involvement, IssueRef } from "../domain/issues"
import type { Front, Starring } from "../domain/repoHome"
import type { Repository } from "../domain/repositories"
import { asForm, newestBy, signingIn } from "./saying"
import { loginOnPage } from "../ui/viewer"
import { CreatedIssueRoute, IssueCommentsRoute, PreviewStackRoute } from "./wire"
import type { Raising } from "../domain/raising"
import type { AsyncDiffLoad } from "./wire"
import { whereverItIs } from "./wherever"

/**
 * GitHub as their own page reads it: their internal routes, answered with the
 * session cookies of somebody already signed in and looking at github.com.
 *
 * The fast implementation of {@link GitHubGateway} and the one that cannot
 * travel. Every route here is undocumented, several are HTML meant for their own
 * JavaScript, and all of them need cookies this origin only has because the code
 * is running inside their page. What the extension gains for that is a pull
 * request in one request instead of thirty.
 */


/**
 * A verdict as GitHub's own dialog sends it.
 *
 * Lower case, and `request changes` carries a space where every other name in
 * this file would have an underscore. Read off the wire rather than guessed:
 * `APPROVE`, `REQUEST_CHANGES` and `request_changes` are each answered with
 * 422 `Invalid event`, so the shape that looks like the rest of GitHub's API
 * is the one shape this route refuses.
 */
const eventFor = (verdict: Verdict): string =>
  verdict === "request-changes" ? "request changes" : verdict

// Seventy bytes: the two counts and their sum, and nothing whatever else. The
// only route GitHub has that says how big a pull request is without sending it.
const DIFFSTAT = "/page_data/diffstat"
const MERGE = "/page_data/merge"
/**
 * The route a stack lands through, which is not the one above.
 *
 * GitHub keeps the two apart and each refuses the other's pull request with the
 * same sentence — "This pull request is out of date. Refresh the page and try
 * again." — which is true of neither. Their own button reads `enqueue_stack`
 * for a layer of a stack and `merge` for everything else, and so does this.
 *
 * Named for the queue in their word for it and not for what it does here: on a
 * repository without a merge queue it lands the stack outright, bottom layer
 * first, in one operation.
 */
const MERGE_STACK = "/page_data/enqueue_stack"
/**
 * The route that makes a stack, which is what their "Create stack" button posts.
 *
 * Plural, and it takes a list: a stack is made out of several pull requests at
 * once, and the pull request in the address is only the one being read. The list
 * is `pullRequestIds`, in GitHub's own numeric ids — see {@link PreviewStackRoute},
 * which is where those ids come from and the only place they arrive.
 */
const MAKE_STACK = "/page_data/pull_request_stacks"
const COMMENT = "/page_data/create_review_comment"
const ENQUEUE = "/page_data/enable_auto_merge"
const DEQUEUE = "/page_data/dequeue_pull_request"
const CANCEL_AUTO_MERGE = "/page_data/disable_auto_merge"
const UPDATE_BRANCH = "/page_data/update_pull_request_branch"
const CLOSE = "/page_data/close_pull_request"
const REOPEN = "/page_data/reopen_pull_request"
const MARK_READY = "/page_data/mark_ready_for_review"
const TO_DRAFT = "/page_data/convert_to_draft"
/*
 * Verified against `flazouh/ghpro-scratch#11` rather than read from their
 * bundle, which matters more here than for the routes above it: this one takes
 * somebody's branch away. It answered 200 `Head ref was successfully deleted`,
 * and the merge box's two flags swapped over afterwards.
 */
const DELETE_BRANCH = "/page_data/delete_head_ref"
const SUBMIT_REVIEW = "/page_data/submit_review"
const SETTLE = "/page_data/resolve_thread"
const UNSETTLE = "/page_data/unresolve_thread"
/* Named for the errors, since the URL itself comes off their form. */
const SAY = "/comment"

/**
 * One shelf of the Working Set.
 *
 * `max_pr_age` is theirs and their own dashboard sends `1m`, which is a month.
 * Sent identically here: a shelf read with a different window is a different
 * question, and answering a slightly different one than GitHub's own page does
 * is how two views of the same Working Set come to disagree.
 */
/**
 * The dashboard's search, escaped.
 *
 * `URLSearchParams` rather than `encodeURIComponent`, because a query is mostly
 * spaces and colons and this is the spelling GitHub's own page produces: spaces as
 * `+`, colons and slashes as escapes.
 */
const searchRoute = (query: string, page: number): string =>
  `/pulls?${new URLSearchParams({ q: query, page: String(page) }).toString()}`

/** Their word for each involvement, which is the query and nothing else. */
const QUALIFIER_OF: Record<Involvement, string> = {
  assigned: "assignee",
  authored: "author",
  mentioned: "mentions"
}

/**
 * Their issue search, asked one involvement at a time.
 *
 * `type=issues` on their search rather than `/issues?q=…`, which is a choice their
 * own rebuild forced: the issues dashboard is a React page now, asking it for JSON
 * answers with a shell holding no rows, and the rows it does draw arrive by a
 * persisted GraphQL query whose name is a hash that changes with every deploy.
 * This route answers with the rows themselves and is asked for exactly as a shelf
 * is.
 *
 * Three queries and not the one `involves:@me` would allow, because the reason the
 * reader is involved is the whole of what the Court is decided from and
 * `involves:@me` throws it away. `is:issue` because their search will otherwise
 * answer with pull requests too, and those are already read from their shelves.
 */
const issuesRoute = (involvement: Involvement): string =>
  `/search?${new URLSearchParams({
    q: `${QUALIFIER_OF[involvement]}:@me is:issue is:open`,
    type: "issues"
  }).toString()}`

/**
 * The same search, asked any question and one page at a time.
 *
 * How a repository's issue list is read. `p` rather than `page`, which is their
 * spelling on this route and not a choice: `page` is ignored here and every
 * request comes back as the first one.
 */
const issueSearchRoute = (query: string, page: number): string =>
  `/search?${new URLSearchParams({ q: query, type: "issues", p: String(page) }).toString()}`

const shelfRoute = (shelf: Shelf): string =>
  `/pulls/inbox/queries?filter=${shelf}&max_pr_age=1m`

/**
 * How the checks and reviews stand for pull requests already listed.
 *
 * The ids go in repeated square-bracket parameters, which is Rails' way of
 * spelling an array and not something to tidy: their route reads no other form.
 *
 * `ids[]`, not `pr_ids[]`. GitHub renamed the parameter on 2026-08-27 in the same
 * change that moved the id itself from a database number to a node id string:
 * the old `pr_ids[]` name now answers 200 with an empty `results`, which read as
 * a whole list with no checks on any row. The ids are node ids and go in
 * unescaped exactly as their own dashboard sends them.
 */
const deferredRoute = (ids: ReadonlyArray<string>): string =>
  `/pulls/inbox/deferred?page=1&${ids.map((id) => `ids%5B%5D=${encodeURIComponent(id)}`).join("&")}`

/**
 * Their own repository picker's route.
 *
 * `q` and `filter_value` are sent empty, which is what asks for all of them. Their sidebar
 * sends a query as the reader types; this reads the whole list once and narrows it here,
 * because 154 repositories cost 44 kilobytes and a keystroke should not cost a request.
 */
const REPOSITORIES = "/_filter/repositories?q=&filter_value="

/**
 * Where the events that are still in time order are.
 *
 * `api.github.com` rather than one of their internal routes, which is a departure worth
 * naming: every other read here is github.com answered with the reader's session. They have
 * retired the internal routes that answered chronologically — that retirement is the
 * complaint this Destination exists to answer — and this one needs no token, so it is asked
 * for with the cookies deliberately left off.
 *
 * A hundred is their maximum for one page and about six hours of a busy account.
 */
const eventsRoute = (login: string): string =>
  `https://api.github.com/users/${encodeURIComponent(login)}/received_events/public?per_page=100`

/**
 * How many pull requests one deferred read asks about.
 *
 * Nine, because that is what GitHub's own dashboard sends. A longer URL may well
 * be accepted, but a batch size nobody has served is a batch size nobody has
 * tested, and the cost of being wrong is the whole listing's second half.
 */
const PER_BATCH = 9

/**
 * What their own merge button sends, less what it turns out not to need.
 *
 * Recorded from a real merge and then cut down against a scratch pull request
 * one header at a time: the nonce and the client version their bundle attaches
 * are not checked, but `GitHub-Verified-Fetch` is — it is what stands in for a
 * CSRF token on these routes, and the cookies do the rest.
 */
const VERIFIED = { "GitHub-Verified-Fetch": "true" }

const WRITING_HEADERS = {
  ...REQUIRED_HEADERS,
  "Content-Type": "application/json",
  ...VERIFIED
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

/**
 * The body as text, and nothing where it will not read.
 *
 * Every caller here is already holding an answer it has decided is good; a body
 * that then refuses to be read is worth an empty string rather than a failure
 * of its own, because what each of them does next is look for something in it.
 */
const textOf = (response: Response): Effect.Effect<string> =>
  Effect.tryPromise(() => response.text()).pipe(Effect.catch(() => Effect.succeed("")))


/**
 * A read about the Participant rather than about one pull request.
 *
 * The same two headers and the same cookies as {@link fetchRoute}, and a
 * different failure: there is no pull request to name when a Working Set will
 * not load.
 */
const fetchViewerRoute = Effect.fn("fetchViewerRoute")(function* (route: string) {
  const said = yield* saidAt(`https://github.com${route}`)
  if (!said.ok) {
    return yield* new WorkingSetError({ route, reason: said.why, detail: said.detail })
  }

  return said.payload
})

/**
 * One page of somebody's received events, asked for as a stranger.
 *
 * `credentials: "omit"` on purpose: the route is public, sending cookies to
 * `api.github.com` would achieve nothing, and a read that cannot see private repositories
 * is a read that cannot leak one either. Their rate limit for an anonymous caller is sixty
 * an hour against the address, which is why the answer is kept and why Activity asks once a
 * visit rather than on every draw.
 */
const eventsAt = (route: string): Effect.Effect<Came<unknown>> =>
  askingOnce(
    route,
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () => fetch(route, { credentials: "omit", headers: { Accept: "application/json" } }),
        catch: (cause): Came<unknown> => ({
          ok: false,
          why: "unreachable",
          detail: String(cause)
        })
      })

      if (!response.ok) {
        return yield* Effect.fail<Came<unknown>>({
          ok: false,
          why: "rejected",
          // Their 403 for a spent rate limit reads the same as any other refusal, and the
          // remaining count is the thing that tells them apart when this turns up in a log.
          detail: `HTTP ${response.status} (${response.headers.get("x-ratelimit-remaining") ?? "?"} left)`
        })
      }

      const raw = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: (cause): Came<unknown> => ({
          ok: false,
          why: "unreachable",
          detail: String(cause)
        })
      })

      return { ok: true, value: raw } satisfies Came<unknown>
    }).pipe(Effect.catch(Effect.succeed))
  )

/** Their repository list, decoded, or a failure that names the route. */
const decodedRepositories = (raw: unknown) =>
  repositoriesFrom(raw).pipe(
    Effect.catch((cause) =>
      Effect.fail(
        new WorkingSetError({
          route: REPOSITORIES,
          reason: "undecodable",
          detail: String(cause)
        })
      )
    )
  )

/**
 * Their GraphQL route, which is the only way left to read one issue.
 *
 * Everything else in this file is a URL that says what it wants. This one is a
 * name and a hash GitHub mints per deploy, so `persisted.ts` is what makes the
 * question askable at all.
 */
const GRAPHQL = "/_graphql"

/** The query their own issue page runs, and the count of timeline items it asks for. */
const ISSUE_QUERY = "IssueViewerViewQuery"

/**
 * How much of a long conversation one read brings back.
 *
 * Fifteen, because that is what GitHub's own page sends, and a number nobody
 * has served is a number nobody has tested. A busier issue keeps the rest
 * behind their paging, which is a second read this does not make yet.
 */
const TIMELINE = 15

/**
 * The whole question as one address, or nothing where this deploy's hash has
 * not been seen.
 *
 * The address is the cache key as well as the request, which is why it is built
 * once here: it carries the repository, the number and the hash, so an entry
 * written before a deploy is never read after one.
 */
const issueRoute = (reference: IssueRef, hash: string): string =>
  `${GRAPHQL}?body=${encodeURIComponent(
    JSON.stringify({
      persistedQueryName: ISSUE_QUERY,
      query: hash,
      variables: {
        count: TIMELINE,
        number: reference.number,
        owner: reference.owner,
        repo: reference.repo
      }
    })
  )}`

/**
 * How long the read waits for this deploy's hash before giving up on it.
 *
 * Measured rather than picked: their app asks its own route some hundreds of
 * milliseconds after `document_start`, which is when this screen begins. Three
 * seconds is several times that and still well inside the screen's own
 * twenty-second failsafe, so a page GitHub never asks from hands itself back
 * long before anything else notices.
 */
/** The issue's own page, which is both what GitHub serves it on and what the read falls back to. */
const issuePage = (reference: IssueRef): string =>
  `/${reference.owner}/${reference.repo}/issues/${reference.number}`

const ASKING = "3 seconds"

/** The browser's own way of being told about requests as they are made. */
const watchingResources = (onSeen: (names: ReadonlyArray<string>) => void) => {
  const observer = new PerformanceObserver((list) => {
    onSeen(list.getEntries().map((entry) => entry.name))
  })
  observer.observe({ type: "resource", buffered: false })
  return () => observer.disconnect()
}

/**
 * The whole question as one address, waiting for this deploy's hash where the
 * page has not asked by it yet.
 *
 * The address is the cache key as well as the request, which is why it is built
 * once here: it carries the repository, the number and the hash, so an entry
 * written before a deploy is never read after one.
 */
const askedIssue = (reference: IssueRef): Effect.Effect<Option.Option<string>> =>
  Effect.map(issueHash(reference), (hash) => Option.map(hash, (found) => issueRoute(reference, found)))

/**
 * This deploy's hash for the issue query: off the page where it is there, out of
 * the store where it is not.
 *
 * The store is asked first and without waiting, because waiting is the thing it
 * is here to avoid. GitHub's own page asks the query some hundreds of
 * milliseconds after this screen starts, so {@link whenAsked} sits out that gap
 * on every issue opened with a page load — and on a soft navigation it sits out
 * the whole three seconds, because their app asks the timeline's query there and
 * never this one. A hash kept from the last issue skips both.
 *
 * Kept whenever the page does say it, so the next one has it. Under the release,
 * so a deploy in between is a miss rather than a 404.
 */
const issueHash = (reference: IssueRef): Effect.Effect<Option.Option<string>> =>
  Effect.gen(function* () {
    const release = releaseOn(document)

    if (Option.isSome(release)) {
      const kept = yield* recallHash(release.value, ISSUE_QUERY)
      if (Option.isSome(kept)) return kept
    }

    /*
     * Waited for only on the page GitHub served for this issue, because that is
     * the only page their app asks this query on. A reader pressing a row on one
     * of our lists moves the address without loading anything, so the wait ran
     * its full three seconds for a question nobody was going to ask, and then the
     * read fell back to the issue's own page regardless. Measured on the first
     * issue of a deploy opened that way: 4364ms to draw, about 1.7s of it here.
     *
     * The page is still read, because a hash asked for a moment ago is on it and
     * costs nothing to look at.
     */
    const asked = servedFor(performance, issuePage(reference))
      ? yield* whenAsked(performance, watchingResources, ISSUE_QUERY, ASKING)
      : hashIn(performance, ISSUE_QUERY)

    if (Option.isSome(asked) && Option.isSome(release)) {
      yield* rememberHash(release.value, ISSUE_QUERY, asked.value)
    }

    return asked
  })

/**
 * What an issue's own page held, as a value rather than as a failure.
 *
 * {@link Said} beside it, for the reason that one exists and with one difference:
 * a page is read for the query GitHub rendered it from, so the hash and the result
 * are both in the answer. Plain JSON, which is the only thing the promise between
 * the joiners may carry.
 */
type Served =
  | { readonly ok: true; readonly hash: string; readonly result: unknown }
  | {
      readonly ok: false
      readonly why: "unreachable" | "rejected" | "undecodable"
      readonly detail: string
    }

/**
 * One GET of an issue's own page, folded together with any identical GET already in
 * the air.
 *
 * The page is the read a reader waits longest for, so it is the read worth joining
 * most. Measured on an instrumented build before this: an issue opened from a list
 * fetched its page twice, the press's answer at 4519ms and the read ahead's at
 * 5427ms, so resting on the row bought nothing.
 *
 * The hash is kept inside the fold rather than outside it, which is what keeps that
 * write at one per page however many readers joined.
 */
const servedIssueAt = (route: string): Effect.Effect<Served> =>
  askingOnce(
    `https://github.com${route}`,
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () => fetch(`https://github.com${route}`, { credentials: "include" }),
        catch: (cause): Served => ({ ok: false, why: "unreachable", detail: String(cause) })
      })

      if (!response.ok) {
        return yield* Effect.fail<Served>({
          ok: false,
          why: "rejected",
          detail: `${response.status}`
        })
      }

      const html = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (cause): Served => ({ ok: false, why: "unreachable", detail: String(cause) })
      })

      const preloaded = preloadedIn(html, ISSUE_QUERY)
      if (Option.isNone(preloaded)) {
        return yield* Effect.fail<Served>({
          ok: false,
          why: "undecodable",
          detail: `no ${ISSUE_QUERY} preloaded in the page`
        })
      }

      // Waited for rather than forked, unlike everything else kept in this file.
      // Those are read again on some later visit and losing one costs a repeat of a
      // read that already answered. This one is what stops the next issue paying for
      // a whole page, and it is a single write of thirty-two bytes.
      const release = releaseOn(document)
      if (Option.isSome(release)) {
        yield* rememberHash(release.value, ISSUE_QUERY, preloaded.value.hash)
      }

      return {
        ok: true,
        hash: preloaded.value.hash,
        result: preloaded.value.result
      } satisfies Served
    }).pipe(Effect.catch(Effect.succeed))
  )

/**
 * The issue read out of its own served page, for the arrival nobody has a hash for.
 *
 * The last way in, and the one that always works. Their HTML carries the queries
 * the page was rendered from, hash and whole result together, so a first issue
 * opened from their list is answered from the document that describes it rather
 * than from a route that cannot be addressed yet.
 *
 * A whole page rather than one query, which is why it is last: 217 kilobytes
 * against about 40 for the route, measured on `react/react` #37178. It pays for
 * itself once. The hash it carries is kept, and every issue after it goes the
 * cheap way whichever list the reader came from.
 */
const issueInItsPage = Effect.fn("issueInItsPage")(function* (reference: IssueRef) {
  const route = issuePage(reference)

  const served = yield* servedIssueAt(route)
  if (!served.ok) {
    return yield* new GatewayError({ reference, route, reason: served.why, detail: served.detail })
  }

  return { hash: served.hash, result: served.result }
})

/**
 * The same address, without waiting for GitHub to say anything.
 *
 * What the store is asked with. Waiting on their traffic here would be waiting
 * to look something up, which defeats the whole point of a read that answers in
 * milliseconds or not at all — so the page is read for a hash it already has,
 * and the store for one it kept, and neither costs a wait.
 *
 * The store matters most on exactly the arrival that has no hash: an issue
 * opened from their list. Without it, an issue read a moment ago is drawn from
 * nothing while its own page is fetched again.
 */
const keptIssueRoute = (reference: IssueRef): Effect.Effect<Option.Option<string>> =>
  Effect.gen(function* () {
    const said = hashIn(performance, ISSUE_QUERY)
    if (Option.isSome(said)) return Option.some(issueRoute(reference, said.value))

    const release = releaseOn(document)
    if (Option.isNone(release)) return Option.none<string>()

    const kept = yield* recallHash(release.value, ISSUE_QUERY)
    return Option.map(kept, (hash) => issueRoute(reference, hash))
  })

/**
 * One GET of their GraphQL route, folded together with any identical GET already in
 * the air.
 *
 * The route carries the repository, the number and this deploy's hash, so two reads
 * of one issue address it identically and the second joins the first. Measured on an
 * instrumented build before this: an issue opened from a list asked the route twice,
 * the press's answer at 798ms and the read ahead's at 1494ms.
 *
 * The nonce is handed in rather than read here, because reading it is what decides
 * whether there is anything to ask at all and that answer belongs to the caller.
 */
const graphqlSaidAt = (route: string, nonce: string): Effect.Effect<Said> =>
  askingOnce(
    `https://github.com${route}`,
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`https://github.com${route}`, {
            headers: { ...REQUIRED_HEADERS, "X-Fetch-Nonce": nonce },
            credentials: "include"
          }),
        catch: (cause): Said => ({ ok: false, why: "unreachable", detail: String(cause) })
      })

      if (!response.ok) {
        return yield* Effect.fail<Said>({
          ok: false,
          why: "rejected",
          detail: `HTTP ${response.status}`
        })
      }

      const payload = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: (cause): Said => ({ ok: false, why: "undecodable", detail: String(cause) })
      })

      return { ok: true, payload } satisfies Said
    }).pipe(Effect.catch(Effect.succeed))
  )

/**
 * A GET of their GraphQL route, which wants one header the others do not.
 *
 * The nonce is written into every page GitHub serves and sent back by their own
 * app on every request. Measured: the same call is 403 without it and 200 with
 * it. Read off the document each time rather than held, because a soft
 * navigation leaves a page whose nonce is no longer the one on the screen.
 */
const askedGraphql = Effect.fn("askedGraphql")(function* (
  reference: IssueRef,
  route: string
) {
  const nonce = nonceOn(document)
  if (Option.isNone(nonce)) {
    return yield* new GatewayError({
      reference,
      route: GRAPHQL,
      reason: "rejected",
      detail: "no fetch-nonce on this page"
    })
  }

  const said = yield* graphqlSaidAt(route, nonce.value)
  if (!said.ok) {
    return yield* new GatewayError({
      reference,
      route: GRAPHQL,
      reason: said.why,
      detail: said.detail
    })
  }

  return said.payload
})

/**
 * One issue, decoded, or a failure that names the route.
 *
 * Their GraphQL route answers 200 with an `errors` array where a REST route
 * would have answered 404, so a body that carries no issue arrives here looking
 * like a payload that changed shape. Both are undecodable and both mean the
 * same thing to a reader, which is that this page cannot be drawn.
 */
const decodedIssue = (reference: IssueRef, raw: unknown) =>
  issueFrom(reference, raw).pipe(
    Effect.catch((cause) =>
      Effect.fail(
        new GatewayError({
          reference,
          route: GRAPHQL,
          reason: "undecodable",
          detail: String(cause)
        })
      )
    )
  )

/** Their name for the write behind their own Create button. */
const CREATE_ISSUE = "createIssueMutation"

/**
 * Named with the mutation as well as the route, because two different calls now
 * fail as `/_graphql` and a report that says only that names neither.
 */
const RAISING = `${GRAPHQL} ${CREATE_ISSUE}`

/**
 * One of their chunks, read, or nothing where it would not read.
 *
 * Without credentials, because these are assets on their CDN and the cookies
 * this origin has are for github.com. Every failure is the same answer: a chunk
 * that will not read is a chunk that taught this nothing, and there are a
 * hundred and eighty more.
 */
const readingChunk = (at: string): Effect.Effect<Option.Option<string>> =>
  Effect.tryPromise(() => fetch(at, { credentials: "omit" })).pipe(
    Effect.flatMap(textOf),
    Effect.map(Option.some),
    Effect.catch(() => Effect.succeed(Option.none<string>()))
  )

/**
 * This deploy's hash for the create mutation: out of the store, or out of their
 * shipped JavaScript.
 *
 * The store first, exactly as {@link issueHash} asks it first, and worth more
 * here than there. A query's hash can be watched for; this one has to be found,
 * and finding it is a hundred and thirty reads — so the second issue raised
 * during one deploy should cost none of them.
 *
 * Kept under the release for the reason every hash is: GitHub ship several times
 * a day, and a hash does not outlive the deploy that minted it. What that buys is
 * a miss rather than a 404.
 */
const hashOf = (name: string): Effect.Effect<Option.Option<string>> =>
  Effect.gen(function* () {
    const release = releaseOn(document)

    if (Option.isSome(release)) {
      const kept = yield* recallHash(release.value, name)
      if (Option.isSome(kept)) return kept
    }

    const found = yield* hashOfMutationIn(performance, readingChunk, name)
    if (Option.isSome(found) && Option.isSome(release)) {
      yield* rememberHash(release.value, name, found.value)
    }

    return found
  })

const raisingHash: Effect.Effect<Option.Option<string>> = hashOf(CREATE_ISSUE)

/**
 * Their two mutations for the one control: closing an issue with a reason, and putting it
 * back.
 *
 * Two rather than one because GitHub wrote them that way — the close takes a reason and a
 * duplicate to point at, and the reopen takes the issue and nothing else. Measured off their
 * own button on `flazouh/stack-probe` #77, closed as completed, closed as not planned and
 * reopened, each answering 200 with the state and reason echoed back.
 */
const CLOSE_ISSUE = "updateIssueStateMutationCloseMutation"
const SAY_ON_ISSUE = "addCommentMutation"
const REOPEN_ISSUE = "updateIssueStateMutation"

/** Their word for each of ours. `NOT_PLANNED` is what "closed as not planned" is called. */
const REASON_OF: Record<Settling["as"], string> = {
  completed: "COMPLETED",
  discarded: "NOT_PLANNED",
  duplicate: "DUPLICATE"
}

/**
 * One mutation of theirs, sent as their own page sends it.
 *
 * The same three problems the raise has, in the same order: this deploy's hash for the
 * mutation, the page's nonce, and a route that answers 200 for a refusal. Each is reported
 * apart from the others, because "GitHub refused that" about a hash this extension could not
 * find is a sentence that sends the reader looking for a fault of GitHub's making.
 */
const mutating = Effect.fn("GitHubGateway.mutating")(function* (
  reference: RepoRef,
  name: string,
  variables: Readonly<Record<string, unknown>>
) {
  const route = `${GRAPHQL} ${name}`

  const hash = yield* hashOf(name)
  if (Option.isNone(hash)) {
    return yield* new GatewayError({
      reference,
      route,
      reason: "not-recorded",
      detail: `Nothing this page has loaded says which ${name} GitHub will answer.`
    })
  }

  const nonce = nonceOn(document)
  if (Option.isNone(nonce)) {
    return yield* new GatewayError({
      reference,
      route,
      reason: "rejected",
      detail: "no fetch-nonce on this page"
    })
  }

  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`https://github.com${GRAPHQL}`, {
        method: "POST",
        headers: {
          ...REQUIRED_HEADERS,
          ...VERIFIED,
          "Content-Type": "text/plain;charset=UTF-8",
          "X-Fetch-Nonce": nonce.value
        },
        credentials: "include",
        body: JSON.stringify({ persistedQueryName: name, query: hash.value, variables })
      }),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  const said = yield* textOf(response)
  const body = parsed(said)
  const refused = graphqlRefusal(body)

  if (refused !== undefined || !response.ok) {
    return yield* new GatewayError({
      reference,
      route,
      reason: "rejected",
      detail: refused ?? reasonGiven(said) ?? `HTTP ${response.status}`
    })
  }

  // Handed back rather than dropped: closing an issue has nothing to say, and adding a
  // comment hands back the whole comment, rendered. Callers that want neither ignore it.
  return body
})

/**
 * The payloads their React roots were rendered from, off the page this is
 * standing on.
 *
 * The same script tag `embedded.ts` looks for in served HTML, read out of the DOM
 * instead. A document rather than a string because there is no fetch here: the
 * reader is on the page, and serialising it back to HTML to read one field out of
 * it would be a megabyte of string for nothing.
 */
const embeddedOnPage = (page: Document): ReadonlyArray<string> =>
  [
    ...page.querySelectorAll(
      'script[type="application/json"][data-target="react-app.embeddedData"]'
    )
  ].map((script) => script.textContent ?? "")

/**
 * The sentence a GraphQL answer refused with, from either place their mutation
 * puts one.
 *
 * Both are checked because their mutation uses both: a query that could not be
 * run at all fails at the top of the answer, and an issue GitHub declined to
 * create fails in an `errors` array beside the issue it did not make. Neither
 * arrives as a status code — this route answers 200 for both — so a raise that
 * looked only at `response.ok` would tell the reader their issue was raised.
 */
const graphqlRefusal = (body: unknown): string | undefined => {
  const said = body as
    | {
        errors?: ReadonlyArray<{ message?: unknown }>
        data?: { createIssue?: { errors?: ReadonlyArray<{ message?: unknown }> } | null }
      }
    | undefined

  for (const one of [...(said?.errors ?? []), ...(said?.data?.createIssue?.errors ?? [])]) {
    if (typeof one?.message === "string" && one.message.length > 0) return one.message
  }

  return undefined
}

/** Their issues, decoded, or a failure that names the route. */
const decodedIssues = (involvement: Involvement, route: string, raw: unknown) =>
  involvedIssuesFrom(involvement, raw).pipe(
    Effect.catch((cause) =>
      Effect.fail(new WorkingSetError({ route, reason: "undecodable", detail: String(cause) }))
    )
  )

/** One page of their issue search, decoded, or a failure that names the route. */
const decodedFoundIssues = (route: string, raw: unknown) =>
  listedIssuesFrom(raw).pipe(
    Effect.catch((cause) =>
      Effect.fail(new WorkingSetError({ route, reason: "undecodable", detail: String(cause) }))
    )
  )

/** Their events, decoded, or a failure that names the route. */
const decodedHappenings = (route: string, raw: unknown) =>
  happeningsFrom(raw).pipe(
    Effect.catch((cause) =>
      Effect.fail(new WorkingSetError({ route, reason: "undecodable", detail: String(cause) }))
    )
  )

/**
 * A GET of a JSON route that refuses the XMLHttpRequest header.
 *
 * Their repository filter is the one such route this reads, and it took watching their own
 * bundle to find out why it answered 406 to everything sensible: it wants
 * `Content-Type: application/json` on a request with no body, and no `X-Requested-With` at
 * all. Odd, sent because it is what works, and kept apart from {@link saidAt} so that the
 * oddity stays with the one route that has it.
 */
const askedWithoutXhr = (url: string, route: string) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          credentials: "include"
        }),
      catch: (cause) =>
        new WorkingSetError({ route, reason: "unreachable", detail: String(cause) })
    })

    if (!response.ok) {
      return yield* new WorkingSetError({
        route,
        reason: "rejected",
        detail: `HTTP ${response.status}`
      })
    }

    return yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new WorkingSetError({ route, reason: "undecodable", detail: String(cause) })
    })
  })

/**
 * A read of one of GitHub's own HTML fragments, for the two things about a person
 * that no route answers in any other form.
 *
 * None for 404, which is the ordinary answer for an app: `dependabot[bot]` has no
 * profile page and no calendar, and that is a person there is nothing to draw
 * rather than a read that went wrong.
 *
 * Not {@link fetchViewerRoute}: that asks for JSON, and asking these two for JSON
 * is refused. Their own pages send the XMLHttpRequest header and without it both
 * answer 406.
 */
const fragmentAt = Effect.fn("fragmentAt")(function* (route: string) {
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`https://github.com${route}`, {
        headers: { Accept: "text/html", "X-Requested-With": "XMLHttpRequest" },
        credentials: "include"
      }),
    catch: (cause) =>
      new WorkingSetError({ route, reason: "unreachable", detail: String(cause) })
  })

  if (response.status === 404) return Option.none<string>()

  if (!response.ok) {
    return yield* new WorkingSetError({
      route,
      reason: "rejected",
      detail: `HTTP ${response.status}`
    })
  }

  return Option.some(yield* textOf(response))
})

/** Ids in the batches GitHub's own dashboard asks in. */
const inBatches = (ids: ReadonlyArray<string>): ReadonlyArray<ReadonlyArray<string>> => {
  const batches: Array<ReadonlyArray<string>> = []
  for (let at = 0; at < ids.length; at += PER_BATCH) {
    batches.push(ids.slice(at, at + PER_BATCH))
  }
  return batches
}

/**
 * A write whose answer is only whether it worked.
 *
 * The queue routes return a sentence and nothing else, so there is nothing to
 * decode and one thing to report: what GitHub said when it said no. Routes that
 * hand back an object worth reading — a merge, a posted comment — keep their
 * own bodies rather than pretending this shape fits them.
 *
 * The method is asked for rather than assumed because these routes do not agree
 * on one: everything here is a POST except `submit_review`, which GitHub's own
 * bundle sends as a PUT.
 */
const writing = Effect.fn("writing")(function* (
  reference: PullRequestRef,
  route: string,
  // A number among them because one route names a stack by GitHub's own id for
  // it, which is a number and not one of the numbers in a list.
  body?: Readonly<Record<string, string | number | boolean | ReadonlyArray<number>>>,
  method: "POST" | "PUT" = "POST"
) {
  const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${route}`

  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(url, {
        method,
        headers: WRITING_HEADERS,
        credentials: "include",
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  const said = yield* textOf(response)

  if (!response.ok) {
    return yield* new GatewayError({
      reference,
      route,
      reason: "rejected",
      detail: reasonGiven(said) ?? `HTTP ${response.status}`
    })
  }

  /*
   * The write worked, so what is kept about this pull request describes one that
   * no longer exists in that shape.
   *
   * Here rather than at each of the fourteen call sites, which is where it began.
   * Every pull request write in this file goes through this one function and it
   * returns only on success, so this is the one place that cannot be forgotten —
   * and it was already being forgotten: resolving a thread, posting a review and
   * making a stack all left the kept payloads saying otherwise.
   */
  const leaves = LEAVES_IT[route]
  if (leaves !== undefined) {
    recordLanded(reference, leaves)
    // Written down as well as remembered, so that the next document knows what
    // this one did. Forked: the screen has already moved, and the reader is not
    // waiting on a storage write to be told what they just pressed.
    yield* Effect.forkDetach(rememberLanded(landedNow()))
  }
  yield* forget(reference)
})

/**
 * The remark the reader has just written, read back from the conversation.
 *
 * GitHub answer a form post with their entire page, so what was written has to be
 * fetched rather than parsed out of 800kb of markup that changes with every deploy.
 * The route is the one the card already reads its conversation from, so the remark
 * arrives decoded the same way as every other remark on the card — the reader's
 * own comment cannot draw differently from the ones above it.
 */
const newestRemark = Effect.fn("newestRemark")(function* (reference: PullRequestRef) {
  const raw = yield* fetchRoute(reference, ISSUE_COMMENTS)
  const comments = yield* whereverItIs(IssueCommentsRoute)(raw).pipe(
    Effect.catch((cause) =>
      Effect.fail(
        new GatewayError({
          reference,
          route: ISSUE_COMMENTS,
          reason: "undecodable",
          detail: String(cause)
        })
      )
    )
  )

  const written = newestBy(loginOnPage(), comments)
  if (written === null) return Option.none<Remark>()

  return Option.some<Remark>({
    id: written.id,
    author: {
      login: written.authorLogin,
      isAutomated: false,
      faceUrl: Option.fromNullishOr(written.authorAvatarUrl)
    },
    body: written.body,
    html: written.bodyHtml,
    createdAt: written.createdAt
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

/**
 * What one page of a branch's commits is kept under.
 *
 * The whole path rather than the route, because the route on its own is
 * `/commits/main` in every repository there is — and the store is one store for
 * the whole browser. The cursor is in it too, so the second page is a second
 * memory rather than one overwriting the first.
 */
const pageKey = (list: CommitList): string =>
  `/${list.repo.owner}/${list.repo.repo}${routeFor(list)}`

/**
 * Their own branch picker's route, which answers with every name at once.
 *
 * No `q`: it takes one and ignores it, so there is no asking for a subset and
 * the narrowing belongs where the typing is.
 */
const BRANCHES_ROUTE = "/refs?type=branch"

const refsKey = (reference: RepoRef): string =>
  `/${reference.owner}/${reference.repo}${BRANCHES_ROUTE}`

/**
 * Everybody who has written a commit here, which their own page defers.
 *
 * Built rather than taken from the payload that names it, unlike the deferred
 * marks beside it: this one carries no cursor and is the same address on every
 * page of every branch, so there is nothing of theirs to carry.
 */
const AUTHORS_ROUTE = "/commits/deferred_commit_contributors"

const authorsKey = (reference: RepoRef): string =>
  `/${reference.owner}/${reference.repo}${AUTHORS_ROUTE}`

/** A repository tree, kept under the branch address it was read from. */
const frontKey = (reference: RepoRef, branch: string | null): string =>
  `/${reference.owner}/${reference.repo}${branch === null ? "" : `/tree/${branch}`}`

/**
 * One run, kept under the address it is read at.
 *
 * The attempt is part of it: a re-run has its own page, and answering for attempt two with
 * what attempt one did is the one mistake a remembered run could make.
 */
const runKey = (reference: RunRef): string =>
  `/${reference.repo.owner}/${reference.repo.repo}/actions/runs/${reference.run}` +
  (reference.attempt === null ? "" : `/attempts/${reference.attempt}`)

/**
 * The address a run is read at, rebuilt from the reference.
 *
 * Rebuilt rather than passed through, so an attempt is asked for by number and a
 * job's address cannot send a read somewhere that answers with one job.
 */
const runRoute = (reference: RunRef): string =>
  reference.attempt === null
    ? `/actions/runs/${reference.run}`
    : `/actions/runs/${reference.run}/attempts/${reference.attempt}`

/**
 * A run's page as the document it is served as.
 *
 * Two callers, and the second is why this is a function: a press is their own
 * form posted back, and the form is on this page. So the token a press needs and
 * the facts a screen needs come out of the same read, asked for the same way.
 */
const runDocument = Effect.fn("runDocument")(function* (reference: RunRef, route: string) {
  const url = `https://github.com/${reference.repo.owner}/${reference.repo.repo}${route}`

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, { headers: { Accept: "text/html" }, credentials: "include" }),
    catch: (cause) =>
      new GatewayError({
        reference: reference.repo,
        route,
        reason: "unreachable",
        detail: String(cause)
      })
  })

  if (!response.ok) {
    return yield* new GatewayError({
      reference: reference.repo,
      route,
      reason: "rejected",
      detail: `HTTP ${response.status}`
    })
  }

  return yield* Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) =>
      new GatewayError({
        reference: reference.repo,
        route,
        reason: "unreachable",
        detail: String(cause)
      })
  })
})

/**
 * How a run went, for the one question a pull request's own payload cannot answer.
 *
 * Their `status_checks` payload says a check failed and stops there. Whether the
 * workflow around it was told to carry on is written only on the run, so this is
 * the read that turns twelve red rows into eleven red rows and one that was
 * allowed to fail. It is asked once per run rather than once per check, and only
 * for a run something failed in.
 *
 * The kept run is preferred, and a fetched one is kept, because a run that has
 * finished has finished: an outcome read once is an outcome that never has to be
 * read again, on the same reasoning a landed commit's diffstat is kept forever.
 * A run still going is read again next time, since the answer it gives now is
 * not the answer it will end on.
 *
 * Nothing here fails. Every one of these is a page this interface could have
 * shown without, so an unreachable network, a refusal, or markup nothing can
 * read all mean the same thing: no outcome for that run, and its checks stay red
 * exactly as GitHub reported them.
 */
const runStanding = Effect.fn("runStanding")(function* (path: string) {
  const found = /^\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)$/.exec(path)
  if (found === null) return Option.none<CheckState>()

  const reference: RunRef = {
    repo: { owner: found[1]!, repo: found[2]! },
    run: found[3]!,
    attempt: null,
    job: null
  }

  const kept = yield* recallRoute(path)
  if (Option.isSome(kept) && isKeptRun(kept.value) && !isUnderway(kept.value.run.state)) {
    return Option.some(kept.value.run.state)
  }

  const html = yield* runDocument(reference, runRoute(reference)).pipe(
    Effect.map(Option.some),
    Effect.catch(() => Effect.succeed(Option.none<string>()))
  )
  if (Option.isNone(html)) return Option.none<CheckState>()

  const opening = runOnPage(html.value)
  if (opening === null) return Option.none<CheckState>()

  if (!isUnderway(opening.run.state)) {
    yield* Effect.forkDetach(rememberRoute(path, opening))
  }

  return Option.some(opening.run.state)
})

const isUnderway = (state: CheckState): boolean => state === "running" || state === "queued"

/**
 * The checks a pull request arrived with, with the tolerated failures said so.
 *
 * Skipped outright where nothing failed, which is most pull requests most of the
 * time: `runsBehind` comes back empty, no run is read, and this costs a pass over
 * an array of twenty.
 *
 * Behind the first paint rather than in front of it. A remembered pull request
 * draws a tolerated failure red for the second before this replaces it — the
 * same second-hand it draws every other fact that has moved since — and the
 * live read now does exactly that too: the checks go up as GitHub reported
 * them, and a run that says it was allowed to fail softens the row afterwards.
 * Held in front, a pull request with three failing runs waited for three
 * half-megabyte documents before it drew anything.
 */
const asTolerated = Effect.fn("asTolerated")(function* (checks: ReadonlyArray<Check>) {
  const runs = runsBehind(checks)
  if (runs.length === 0) return checks

  const standings = new Map<string, CheckState>()
  yield* Effect.forEach(
    runs,
    Effect.fnUntraced(function* (path: string) {
      const standing = yield* runStanding(path)
      if (Option.isSome(standing)) standings.set(path, standing.value)
    }),
    { concurrency: 4, discard: true }
  )

  return tolerating(checks, standings)
})

/**
 * One of their forms on a run, sent back to them.
 *
 * Their page is read first, every time, and the form is taken out of what comes
 * back. Nothing is composed here: the route, the `_method`, the token and the
 * `only_failed_check_runs` are all theirs, and the fields go out in the order
 * they were written. A token is minted per page, so reading the page again is
 * not a cost this could avoid by keeping one — it is the only way the press is
 * addressed to the page it came from.
 *
 * Their answer is the run page's HTML either way, which means the status code is
 * the whole of what there is to go on: a refusal is not distinguishable from a
 * success by the body. So the check is `response.ok` and the screen re-reads the
 * run afterwards to say what actually happened.
 */
const pressingRun = Effect.fn("pressingRun")(function* (reference: RunRef, what: Pressing) {
  const route = `/actions/runs/${reference.run}`
  const html = yield* runDocument(reference, route)

  const press = pressOn(html, what)
  if (press === null) {
    return yield* new GatewayError({
      reference: reference.repo,
      route,
      reason: "rejected",
      detail: "GitHub is not offering that on this run"
    })
  }

  const telling = new URLSearchParams()
  for (const [name, value] of press.fields) telling.append(name, value)

  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`https://github.com${press.action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "text/html"
        },
        credentials: "include",
        body: telling.toString()
      }),
    catch: (cause) =>
      new GatewayError({
        reference: reference.repo,
        route: press.action,
        reason: "unreachable",
        detail: String(cause)
      })
  })

  if (!response.ok) {
    return yield* new GatewayError({
      reference: reference.repo,
      route: press.action,
      reason: "rejected",
      detail: `HTTP ${response.status}`
    })
  }
})

/** A repository's Actions tab, kept under the address its list is read at. */
const strandsKey = (reference: RepoRef): string =>
  `/${reference.owner}/${reference.repo}/actions`

/** A repository's Releases tab, kept under the address its list is read at. */
const releasesKey = (reference: RepoRef): string =>
  `/${reference.owner}/${reference.repo}/releases`

/**
 * One of a repository's own pages as the document it is served as.
 *
 * `runDocument` above with a repository in place of a run, and the same three failures named the
 * same way. Two callers, both on the releases screen: their list page and the asset fragment it
 * defers, which are one kind of read asked at two addresses.
 */
const repoDocument = Effect.fn("repoDocument")(function* (reference: RepoRef, route: string) {
  const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, { headers: { Accept: "text/html" }, credentials: "include" }),
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
    try: () => response.text(),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })
})

/**
 * One of GitHub's discussion pages as the document they serve it as.
 *
 * `repoDocument` above with a home in place of a repository, because an organisation's
 * discussions sit at `/orgs/{org}` and a repository's at `/{owner}/{repo}` and everything past
 * that word is identical.
 */
const discussionDocument = Effect.fn("discussionDocument")(function* (home: Home, route: string) {
  const url = `https://github.com${homePath(home)}${route}`
  const reference = homeRef(home)

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, { headers: { Accept: "text/html" }, credentials: "include" }),
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
    try: () => response.text(),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })
})

/**
 * The menu GitHub serves for one thing, as the markup they answer with.
 *
 * Empty rather than a failure where the route is not on the page or GitHub declines to serve it.
 * A reader who may do nothing to a comment is shown a menu of nothing, which is what their own
 * page shows, and it is not a fault worth a failure screen.
 */
const menuHtml = Effect.fn("menuHtml")(function* (
  on: "Discussion" | "DiscussionComment",
  id: string
) {
  const route = menuRouteIn(document, on, id)
  if (route === null) return ""

  const html = yield* fragmentAt(route).pipe(
    Effect.catch(() => Effect.succeed(Option.none<string>()))
  )

  return Option.getOrElse(html, () => "")
})

/**
 * One discussion, read as the document GitHub serves it as.
 *
 * At the top level rather than inside the layer, because two of the layer's methods want it: the
 * read itself, and every press, which answers with the discussion again once GitHub has taken
 * the write.
 */
const readDiscussion = Effect.fn("readDiscussion")(function* (reference: DiscussionRef) {
  const route = discussionAddress(reference)
  const document = yield* discussionDocument(reference.home, `/discussions/${reference.number}`)

  const found = discussionOnPage(reference, document)
  if (Option.isNone(found)) {
    return yield* new GatewayError({
      reference: homeRef(reference.home),
      route,
      reason: "undecodable",
      detail: "the page GitHub served carries no discussion"
    })
  }

  yield* Effect.forkDetach(rememberRoute(route, found.value))

  return found.value
})

/** A read of one of a person's addresses, or why it did not come. */
type Came<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly why: "unreachable" | "rejected"; readonly detail: string }

/**
 * One of a person's own pages, as the document they serve it as, folded together with the
 * identical read already in the air.
 *
 * Their markup, not a payload: every page under a person's login is Rails-rendered, so the
 * card, the counts and the rows are all in the document and there is no JSON route that
 * answers with any of it. A quarter of a megabyte of it, which is why the fold matters —
 * the pointer coming near a person's link starts this read, and the press a few hundred
 * milliseconds later asks for the same address while the first answer is still on its way.
 *
 * Through `askingOnce`, and that is the only way this can work: the read ahead runs in the
 * content script and the press runs in a screen, which are two bundles with two copies of
 * this module and two Effect runtimes. A map here would fold each side's own reads and the
 * two would never meet. See `flight.ts`, and `servedIssueAt` above, which is the same
 * problem solved the same way.
 */
const theirMarkup = (route: string): Effect.Effect<Came<string>> =>
  askingOnce(
    `https://github.com${route}`,
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`https://github.com${route}`, {
            headers: { Accept: "text/html" },
            credentials: "include"
          }),
        catch: (cause): Came<string> => ({
          ok: false,
          why: "unreachable",
          detail: String(cause)
        })
      })

      if (!response.ok) {
        return yield* Effect.fail<Came<string>>({
          ok: false,
          why: "rejected",
          detail: `HTTP ${response.status}`
        })
      }

      const html = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (cause): Came<string> => ({ ok: false, why: "unreachable", detail: String(cause) })
      })

      return { ok: true, value: html } satisfies Came<string>
      // Said in the value rather than thrown, because a rejection does not carry a reason
      // across a bundle boundary and the joiner is in the other bundle.
    }).pipe(Effect.catch(Effect.succeed))
  )

/** The same read, as the answer or the failure the rest of this file is written in. */
const orFailed = <Value>(route: string, came: Came<Value>) =>
  came.ok
    ? Effect.succeed(came.value)
    : Effect.fail(new WorkingSetError({ route, reason: came.why, detail: came.detail }))

const personDocument = Effect.fn("personDocument")(function* (route: string) {
  return yield* orFailed(route, yield* theirMarkup(route))
})

/** A person's column, kept under the address it is read at. */
const personKey = (login: string): string => `person:${login.toLowerCase()}`

/**
 * The inbox, at the address the reader asked for it at.
 *
 * The query is part of the name because it is part of which inbox this is: `is:unread` and
 * the whole of it are two different lists, and a memory shared between them would paint the
 * one the reader is not looking at.
 */
const noticesRoute = (query: string): string =>
  query === "" ? "/notifications" : `/notifications?${query}`

/**
 * One commit, kept under the address it is read at.
 *
 * The sha in full, as their own address carries it. A commit that has landed never changes,
 * which makes this the truest memory the store holds: what a kept one is missing is
 * nothing at all, and the read behind it only confirms it.
 */
const commitKey = (reference: RepoRef, sha: string): string =>
  `/${reference.owner}/${reference.repo}/commit/${sha}`

/** The row out of a document already read, kept where a later visit will look for it. */
const keepTheTabs = (reference: RepoRef, html: string): Effect.Effect<void> =>
  Effect.sync(() => keepTabs(reference, tabsOnPage(html)))

/**
 * The payload out of a page of theirs, rather than out of a route of theirs.
 *
 * Two pages of the code view are read this way and both for the same reason:
 * `Accept: application/json` answers with the route alone and never with the
 * layout around it, and the layout is where the interesting half is — whether
 * the reader can push, on the front page, and the lines of the file, on a blob.
 * A document holds both halves and is the only answer that does.
 */
const readRepoPage = Effect.fn("GitHubGateway.readRepoPage")(function* (
  reference: RepoRef,
  route: string
) {
  const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, { headers: { Accept: "text/html" }, credentials: "include" }),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  if (!response.ok) {
    return yield* new GatewayError({
      reference,
      route,
      reason: refusedBy(response),
      detail: `HTTP ${response.status}`
    })
  }

  const html = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  /*
   * Every payload the document carries, rather than the one under a name. Their pages
   * hold several side by side, and which of them holds a file's lines or a tree is
   * decided by which one the schema decodes in. So a rename of any of those keys costs
   * a reader here nothing, which is what four renames in two days argued for.
   */
  const payloads = embeddedPayloads(html)
  if (payloads.length === 0) {
    /*
     * A document with nothing in it for us is either a shape of theirs that
     * changed or a wall, and asking here is what tells them apart: their
     * document routes answer a walled repository 200, with a sign-on page in
     * place of the page. Asked only on the way out, so a read that worked never
     * pays for scanning a few hundred kilobytes of rendered README.
     */
    const wall = signOnWanted(html)

    return yield* new GatewayError({
      reference,
      route,
      reason: Option.isSome(wall) ? "sign-on" : "undecodable",
      detail: Option.isSome(wall) ? `single sign-on to ${wall.value}` : "no embedded payload"
    })
  }

  /*
   * The document as well as the payload out of it, because one thing worth having is in
   * neither of their payloads: the repository's own tab row, with the tabs this repository
   * actually has and GitHub's counts beside two of them. It costs nothing here — the
   * document is already read and already in hand — and it is what stops the bar falling
   * back to the two tabs an address can promise. See `repoTabs.ts`.
   */
  return { payloads, html }
})


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
    try: () => fetch(url, { headers: REQUIRED_HEADERS, credentials: "include" }),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  if (!response.ok) {
    return yield* new GatewayError({
      reference,
      route,
      reason: refusedBy(response),
      detail: `HTTP ${response.status}`
    })
  }

  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
  })
})

/**
 * How much of a commit's diff will be read before the size stops being worth
 * counting.
 *
 * Two megabytes of text, which is a commit of roughly thirty thousand lines. A
 * generated lockfile, a vendored dependency and the initial import of a
 * repository all go past it, and all three are commits whose exact line count
 * tells a reader nothing they cannot already tell from the word "huge". The cap
 * is there so that one of them cannot be pulled into memory for a number that
 * is going to be drawn six pixels high.
 */
const MOST_DIFF = 2_000_000

/**
 * A commit's diff as text, counted rather than kept.
 *
 * Read through the stream rather than with `text()`, so the cap above is a cap
 * on what is ever held: `text()` on a fifty megabyte diff has already spent the
 * memory by the time anything here could object. Nothing when the diff runs
 * past the cap, which the row draws as no size at all rather than as a wrong
 * one.
 */
const diffTextAt = Effect.fn("GitHubGateway.diffTextAt")(function* (
  reference: RepoRef,
  route: string
) {
  const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, { headers: { Accept: "text/plain" }, credentials: "include" }),
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

  const stream = response.body
  const broke = (cause: unknown) =>
    new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })

  if (stream === null) {
    const whole = yield* Effect.tryPromise({ try: () => response.text(), catch: broke })
    return whole.length > MOST_DIFF ? Option.none<string>() : Option.some(whole)
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let held = ""

  return yield* Effect.gen(function* () {
    for (;;) {
      const chunk = yield* Effect.tryPromise({ try: () => reader.read(), catch: broke })
      if (chunk.done) return Option.some(held)

      held += decoder.decode(chunk.value, { stream: true })
      if (held.length > MOST_DIFF) {
        yield* Effect.tryPromise({ try: () => reader.cancel(), catch: broke })
        return Option.none<string>()
      }
    }
  }).pipe(Effect.ensuring(Effect.sync(() => reader.releaseLock())))
})

/**
 * One shelf's rows, out of GitHub's payload for it.
 *
 * Written once and used by both the live read and the remembered one, so that a
 * payload out of the store cannot possibly be read differently from the one that
 * has just arrived — which is the only thing that makes remembering safe.
 */
const shelfIn = (
  shelf: Shelf,
  route: string,
  raw: unknown
): Effect.Effect<ReadonlyArray<InvolvedPullRequest>, WorkingSetError> =>
  seeded.pipe(
    Effect.andThen(() => decodeShelf(raw)),
    Effect.map((decoded) =>
      involvedIn(Option.some(shelf), decoded.results)
    ),
    Effect.catch((cause) =>
      Effect.fail(new WorkingSetError({ route, reason: "undecodable", detail: String(cause) }))
    )
  )

/** One page of a search, out of GitHub's payload for it. The same again, for the other list. */
const foundIn = (route: string, raw: unknown): Effect.Effect<Found, WorkingSetError> =>
  seeded.pipe(
    Effect.andThen(() => decodeQuery(raw)),
    Effect.map((decoded): Found => {
      const listing = decoded
      return {
        // None, and not a shelf: this route puts nothing anywhere on the reader's
        // behalf, and saying it did would put a stranger's work in Needs You.
        rows: involvedIn(Option.none(), listing.results),
        pages: Option.map(
          listing.pageInfo === null || listing.pageInfo === undefined
            ? Option.none()
            : Option.some(listing.pageInfo),
          (info) => ({ current: info.currentPage, total: info.totalPages, count: info.totalCount })
        )
      }
    }),
    Effect.catch((cause) =>
      Effect.fail(new WorkingSetError({ route, reason: "undecodable", detail: String(cause) }))
    )
  )

/**
 * Our word for a side of the diff, in the one their write route uses.
 *
 * The two halves are numbered separately, so which of them a remark is about is
 * as much a part of its address as the line number: on the new file, line 43 of
 * the old file is whatever the change left at 43, and on a file whose end was
 * cut it is nothing at all. `sideOf` in `src/ui/threads.ts` says the same thing
 * about the way in.
 *
 * `right` was measured. It is what their own box sends, in lower case, and the
 * request it came from is recorded in `docs/spec/github-write-api.md`. `left`
 * is inferred from the same document, which records this route's marker for the
 * two halves as `R{line}` for the new file and `L{line}` for the old: no
 * request carrying the word for the old file has been read off the wire here.
 */
const asTheyNameIt = (side: NonNullable<ThreadAnchor["lines"]>["side"]): "left" | "right" =>
  side === "before" ? "left" : "right"

/** What a payload that would not decode becomes, on the way out of here. */
const undecodableFrom =
  (reference: RepoRef, route: string) =>
  (cause: unknown): Effect.Effect<never, GatewayError> =>
    Effect.fail(new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) }))

/**
 * What each write route leaves the pull request as.
 *
 * The domain already owns this pairing — `LEADS_TO` in `doable.ts` is the same
 * five verbs against the same five states — and this is the other half of it,
 * keyed by the address rather than by the verb, because the address is what a
 * write has in its hand down here.
 *
 * The routes not named are the ones that change a pull request without changing
 * what it is: a place in a queue, a branch caught up, a thread resolved, a
 * branch deleted. Their payloads are dropped just the same, since every one of
 * those facts is in them.
 */
const LEAVES_IT: Readonly<Record<string, PullRequestState>> = {
  [MERGE]: "merged",
  [MERGE_STACK]: "merged",
  [CLOSE]: "closed",
  [REOPEN]: "open",
  [MARK_READY]: "open",
  [TO_DRAFT]: "draft"
}

/**
 * The same for an issue: what it last answered is no longer what it would.
 *
 * Kept under its own address, which carries the deploy's hash, so the route has
 * to be rebuilt to be dropped. Where no hash is on hand there is nothing kept
 * under one either, and the miss costs a read the next visit was making anyway.
 */
const wroteIssue = Effect.fn("wroteIssue")(function* (reference: IssueRef) {
  const route = yield* keptIssueRoute(reference)
  if (Option.isSome(route)) yield* forgetRoute(route.value)
})

export const layer = Layer.succeed(GitHubGateway, {
    snapshot: Effect.fn("GitHubGateway.snapshot")(function* (reference: PullRequestRef) {
      const raw = yield* payloadsThroughWorker(reference)

      // Before the state is worn, since wearing it is the whole reason this is
      // read at all. A card opened cold in a new tab, on a pull request closed
      // from a list in the last one, is the case it exists for.
      yield* seeded

      const snapshot = yield* decodeInto(reference, raw)

      /*
       * Kept only once it has decoded, and forked rather than waited for. The
       * pull request this was read for is about to be on the screen either way;
       * the write only affects how quickly the next visit is, and paying for
       * that now would be an odd trade.
       *
       * Not kept at all where a droppable route came back empty. What would go in
       * is the hole rather than the pull request, and a hole keeps: one read
       * during an incident would have every later cold open of that pull request
       * draw "GitHub did not answer for this one" first, on a GitHub that is
       * answering perfectly well. The page still draws now; it is only the next
       * visit that goes back to GitHub, which is where the answer is.
       */
      const said = asLanded(snapshot)

      /*
       * Kept only where GitHub agrees with our own last word, which is what the
       * two states differing says. Correcting the snapshot is not enough on its
       * own: what goes into the store is GitHub's raw JSON, and this cannot
       * correct that without rewriting their shape — so a read taken mid-lag
       * would put "open" back the moment the write had dropped it, and that copy
       * outlives the minute the correction lasts.
       *
       * Asked inside the fork rather than before it, because the fork is the
       * moment it matters. A read that began before a merge lands after it, and
       * a verdict taken at fork time was taken while the pull request was still
       * open — so the write dropped the payloads and this put them back.
       */
      if (raw.mergeBox !== null && raw.header !== null) {
        yield* Effect.forkDetach(
          Effect.suspend(() =>
            asLanded(snapshot).state === snapshot.state
              ? remember(reference, raw)
              : Effect.void
          )
        )
      }

      return said
    }),

    tolerated: asTolerated,

    remembered: Effect.fn("GitHubGateway.remembered")(function* (reference: PullRequestRef) {
      const raw = yield* recall(reference)
      if (Option.isNone(raw)) return Option.none<PullRequestSnapshot>()

      yield* seeded

      // Decoded through exactly the path a live read takes. A payload kept
      // before a schema changed fails here and is a miss, where a stored
      // snapshot would have been a lie in the right shape.
      return yield* decodeInto(reference, raw.value).pipe(
        Effect.map((snapshot) => Option.some(asLanded(snapshot))),
        Effect.catch(() => Effect.succeed(Option.none<PullRequestSnapshot>()))
      )
    }),

    comment: Effect.fn("GitHubGateway.comment")(function* (
      reference: PullRequestRef,
      note: NewComment
    ) {
      const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${COMMENT}`

      /*
       * Where the remark goes: on some lines, or on the file as a whole.
       *
       * Their own box sends a range twice — once flat, once inside the
       * positioning it wants back — and refuses a body carrying only one of
       * them. A single line is a range whose ends agree, and their box sends no
       * start at all for one. Both ends take the same side: a reader marks lines
       * out on one half of the diff, and a range whose ends disagreed would run
       * from the old file into the new.
       *
       * A File Remark sends none of that and a subject type instead. `file` in
       * lower case, which is what the route answers with whichever of the two
       * spellings goes in — measured, not read out of their bundle. See
       * `docs/spec/github-write-api.md`.
       */
      const spot = ((): { readonly flat: object; readonly positioning: object } => {
        const lines = note.lines
        if (lines === null) {
          return { flat: { subjectType: "file" }, positioning: { type: "file" } }
        }

        const { side: half, line, startLine } = lines
        const side = asTheyNameIt(half)
        const range = startLine === line ? {} : { startLine, startSide: side }
        return {
          flat: { line, side, subjectType: "line", ...range },
          positioning: { type: "line", line, ...range }
        }
      })()

      const body = {
        comparisonStartOid: note.baseSha,
        comparisonEndOid: note.headSha,
        text: note.body,
        submitBatch: true,
        path: note.path,
        ...spot.flat,
        positioning: {
          baseCommitOid: note.baseSha,
          headCommitOid: note.headSha,
          commitOid: note.headSha,
          path: note.path,
          ...spot.positioning
        }
      }

      const response = yield* Effect.tryPromise({
        try: () =>
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

      const said = yield* textOf(response)

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
        lines: note.lines
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

    /**
     * An answer inside a thread that is already there.
     *
     * The same route a new thread goes to, with `inReplyTo` instead of a place in the diff.
     * Addressed to a comment and not to the thread: sending a thread id is refused with "The
     * comment you are replying to has been deleted.", which is their way of saying there is no
     * comment by that number. So the first comment's own number is what a reply is aimed at.
     *
     * Hands back what the thread says now, GitHub answering with the whole of it.
     */
    reply: Effect.fn("GitHubGateway.reply")(function* (
      reference: PullRequestRef,
      commentId: string,
      body: string
    ) {
      const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${COMMENT}`

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "POST",
            headers: WRITING_HEADERS,
            credentials: "include",
            body: JSON.stringify({ text: body, inReplyTo: commentId, submitBatch: true })
          }),
        catch: (cause) =>
          new GatewayError({ reference, route: COMMENT, reason: "unreachable", detail: String(cause) })
      })

      const said = yield* textOf(response)
      if (!response.ok) {
        return yield* new GatewayError({
          reference,
          route: COMMENT,
          reason: refusedBy(response),
          detail: reasonGiven(said) ?? `HTTP ${response.status}`
        })
      }

      const thread = yield* toCreatedThread(parsed(said), { path: "", lines: null }).pipe(
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

      // The comments and nothing else: the thread this belongs to is the one the reader is
      // looking at, which already knows its own line and its own id.
      return thread.comments
    }),

    /**
     * A resolved thread opened again, which is the other half of resolving one.
     *
     * `/page_data/unresolve_thread`, the same shape as its opposite: measured on their own
     * page, and the same thread id their page data is keyed by. A reader who resolves the
     * wrong thread with one press needs one press to put it back.
     */
    unsettle: Effect.fn("GitHubGateway.unsettle")(function* (
      reference: PullRequestRef,
      threadId: string
    ) {
      yield* writing(reference, UNSETTLE, { threadId })
    }),

    /*
     * Something said about the pull request itself, through their own form.
     *
     * The form is on the page, signed for this render, and there is nowhere else
     * to get what it carries — see `saying.ts` for why that is a constraint rather
     * than a shortcut. What comes back from the post is their entire page, so the
     * comment is read from the route this gateway already reads the conversation
     * with, and the newest one written by the reader is the one just written.
     */
    remark: Effect.fn("GitHubGateway.remark")(function* (
      reference: PullRequestRef,
      body: string
    ) {
      const signing = signingIn(document)
      if (signing === null) {
        return yield* new GatewayError({
          reference,
          route: SAY,
          reason: "rejected",
          detail:
            "GitHub's own comment box is not on this page, so there is nothing signed to post with."
        })
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(signing.action, {
            method: "POST",
            headers: { ...REQUIRED_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
            credentials: "include",
            body: asForm(signing, body)
          }),
        catch: (cause) =>
          new GatewayError({ reference, route: SAY, reason: "unreachable", detail: String(cause) })
      })

      if (!response.ok) {
        return yield* new GatewayError({
          reference,
          route: SAY,
          reason: "rejected",
          detail: `HTTP ${response.status}`
        })
      }

      const written = yield* newestRemark(reference)
      if (Option.isNone(written)) {
        return yield* new GatewayError({
          reference,
          route: ISSUE_COMMENTS,
          reason: "undecodable",
          detail: "GitHub took the comment and then did not list it."
        })
      }

      return written.value
    }),

    review: Effect.fn("GitHubGateway.review")(function* (
      reference: PullRequestRef,
      review: Review
    ) {
      yield* writing(
        reference,
        SUBMIT_REVIEW,
        { body: review.note, event: eventFor(review.verdict), headSha: review.headSha },
        "PUT"
      )
    }),

    merge: Effect.fn("GitHubGateway.merge")(function* (
      reference: PullRequestRef,
      method: MergeMethod
    ) {
      // Their button sends a commit title and message as well; left out, so
      // GitHub writes the same ones it would have suggested.
      yield* writing(reference, MERGE, {
        mergeMethod: method,
        bypassBranchProtections: false
      })
    }),

    /**
     * Lands this layer and every unmerged layer below it, in one operation.
     *
     * The same one press their own "Merge stack" button makes, and the only way
     * a stack lands: the ordinary merge route answers 422 on a layer of one.
     * What it takes with it is `wouldLand` in the domain, and the caller is
     * expected to have shown that before offering the press.
     */
    mergeStack: Effect.fn("GitHubGateway.mergeStack")(function* (
      reference: PullRequestRef,
      method: MergeMethod
    ) {
      yield* writing(reference, MERGE_STACK, { mergeMethod: method })
    }),

    /**
     * Makes the stack out of the chain GitHub is offering, as their own dialog does.
     *
     * Two requests, and the first of them is a read. Their route names the pull
     * requests by GitHub's numeric ids, which nothing on this side of the seam
     * carries and nothing should: the numbers a reader knows are `#15` and `#16`,
     * and the ids beside them in the preview are 4205778980 and 4205779207. So the
     * offer is read here, immediately before it is taken.
     *
     * Which also settles what happens to a proposal that has gone stale on the
     * screen. The strip may have stood over the page for ten minutes while a third
     * pull request joined the chain or somebody else pressed their own button, and
     * a body built from what was drawn then would make the wrong stack or none.
     * What is made is what GitHub offers in the second the press lands.
     *
     * Foundation first, which is the reverse of the order the preview arrives in
     * and the order their own button sends. Whether the route reads the order at
     * all is not known; sending it the other way up to find out is not a thing to
     * learn on somebody's open work.
     *
     * One route and two writes. A chain whose foundation is already in a stack is
     * an addition to that stack rather than a stack to make, and it is the common
     * shape rather than an edge: a reader who stacks four pull requests and then
     * opens a fifth on top of them is in it. GitHub's own name for the route says
     * so — `createStackOrAppend` in their bundle — and their dialog's button reads
     * "Add to stack" there. What separates the two is the body: an addition names
     * the stack in `stackId` and sends only the layers that are in no stack. Sent
     * every id the offer carries, GitHub answers 422 `ALREADY_STACKED` and names
     * the layers that were already in one, having written nothing.
     *
     * Measured on `flazouh/stack-probe` #82 standing on stack 83 (#80, #81): all
     * three ids answered 422, and `{pullRequestIds: [#82's id], stackId}` answered
     * 200 with `{"stackNumber":83}`, after which `preview_stack` answered null and
     * the stack held three pull requests.
     */
    makeStack: Effect.fn("GitHubGateway.makeStack")(function* (reference: PullRequestRef) {
      const raw = yield* fetchRoute(reference, PREVIEW_STACK)
      const offered = yield* whereverItIs(PreviewStackRoute)(raw).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({
              reference,
              route: PREVIEW_STACK,
              reason: "undecodable",
              detail: String(cause)
            })
          )
        )
      )

      const landing = offered === null ? [] : offered.toReversed()
      // The foundation's stack, because that is the one this chain would join.
      const joining = landing[0]?.stackId ?? null
      // The layers in no stack, which is every layer of a chain nobody has
      // stacked and the top ones of a chain standing on a stack.
      const adding = landing.flatMap((layer) => (layer.stackId === null ? [layer.id] : []))

      // Three ways for there to be nothing to write, and one sentence for them:
      // the offer the strip was drawn from has gone. `null` is GitHub's answer on
      // a pull request already in a stack and on one with nothing standing on it,
      // a chain of one is nothing to make, and a chain whose every layer is in
      // the stack already is nothing to add — that last one is somebody else
      // having pressed first, and GitHub answers `null` for it a moment later.
      // None of the three is the write failing, so nothing is sent.
      if (landing.length < 2 || adding.length === 0) {
        return yield* new GatewayError({
          reference,
          route: PREVIEW_STACK,
          reason: "rejected",
          detail: "GitHub no longer offers this stack. Read the pull request again."
        })
      }

      yield* writing(reference, MAKE_STACK, {
        pullRequestIds: adding,
        // Left out rather than sent as null where there is no stack to join. A
        // body naming a stack is the addition, a body that does not is the
        // making, and only the second is known to be accepted by a route asked
        // to make one.
        ...(joining === null ? {} : { stackId: joining })
      })
    }),

    enqueue: Effect.fn("GitHubGateway.enqueue")(function* (
      reference: PullRequestRef,
      how: QueueMethod
    ) {
      // Their own button sends `GROUP` here, in the field a repository without
      // a queue uses for SQUASH or REBASE. The route is not fussy about it —
      // a value it cannot read is ignored rather than refused, and the request
      // succeeds having done something else — so nothing else goes in the body.
      yield* writing(reference, ENQUEUE, { mergeMethod: how })
    }),

    dequeue: Effect.fn("GitHubGateway.dequeue")(function* (reference: PullRequestRef) {
      yield* writing(reference, DEQUEUE)
    }),

    cancelAutoMerge: Effect.fn("GitHubGateway.cancelAutoMerge")(function* (
      reference: PullRequestRef
    ) {
      yield* writing(reference, CANCEL_AUTO_MERGE)
    }),

    updateBranch: Effect.fn("GitHubGateway.updateBranch")(function* (
      reference: PullRequestRef,
      how: UpdateMethod
    ) {
      yield* writing(reference, UPDATE_BRANCH, { updateMethod: how })
    }),

    close: Effect.fn("GitHubGateway.close")(function* (reference: PullRequestRef) {
      yield* writing(reference, CLOSE)
    }),

    reopen: Effect.fn("GitHubGateway.reopen")(function* (reference: PullRequestRef) {
      yield* writing(reference, REOPEN)
    }),

    /*
     * The id their route wants is the one their page data is keyed by, which is
     * the one the snapshot already carries: watched on a live press, their button
     * sent `{"threadId":"2530224233"}` and the payload had that same number as the
     * key of the thread it resolved. The node id their public API answers with
     * would be refused, and this extension does not hold one anyway.
     */
    settle: Effect.fn("GitHubGateway.settle")(function* (
      reference: PullRequestRef,
      threadId: string
    ) {
      yield* writing(reference, SETTLE, { threadId })
    }),

    markReady: Effect.fn("GitHubGateway.markReady")(function* (reference: PullRequestRef) {
      yield* writing(reference, MARK_READY)
    }),

    toDraft: Effect.fn("GitHubGateway.toDraft")(function* (reference: PullRequestRef) {
      yield* writing(reference, TO_DRAFT)
    }),

    deleteBranch: Effect.fn("GitHubGateway.deleteBranch")(function* (reference: PullRequestRef) {
      yield* writing(reference, DELETE_BRANCH)
    }),

    branches: Effect.fn("GitHubGateway.branches")(function* (reference: PullRequestRef) {
      const raw = yield* fetchRoute(reference, MERGE_BOX)
      const decoded = yield* decodeMergeBox(raw).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({
              reference,
              route: MERGE_BOX,
              reason: "undecodable",
              detail: String(cause)
            })
          )
        )
      )

      const { baseRefName, headRefName } = decoded.pullRequest
      if (typeof baseRefName !== "string" || typeof headRefName !== "string") return Option.none()

      const branches = { baseBranch: baseRefName, headBranch: headRefName }
      // Kept, and forked rather than waited for, exactly as a shelf is: the list
      // this was read for is about to be on the screen either way, and the write
      // only changes how quickly the next visit is.
      yield* Effect.forkDetach(rememberBranches(reference, branches))

      return Option.some(branches)
    }),

    howToMerge: Effect.fn("GitHubGateway.howToMerge")(function* (reference: PullRequestRef) {
      const raw = yield* fetchRoute(reference, MERGE_BOX)
      const decoded = yield* decodeMergeBox(raw).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({
              reference,
              route: MERGE_BOX,
              reason: "undecodable",
              detail: String(cause)
            })
          )
        )
      )

      return {
        method: landingMethods(decoded.pullRequest).on,
        // The same rule the card's own stack is read by — see `stacked`. A layer
        // answers 422 on the ordinary merge route, so this is the difference
        // between a press that works and one that comes back talking about a
        // branch being out of date.
        stacked: stacked(decoded.mergeRequirements?.conditions ?? [])
      }
    }),

    sizeOf: Effect.fn("GitHubGateway.sizeOf")(function* (reference: PullRequestRef) {
      const raw = yield* fetchRoute(reference, DIFFSTAT)

      const size = sizeIn(
        yield* decodeDiffstat(raw).pipe(Effect.catch(undecodableFrom(reference, DIFFSTAT)))
      )
      yield* Effect.forkDetach(rememberSize(reference, size))

      return size
    }),

    rememberedRows: (rows) => recallRows(rows),

    portrait: Effect.fn("GitHubGateway.portrait")(function* (
      login: string,
      about: Option.Option<string>
    ) {
      const html = yield* fragmentAt(hovercardRoute(login, about))
      return Option.flatMap(html, (said) => portraitIn(said, login))
    }),

    contributions: Effect.fn("GitHubGateway.contributions")(function* (login: string) {
      const html = yield* fragmentAt(contributionsRoute(login))
      return Option.flatMap(html, contributionsIn)
    }),

    repositories: Effect.fn("GitHubGateway.repositories")(function* () {
      const raw = yield* askedWithoutXhr(`https://github.com${REPOSITORIES}`, REPOSITORIES)
      const repositories = yield* decodedRepositories(raw)

      yield* Effect.forkDetach(rememberRoute(REPOSITORIES, raw, "standing"))

      return repositories
    }),

    rememberedRepositories: Effect.fn("GitHubGateway.rememberedRepositories")(function* () {
      const raw = yield* recallRoute(REPOSITORIES)
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<Repository>>()

      return yield* decodedRepositories(raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<Repository>>()))
      )
    }),

    activity: Effect.fn("GitHubGateway.activity")(function* (
      login: string,
      keeping: Keeping = "standing"
    ) {
      const route = eventsRoute(login)
      // Folded, because the profile's read ahead asks this the moment a pointer comes near
      // a person's link and the screen asks it again on the press. See {@link theirMarkup}.
      const raw = yield* orFailed(route, yield* eventsAt(route))
      const happenings = yield* decodedHappenings(route, raw)

      yield* Effect.forkDetach(rememberRoute(route, raw, keeping))

      return happenings
    }),

    rememberedActivity: Effect.fn("GitHubGateway.rememberedActivity")(function* (login: string) {
      const route = eventsRoute(login)
      const raw = yield* recallRoute(route)
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<Happening>>()

      return yield* decodedHappenings(route, raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<Happening>>()))
      )
    }),

    involvedIssues: Effect.fn("GitHubGateway.involvedIssues")(function* (
      involvement: Involvement
    ) {
      const route = issuesRoute(involvement)
      const raw = yield* fetchViewerRoute(route)
      const issues = yield* decodedIssues(involvement, route, raw)

      yield* Effect.forkDetach(rememberRoute(route, raw, "standing"))

      return issues
    }),

    rememberedInvolvedIssues: Effect.fn("GitHubGateway.rememberedInvolvedIssues")(function* (
      involvement: Involvement
    ) {
      const route = issuesRoute(involvement)
      const raw = yield* recallRoute(route)
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<InvolvedIssue>>()

      return yield* decodedIssues(involvement, route, raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<InvolvedIssue>>()))
      )
    }),

    issueSearch: Effect.fn("GitHubGateway.issueSearch")(function* (query: string, page: number) {
      const route = issueSearchRoute(query, page)
      const raw = yield* fetchViewerRoute(route)
      const found = yield* decodedFoundIssues(route, raw)

      // Browsed rather than standing, exactly as a pull request search is: a
      // repository's page thirty is worth having for the back button and is not
      // worth the room Home's six reads need.
      yield* Effect.forkDetach(rememberRoute(route, raw))

      return found
    }),

    rememberedIssueSearch: Effect.fn("GitHubGateway.rememberedIssueSearch")(function* (
      query: string,
      page: number
    ) {
      const route = issueSearchRoute(query, page)
      const raw = yield* recallRoute(route)
      if (Option.isNone(raw)) return Option.none<FoundIssues>()

      return yield* decodedFoundIssues(route, raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<FoundIssues>()))
      )
    }),

    /**
     * Closes an issue, saying why, and puts a closed one back.
     *
     * Their own page offers exactly this pair and nothing between them, and the reason is
     * the one thing the word "Closed" hides: an issue closed as not planned is an answer to
     * whoever raised it, and an issue closed as completed is a different answer.
     */
    settleIssue: Effect.fn("GitHubGateway.settleIssue")(function* (
      reference: IssueRef,
      id: string,
      settling: Settling
    ) {
      yield* mutating(reference, CLOSE_ISSUE, {
        // Theirs, and sent on every close: null for the two that name no other issue, and
        // GitHub's own name for the other issue on the one that does.
        duplicateIssueId: settling.as === "duplicate" ? settling.of : null,
        id,
        newStateReason: REASON_OF[settling.as]
      })
      yield* wroteIssue(reference)
    }),

    reopenIssue: Effect.fn("GitHubGateway.reopenIssue")(function* (
      reference: IssueRef,
      id: string
    ) {
      yield* mutating(reference, REOPEN_ISSUE, { id })
      yield* wroteIssue(reference)
    }),

    /**
     * A comment on an issue, which is the one write their React page gave no way to make.
     *
     * A pull request's remark goes through GitHub's own form, read off the page and posted
     * with what it carries. Their issue page renders no form at all, so this took the same
     * road as closing one: their own mutation, recorded off their own box on 2026-08-06.
     *
     * Relay sends a `connections` array with it, naming the list in its store to splice the
     * new comment into. That is bookkeeping for their cache and the server does not want it:
     * the mutation answers the same either way, measured both ways on `stack-probe` #77.
     *
     * The comment comes back whole, GitHub's own rendering included, so the conversation
     * shows exactly what a re-read would show without the re-read.
     */
    sayOnIssue: Effect.fn("GitHubGateway.sayOnIssue")(function* (
      reference: IssueRef,
      id: string,
      body: string
    ) {
      const said = yield* mutating(reference, SAY_ON_ISSUE, { input: { body, subjectId: id } })

      const answer = yield* decodeAddedComment(said).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({
              reference,
              route: `${GRAPHQL} ${SAY_ON_ISSUE}`,
              reason: "undecodable",
              detail: String(cause)
            })
          )
        )
      )

      return remarkFrom(answer)
    }),

    raise: Effect.fn("GitHubGateway.raise")(function* (reference: RepoRef, draft: Raising) {
      /*
       * The three facts this write needs and does not carry, each of which the
       * page either says or does not. Asked for before the request and reported
       * apart from it, because a reader who is told "GitHub refused that" about a
       * hash this extension could not find has been told something false.
       */
      const hash = yield* raisingHash
      if (Option.isNone(hash)) {
        return yield* new GatewayError({
          reference,
          route: RAISING,
          reason: "not-recorded",
          detail: `Nothing on this page says which ${CREATE_ISSUE} GitHub will answer.`
        })
      }

      const repository = scopedRepositoryIn(embeddedOnPage(document), reference)
      if (Option.isNone(repository)) {
        return yield* new GatewayError({
          reference,
          route: RAISING,
          reason: "not-recorded",
          detail: `This page does not say which repository ${reference.owner}/${reference.repo} is.`
        })
      }

      const nonce = nonceOn(document)
      if (Option.isNone(nonce)) {
        return yield* new GatewayError({
          reference,
          route: RAISING,
          reason: "rejected",
          detail: "no fetch-nonce on this page"
        })
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`https://github.com${GRAPHQL}`, {
            method: "POST",
            /*
             * `text/plain` rather than `application/json`, which is what every
             * other write here sends. It is what their own form sent when this was
             * recorded off the wire, and it is what was verified against a live
             * repository — a route that is theirs and undocumented gets the
             * headers that were measured, not the ones that look right.
             */
            headers: {
              ...REQUIRED_HEADERS,
              ...VERIFIED,
              "Content-Type": "text/plain;charset=UTF-8",
              "X-Fetch-Nonce": nonce.value
            },
            credentials: "include",
            body: JSON.stringify({
              persistedQueryName: CREATE_ISSUE,
              query: hash.value,
              /*
               * Three fields, against the ten their own form sends. The other
               * seven — a client mutation id, a duplicate flag, an issue type, a
               * parent, a set of template fields — were each sent as null or false
               * by their form and each dropped here after the write was verified
               * without it.
               */
              variables: {
                input: {
                  repositoryId: repository.value,
                  title: draft.title.trim(),
                  body: draft.body
                }
              }
            })
          }),
        catch: (cause) =>
          new GatewayError({
            reference,
            route: RAISING,
            reason: "unreachable",
            detail: String(cause)
          })
      })

      const said = yield* textOf(response)
      const body = parsed(said)

      // Their own words first, from either place they leave them, and only then
      // the status: this route answers 200 for a refusal, so the sentence is the
      // whole of what says whether anything was raised.
      const refused = graphqlRefusal(body)
      if (refused !== undefined || !response.ok) {
        return yield* new GatewayError({
          reference,
          route: RAISING,
          reason: "rejected",
          detail: refused ?? reasonGiven(said) ?? `HTTP ${response.status}`
        })
      }

      const created = yield* whereverItIs(CreatedIssueRoute)(body).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({
              reference,
              route: RAISING,
              reason: "undecodable",
              detail: String(cause)
            })
          )
        )
      )

      return {
        owner: reference.owner,
        repo: reference.repo,
        number: created.data.createIssue.issue.number
      }
    }),

    issue: Effect.fn("GitHubGateway.issue")(function* (reference: IssueRef) {
      const asking = yield* askedIssue(reference)
      if (Option.isNone(asking)) {
        // Nobody has the hash on this page, which is every issue reached from
        // their own list. Read it out of its own served page instead, and keep
        // what that page says the hash is so this is the once it happens.
        const preloaded = yield* issueInItsPage(reference)
        const snapshot = yield* decodedIssue(reference, preloaded.result)

        // Under the route it would have come back from, which is the key the
        // store is read by. Written this way, the same issue opened again is
        // drawn from memory even though nothing ever asked that route.
        yield* Effect.forkDetach(
          rememberRoute(issueRoute(reference, preloaded.hash), preloaded.result)
        )

        return snapshot
      }

      const raw = yield* askedGraphql(reference, asking.value)
      const snapshot = yield* decodedIssue(reference, raw)

      yield* Effect.forkDetach(rememberRoute(asking.value, raw))

      return snapshot
    }),

    rememberedIssue: Effect.fn("GitHubGateway.rememberedIssue")(function* (reference: IssueRef) {
      const asking = yield* keptIssueRoute(reference)
      if (Option.isNone(asking)) return Option.none<IssueSnapshot>()

      const raw = yield* recallRoute(asking.value)
      if (Option.isNone(raw)) return Option.none<IssueSnapshot>()

      return yield* decodedIssue(reference, raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<IssueSnapshot>()))
      )
    }),

    workingSet: Effect.fn("GitHubGateway.workingSet")(function* (shelf: Shelf) {
      const route = shelfRoute(shelf)
      const raw = yield* fetchViewerRoute(route)
      const rows = yield* shelfIn(shelf, route, raw)

      // Kept once it has decoded, and forked rather than waited for, for the
      // same reason a pull request is: the list this was read for is about to be
      // on the screen either way, and the write only changes how quickly the
      // next visit is.
      //
      // On the standing index, because all six have to be there for Home to open
      // from memory and the browsed routes would otherwise push them out one by one.
      yield* Effect.forkDetach(rememberRoute(route, raw, "standing"))

      return rows
    }),

    rememberedShelf: Effect.fn("GitHubGateway.rememberedShelf")(function* (shelf: Shelf) {
      const route = shelfRoute(shelf)
      const raw = yield* recallRoute(route)
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<InvolvedPullRequest>>()

      return yield* shelfIn(shelf, route, raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<InvolvedPullRequest>>()))
      )
    }),

    search: Effect.fn("GitHubGateway.search")(function* (query: string, page: number) {
      const route = searchRoute(query, page)
      const raw = yield* fetchViewerRoute(route)
      const found = yield* foundIn(route, raw)

      yield* Effect.forkDetach(rememberRoute(route, raw))

      return found
    }),

    rememberedSearch: Effect.fn("GitHubGateway.rememberedSearch")(function* (
      query: string,
      page: number
    ) {
      const route = searchRoute(query, page)
      const raw = yield* recallRoute(route)
      if (Option.isNone(raw)) return Option.none<Found>()

      return yield* foundIn(route, raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<Found>()))
      )
    }),

    standingsFor: Effect.fn("GitHubGateway.standingsFor")(function* (ids: ReadonlyArray<string>) {
      if (ids.length === 0) return new Map() as Standings

      // Concurrently, because the batches are independent and a Working Set of
      // forty is five round trips that would otherwise be taken one at a time
      // while the reader looks at rows with no checks on them.
      const batches = yield* Effect.all(
        inBatches(ids).map((batch) =>
          Effect.gen(function* () {
            const route = deferredRoute(batch)
            const raw = yield* fetchViewerRoute(route)
            const decoded = yield* decodeDeferred(raw).pipe(
              Effect.catch((cause) =>
                Effect.fail(
                  new WorkingSetError({ route, reason: "undecodable", detail: String(cause) })
                )
              )
            )
            return standingsIn(decoded)
          })
        ),
        { concurrency: "unbounded" }
      )

      const joined = new Map<string, ReturnType<Standings["get"]> & {}>()
      for (const batch of batches) {
        for (const [id, standing] of batch) joined.set(id, standing)
      }

      // Kept, and forked rather than waited for, exactly as a stack and a size
      // are: the list this was read for is about to be on the screen either way,
      // and the write only changes what the next visit opens with.
      yield* Effect.forkDetach(
        Effect.forEach(joined, ([id, standing]) => rememberStanding(id, standing), {
          discard: true
        })
      )

      return joined as Standings
    }),

    notes: Effect.fn("GitHubGateway.notes")(function* (reference: PullRequestRef, check: Check) {
      const run = checkRunIn(check)
      // Only Actions checks have one of these pages. A check from anything
      // else links somewhere we know nothing about, and has no notes here.
      if (run === undefined) return []

      const route = `/checks?check_run_id=${run}`
      const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${route}`

      const response = yield* Effect.tryPromise({
        try: () =>
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
        try: () => response.text(),
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
        try: () =>
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
        try: () => response.text(),
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
        try: () => fetch(url, { headers: { Accept: "text/plain" } }),
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
      const tail = yield* tailOf(response.body as ReadableStream<Uint8Array>, keep).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
          )
        )
      )

      return linesIn(tail.text, tail.startAt)
    }),

    steps: Effect.fn("GitHubGateway.steps")(function* (
      reference: PullRequestRef,
      check: Check
    ) {
      const run = runIn(check.url)
      // Only an Actions job runs as steps. Anything else — a status posted by a
      // service, a check from another CI — has one outcome and no inside.
      if (Option.isNone(run)) return []

      const route = `${run.value}/jobs/steps`

      // Their own job page first, for the one number this route is keyed by: it
      // is internal, it is not the check run id every link we hold carries, and
      // asking with the id we do hold answers 404. Measured against the live
      // route, which is what `scripts/probe-check-steps.js` was written to find.
      const page = yield* Effect.tryPromise({
        try: () =>
          fetch(new URL(check.url, "https://github.com").href, {
            headers: { Accept: "text/html" },
            credentials: "include"
          }),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
      })

      if (!page.ok) {
        return yield* new GatewayError({
          reference,
          route,
          reason: "rejected",
          detail: `HTTP ${page.status}`
        })
      }

      const html = yield* Effect.tryPromise({
        try: () => page.text(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
      })

      const job = jobIn(html)
      // A page that no longer names the route it reads its own steps from. The
      // dialog still has the log and the link, which is what it had before.
      if (Option.isNone(job)) return []

      const response = yield* Effect.tryPromise({
        try: () =>
          // JSON explicitly: asked with anything else this route answers 400.
          fetch(`https://github.com${run.value}/jobs/${job.value}/steps`, {
            headers: { Accept: "application/json" },
            credentials: "include"
          }),
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
        try: () => response.text(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
      })

      return stepsIn(raw)
    }),

    commit: Effect.fn("GitHubGateway.commit")(function* (reference: RepoRef, sha: string) {
      const route = commitRoute(sha)
      const raw = yield* readRepoRoute(reference, route)

      const detail = yield* toCommit(raw).pipe(Effect.catch(undecodableFrom(reference, route)))

      // Kept without its diffs, which is the whole of `keptCommit.ts`: the facts and the
      // file names are a few hundred bytes and are what the page is drawn from, and the
      // content of a file is fetched when it is opened either way.
      yield* Effect.forkDetach(rememberRoute(commitKey(reference, sha), keptCommitFrom(detail)))

      return detail
    }),

    rememberedCommit: Effect.fn("GitHubGateway.rememberedCommit")(function* (
      reference: RepoRef,
      sha: string
    ) {
      const raw = yield* recallRoute(commitKey(reference, sha))
      if (Option.isNone(raw)) return Option.none<CommitDetail>()

      return commitFromKept(raw.value)
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

    commits: Effect.fn("GitHubGateway.commits")(function* (list: CommitList) {
      const route = routeFor(list)
      const raw = yield* readRepoRoute(list.repo, route)

      // Only the list. The marks are deliberately not kept: a green tick read out
      // of the store is the one thing on this page that is drawn identically
      // whether it is a second old or a day old, and a branch that has gone red
      // since would look tested and clear.
      yield* Effect.forkDetach(rememberRoute(pageKey(list), raw))

      return yield* historyFrom(raw).pipe(Effect.catch(undecodableFrom(list.repo, route)))
    }),

    /**
     * A workflow run, out of the one document that holds all of it.
     *
     * A document and not JSON, because their run page is server-rendered Turbo: the
     * facts, the twelve jobs and the fifteen notes are in the markup it is served as,
     * and the JSON routes beside it answer with a subset of the same jobs. So this is
     * one request where their own page spends four.
     *
     * The address is rebuilt from the reference rather than passed through, so an
     * attempt is asked for by number and a job's address cannot send this read
     * somewhere that answers with one job.
     */
    run: Effect.fn("GitHubGateway.run")(function* (reference: RunRef) {
      const route = runRoute(reference)
      const html = yield* runDocument(reference, route)

      const opening = runOnPage(html)
      // Undecodable rather than empty. A run has a workflow and an outcome or it is
      // not a run, and a screen told nothing can hand the document back to GitHub
      // instead of drawing a page with no facts on it.
      if (opening === null) {
        return yield* new GatewayError({
          reference: reference.repo,
          route,
          reason: "undecodable",
          detail: "no run on the page"
        })
      }

      /*
       * Kept, so that coming back to a run is the page rather than a wait for it.
       *
       * The decoded run rather than the document it came out of: their page is half a
       * megabyte of markup and this is a few hundred bytes of facts. Browsed rather than
       * standing, as every page reached by pressing a row is: worth having for the way
       * back, not worth the room the Working Set's own reads need.
       */
      yield* Effect.forkDetach(rememberRoute(runKey(reference), opening))

      return opening
    }),

    /**
     * Every job of a run again, or the failed ones on their own.
     *
     * The failed ones is the press a reader of a red run came for, and it is not a
     * filter this applies: GitHub renders a form per choice, and this posts the one
     * that was asked for. A run with nothing failed carries no such form, and the
     * refusal is theirs rather than a request they would have turned down.
     */
    rerunRun: Effect.fn("GitHubGateway.rerunRun")(function* (
      reference: RunRef,
      which: "all" | "failed"
    ) {
      yield* pressingRun(reference, which === "failed" ? "rerunFailed" : "rerun")
    }),

    /**
     * Stops a run that is still going.
     *
     * Addressed by the check suite behind the run, which is the one number here that
     * cannot be worked out from the address: their own form on the run page carries
     * it, so the form is read rather than the id guessed at.
     */
    cancelRun: Effect.fn("GitHubGateway.cancelRun")(function* (reference: RunRef) {
      yield* pressingRun(reference, "cancel")
    }),

    rememberedRun: Effect.fn("GitHubGateway.rememberedRun")(function* (reference: RunRef) {
      const raw = yield* recallRoute(runKey(reference))
      if (Option.isNone(raw)) return Option.none<RunOpening>()

      return isKeptRun(raw.value) ? Option.some(raw.value) : Option.none<RunOpening>()
    }),

    /**
     * Their Actions list, folded into Strands.
     *
     * One document again, and the same reason: every row carries the ref, the outcome, the
     * duration and the pull request already, so the folding needs no second request. The
     * page is asked for without a query, which is the one their Actions tab opens with.
     */
    strands: Effect.fn("GitHubGateway.strands")(function* (reference: RepoRef) {
      const route = "/actions"
      const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

      const response = yield* Effect.tryPromise({
        try: () => fetch(url, { headers: { Accept: "text/html" }, credentials: "include" }),
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
        try: () => response.text(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
      })

      const strands = strandsIn(runsOnPage(html))

      // Kept for the same reason a run is, and it matters more here: this list is what a
      // reader comes back to between runs.
      yield* Effect.forkDetach(rememberRoute(strandsKey(reference), strands))

      return strands
    }),

    rememberedStrands: Effect.fn("GitHubGateway.rememberedStrands")(function* (
      reference: RepoRef
    ) {
      const raw = yield* recallRoute(strandsKey(reference))
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<Strand>>()

      return isKeptStrands(raw.value)
        ? Option.some(raw.value)
        : Option.none<ReadonlyArray<Strand>>()
    }),

    /**
     * Their releases list, read as the document they serve it as.
     *
     * One request, and the notes come whole: their own page hides the long ones behind a CSS
     * rule rather than cutting them server-side, so reading the markup is what answers the
     * truncation complaint at no cost. Asked for without a query, which is the page their
     * Releases tab opens with.
     */
    releases: Effect.fn("GitHubGateway.releases")(function* (reference: RepoRef) {
      const versions = versionsOnPage(yield* repoDocument(reference, "/releases"))

      // Kept for the reason the Actions list is, and it matters as much: somebody who came to
      // download something has no patience for a spinner.
      yield* Effect.forkDetach(rememberRoute(releasesKey(reference), versions))

      return versions
    }),

    /**
     * The files of one Version, out of the fragment their own page defers.
     *
     * The one read here that exists because GitHub withheld something rather than because they
     * buried it: their list page names no file at all, so this is not an optimisation but the
     * only way to learn a filename without the API. One tag, because Yours is about the newest
     * Version.
     */
    builds: Effect.fn("GitHubGateway.builds")(function* (reference: RepoRef, tag: string) {
      const route = `/releases/expanded_assets/${encodeURIComponent(tag)}`
      return buildsOnPage(yield* repoDocument(reference, route))
    }),

    rememberedReleases: Effect.fn("GitHubGateway.rememberedReleases")(function* (
      reference: RepoRef
    ) {
      const raw = yield* recallRoute(releasesKey(reference))
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<Version>>()

      return isKeptVersions(raw.value)
        ? Option.some(raw.value)
        : Option.none<ReadonlyArray<Version>>()
    }),

    /**
     * Their discussions list, read as the document they serve it as.
     *
     * One request for the rows, the categories and the paging together, because all three are in
     * the one document. Their own page spends more than that on the same screen: the row's
     * hovercard, the vote form and the category menu are each a route of their own, and none of
     * them is asked here.
     */
    discussions: Effect.fn("GitHubGateway.discussions")(function* (list: DiscussionList) {
      /*
       * `listRouteOf` writes the address and the store's key alike, so a category and a search
       * can never be handed each other's rows while their own read is in the air. The read takes
       * the part after the repository, because that is what `repoDocument` appends.
       */
      const key = listRouteOf(list)
      const document = yield* discussionDocument(list.home, listWithinHome(list))

      const found: FoundDiscussions = {
        rows: discussionsOnPage(document),
        categories: categoriesOnPage(document),
        more: hasMoreAfter(document)
      }

      yield* Effect.forkDetach(rememberRoute(key, found))

      return found
    }),

    rememberedDiscussions: Effect.fn("GitHubGateway.rememberedDiscussions")(function* (
      list: DiscussionList
    ) {
      const raw = yield* recallRoute(listRouteOf(list))
      if (Option.isNone(raw)) return Option.none<FoundDiscussions>()

      // Refused whole rather than half-read: an entry written before this shape had its
      // categories would answer `undefined` there and empty the filter.
      return isKeptFound(raw.value) ? Option.some(raw.value) : Option.none<FoundDiscussions>()
    }),

    /**
     * One discussion, read as the document they serve it as.
     *
     * A failure and not an empty snapshot where the page cannot be read. The screen has a word
     * for a read that did not come — it hands the document back to GitHub — and no word at all
     * for a discussion with no title, which it would draw over the top of their page.
     */
    discussion: (reference: DiscussionRef) => readDiscussion(reference),

    /**
     * Everything else their menu offers on one thing, read from the route their own page names.
     *
     * Two requests where a press follows: one to read the menu, one to send the form in it. Their
     * own page spends the first the moment somebody opens the menu, and the second is the press.
     */
    discussionDoings: Effect.fn("GitHubGateway.discussionDoings")(function* (
      _reference: DiscussionRef,
      on: "Discussion" | "DiscussionComment",
      id: string
    ) {
      const html = yield* menuHtml(on, id)

      return doingsIn(html)
    }),

    /**
     * One of the presses, sent as the form GitHub put on the page for it.
     *
     * The document is this tab's own, which is the whole of why this works: the extension is
     * standing on the page their form was rendered into, and the token in it is signed for
     * exactly that render.
     */
    pressDiscussion: Effect.fn("GitHubGateway.pressDiscussion")(function* (
      reference: DiscussionRef,
      press: DiscussionPress
    ) {
      const route = discussionAddress(reference)
      const reported = homeRef(reference.home)

      /*
       * A menu entry is the one press whose form is not on the page. Their markup names the
       * route that serves it and the menu is read again here, so what is sent is the form behind
       * the words the reader pressed rather than a route this codebase made up. Fetched before
       * the choice below, which is why it is read out here and not inside it.
       */
      const menu = press.kind === "doing" ? yield* menuHtml(press.on, press.id) : null

      const { posting, said } = sending(document, press, menu)

      if (posting === null) {
        return yield* new GatewayError({
          reference: reported,
          route,
          reason: "rejected",
          detail: "GitHub rendered no form for that on this page, so there is nothing to send."
        })
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(posting.action, {
            method: "POST",
            headers: { ...REQUIRED_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
            credentials: "include",
            body: sendingOf(posting, said)
          }),
        catch: (cause) =>
          new GatewayError({
            reference: reported,
            route,
            reason: "unreachable",
            detail: String(cause)
          })
      })

      if (!response.ok) {
        return yield* new GatewayError({
          reference: reported,
          route,
          reason: "rejected",
          detail: `HTTP ${response.status}`
        })
      }

      // What was kept is now what GitHub would no longer answer with, so it goes before the read
      // that follows it, exactly as a write on an issue drops the issue it wrote to.
      yield* forgetRoute(route)

      return yield* readDiscussion(reference)
    }),

    rememberedDiscussion: Effect.fn("GitHubGateway.rememberedDiscussion")(function* (
      reference: DiscussionRef
    ) {
      const raw = yield* recallRoute(discussionAddress(reference))
      if (Option.isNone(raw)) return Option.none<DiscussionSnapshot>()

      return isKeptDiscussion(raw.value)
        ? Option.some(raw.value)
        : Option.none<DiscussionSnapshot>()
    }),

    /**
     * Their inbox, read as the document they serve it as.
     *
     * One request, and the lightest read on this interface. Their `/notifications` is Rails
     * end to end, so the reason, the read state, the subject's own Octicon and all twelve
     * write forms of every row are in the markup before any script runs — measured on
     * 2026-08-13, with fifteen rows in 1.1 megabytes.
     *
     * The reader's query is carried through untouched. It is the one thing about this page
     * that is theirs and still matters: a link into `?query=is:unread` is a link to a
     * smaller inbox, and answering it with the whole one would be this screen overruling
     * the address it was opened at.
     */
    notices: Effect.fn("GitHubGateway.notices")(function* (query: string) {
      const route = noticesRoute(query)
      const url = `https://github.com${route}`

      const response = yield* Effect.tryPromise({
        try: () => fetch(url, { headers: { Accept: "text/html" }, credentials: "include" }),
        catch: (cause) =>
          new WorkingSetError({ route, reason: "unreachable", detail: String(cause) })
      })

      if (!response.ok) {
        return yield* new WorkingSetError({
          route,
          reason: "rejected",
          detail: `HTTP ${response.status}`
        })
      }

      const html = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (cause) =>
          new WorkingSetError({ route, reason: "unreachable", detail: String(cause) })
      })

      const notices = noticesOnPage(html)

      /*
       * Kept as the rows rather than as their markup, unlike every route above that keeps
       * the payload it decoded. A megabyte of their HTML is far past what a store entry
       * should be, and there is no decoder to re-run against it: the reading is the parse.
       *
       * Standing rather than browsed. An inbox is the page a reader opens first and comes
       * back to all day, and it is one address rather than a page of a search, so it is
       * worth a place that a morning of browsing cannot push out.
       */
      yield* Effect.forkDetach(rememberRoute(route, notices, "standing"))

      return notices
    }),

    /**
     * One page after the first of a person's repositories tab.
     *
     * A document again, and this one is asked for exactly as the reader's own address
     * asks for it: `tabRoute` writes the tab, the page and every narrowing the address
     * carried, so the rows that come back are the rows that address means.
     *
     * Nothing is kept between visits. Every other list here remembers what it read because
     * the read is what the reader waits on; on a page GitHub served, the first page of this
     * one costs no request at all. What carries the case that matters — a press answered
     * without a document load, which arrives with no rows on the page — is the fold in
     * {@link theirMarkup}: the read the pointer started is still in the air, and this waits
     * on that one rather than asking again.
     */
    personRepositories: Effect.fn("GitHubGateway.personRepositories")(function* (
      login: string,
      page: number,
      narrowing: string
    ) {
      const route = tabRoute({ login, tab: "repositories", page, find: "", narrowing }, page)
      const html = yield* personDocument(route)

      return { rows: repositoriesOnPage(html), more: hasNextOnPage(html) }
    }),

    /**
     * The column down the left of their profile, over the network.
     *
     * Read off their repositories tab rather than off their profile, which looks like the
     * wrong page and is the right one: the card is the same on all three of their pages,
     * and this is the page both person screens need anyway. Asked at the address
     * {@link personRepositories} asks page one at, character for character, so the two
     * reads are one fetch — the profile draws a column and six repositories out of a
     * single document, and the tab draws a column and thirty out of the same one.
     *
     * Which is why the narrowing is asked for rather than assumed to be empty. The card is
     * the same whatever the tab is filtered by, so any address would answer; only the one
     * the list is already fetching costs nothing. Left empty, a reader on
     * `?tab=repositories&type=fork` paid for a second whole document for a card that was
     * in the first.
     *
     * Kept as the column rather than as the markup it was read from — see `keptPerson.ts`
     * — and kept as browsed rather than standing: a person is somewhere a reader went, and
     * the eleven routes Home is built from must not be pushed out by an afternoon of
     * reading other people's profiles.
     */
    person: Effect.fn("GitHubGateway.person")(function* (login: string, narrowing: string) {
      const route = tabRoute({ login, tab: "repositories", page: 1, find: "", narrowing }, 1)
      const found = personOnPage(yield* personDocument(route))

      yield* Option.match(found, {
        // An organisation, or an account GitHub has since renamed. Nothing to keep, and
        // nothing to say: the screen hands the page back and GitHub draws their own.
        onNone: () => Effect.void,
        onSome: (who) => Effect.forkDetach(rememberRoute(personKey(login), asKept(who)))
      })

      return found
    }),

    rememberedPerson: Effect.fn("GitHubGateway.rememberedPerson")(function* (login: string) {
      const raw = yield* recallRoute(personKey(login))
      return Option.isNone(raw) ? Option.none<Person>() : personKept(raw.value)
    }),

    rememberedNotices: Effect.fn("GitHubGateway.rememberedNotices")(function* (query: string) {
      const raw = yield* recallRoute(noticesRoute(query))
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<Notice>>()

      return isKeptNotices(raw.value)
        ? Option.some(raw.value)
        : Option.none<ReadonlyArray<Notice>>()
    }),

    /**
     * One press of one of their own forms, sent back the way their page sends it.
     *
     * The ids go on the body even for the two routes whose forms carry none. `mark` and
     * `unmark` are bulk forms at the top of their page and take their ids from the checked
     * boxes beside the rows; a caller that is not their page has no boxes, so it names the
     * threads itself. Exercised on 2026-08-13 with a single `notification_ids[]` on each,
     * and both answered 200 with a zero-byte body.
     *
     * Nothing is read back. Their answer carries no body at all, so a re-read is the only
     * way to confirm one, and the screen has already drawn the new state.
     */
    pressNotice: Effect.fn("GitHubGateway.pressNotice")(function* (press: Press) {
      const telling = new URLSearchParams()
      telling.set("authenticity_token", press.token)
      for (const id of press.ids) telling.append("notification_ids[]", id)

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`https://github.com${press.route}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "text/html"
            },
            credentials: "include",
            body: telling.toString()
          }),
        catch: (cause) =>
          new WorkingSetError({ route: press.route, reason: "unreachable", detail: String(cause) })
      })

      if (!response.ok) {
        return yield* new WorkingSetError({
          route: press.route,
          reason: "rejected",
          detail: `HTTP ${response.status}`
        })
      }
    }),

    repoHome: Effect.fn("GitHubGateway.repoHome")(function* (
      reference: RepoRef,
      branch: string | null
    ) {
      const route = branch === null ? "" : `/tree/${branch}`
      const page = yield* readRepoPage(reference, route)

      const front = yield* frontFrom(reference, page.payloads).pipe(
        Effect.catch(undecodableFrom(reference, route))
      )

      yield* Effect.forkDetach(rememberRoute(frontKey(reference, branch), keptFrom(front)))
      // The tab row out of the same document, at the cost of one parse. See `tabs` below.
      yield* Effect.forkDetach(keepTheTabs(reference, page.html))

      return front
    }),

    /**
     * A repository's own tab row: which tabs it has, where they go, and their counts.
     *
     * Its own read because the bar stands on every page of a repository and most of them
     * are not the front page. A reader who opens a pull request first has never fetched the
     * document their row lives in, and the bar there had nothing to draw but Code and Pull
     * requests — no Issues, no Actions, no counts — until GitHub's own header hydrated
     * underneath our screen.
     *
     * The whole front page for one row is a heavy read and it is the only place the row is
     * served. It is warmed on the pointer and kept per repository, so it is paid once.
     */
    tabs: Effect.fn("GitHubGateway.tabs")(function* (reference: RepoRef) {
      const route = ""
      const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

      const response = yield* Effect.tryPromise({
        try: () => fetch(url, { headers: { Accept: "text/html" }, credentials: "include" }),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
      })

      if (!response.ok) {
        return yield* new GatewayError({
          reference,
          route,
          reason: refusedBy(response),
          detail: `HTTP ${response.status}`
        })
      }

      const html = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
      })

      const found = tabsOnPage(html)
      yield* Effect.sync(() => keepTabs(reference, found))

      return found
    }),

    /**
     * Who can be mentioned here, and what can be referred to by number.
     *
     * Their own suggester, which their own box asks the moment an at sign is typed. Two
     * flags on one route, both answering with the whole list and neither taking a query, so
     * this is read once for a repository and filtered wherever a box is standing.
     *
     * `X-Requested-With: XMLHttpRequest` is not optional: without it the route answers 406,
     * whatever the Accept header says. Nor is standing inside the repository being asked
     * about, which answers 406 as well.
     */
    suggesting: Effect.fn("GitHubGateway.suggesting")(function* (reference: RepoRef) {
      const route = "/suggestions/issue"
      const asking = `repository=${reference.repo}&user_id=${reference.owner}`

      const reading = (flag: string) =>
        Effect.tryPromise({
          try: () =>
            fetch(`https://github.com${route}?${flag}=1&${asking}`, {
              headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
              credentials: "include"
            }),
          catch: (cause) =>
            new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
        }).pipe(
          Effect.flatMap((response) =>
            response.ok
              ? textOf(response)
              : Effect.fail(
                  new GatewayError({
                    reference,
                    route,
                    reason: refusedBy(response),
                    detail: `HTTP ${response.status}`
                  })
                )
          )
        )

      const [said, numbered] = yield* Effect.all(
        [reading("mention_suggester"), reading("issue_suggester")],
        { concurrency: 2 }
      )

      /*
       * A list that will not read is an empty list rather than a failure. Nothing on the
       * screen depends on this: the box works without it, offering nobody, and a comment
       * that could not be written because a suggester changed shape would be absurd.
       */
      const people = yield* decodeMentionable(parsed(said)).pipe(
        Effect.map(peopleIn),
        Effect.catch(() => Effect.succeed([] as ReadonlyArray<Named>))
      )
      const referable = yield* decodeReferable(parsed(numbered)).pipe(
        Effect.map(numberedIn),
        Effect.catch(() => Effect.succeed([] as ReadonlyArray<Numbered>))
      )

      return { people, numbered: referable } satisfies Suggesting
    }),

    /**
     * A file into GitHub's own store, in the three requests their own box makes.
     *
     * Recorded off their box on a scratch repository, one paste at a time:
     *
     * 1. `POST /upload/policies/assets`, a form of `repository_id`, `name`, `size` and
     *    `content_type`. Answers 201 with a signed form, an address to post it to, and the
     *    address the file will have. 422 without `GitHub-Verified-Fetch`, which is what stands
     *    in for a CSRF token here as it does on the writes.
     * 2. `POST` to their storage with that form and the bytes. Cross-origin, no cookies, and
     *    the fields go in as they came: the signature covers them.
     * 3. `PUT` the `asset_upload_url` with the token from the first answer, which is what turns
     *    a file in a bucket into an attachment. The address works without it for a while and
     *    then does not, so it is not optional.
     *
     * The size and type are the file's own. Nothing is checked against a limit here: GitHub
     * refuses with a sentence of their own about what is too big for what, and their sentence
     * is better than a number written down in this file that goes stale.
     */
    upload: Effect.fn("GitHubGateway.upload")(function* (reference: RepoRef, file: File) {
      const route = "/upload/policies/assets"

      const nonce = nonceOn(document)
      if (Option.isNone(nonce)) {
        return yield* new GatewayError({
          reference,
          route,
          reason: "rejected",
          detail: "no fetch-nonce on this page"
        })
      }

      const number = repositoryNumberFor(document, reference, (asked) =>
        Option.isSome(scopedRepositoryIn(embeddedOnPage(document), asked))
      )
      if (Option.isNone(number)) {
        return yield* new GatewayError({
          reference,
          route,
          reason: "not-recorded",
          detail: `This page does not say which repository ${reference.owner}/${reference.repo} is.`
        })
      }

      const asking = new FormData()
      asking.append("repository_id", number.value)
      asking.append("name", file.name)
      asking.append("size", String(file.size))
      asking.append("content_type", file.type === "" ? "application/octet-stream" : file.type)

      const answered = yield* Effect.tryPromise({
        try: () =>
          fetch(`https://github.com${route}`, {
            method: "POST",
            // No Content-Type: the browser writes one with the boundary in it.
            headers: { ...REQUIRED_HEADERS, ...VERIFIED, "X-Fetch-Nonce": nonce.value },
            credentials: "include",
            body: asking
          }),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
      })

      const policySaid = yield* textOf(answered)
      if (!answered.ok) {
        return yield* new GatewayError({
          reference,
          route,
          reason: refusedBy(answered),
          detail: reasonGiven(policySaid) ?? `HTTP ${answered.status}`
        })
      }

      const policy = yield* decodeUploadPolicy(parsed(policySaid)).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
          )
        )
      )

      const carrying = new FormData()
      for (const [key, value] of Object.entries(policy.form)) carrying.append(key, value)
      // Last, because their storage reads the fields before it reads the bytes.
      carrying.append("file", file)

      const stored = yield* Effect.tryPromise({
        try: () =>
          fetch(policy.upload_url, {
            method: "POST",
            headers: policy.header ?? {},
            // Their bucket, not theirs to be signed into. Cookies here are refused outright.
            credentials: "omit",
            body: carrying
          }),
        catch: (cause) =>
          new GatewayError({
            reference,
            route: policy.upload_url,
            reason: "unreachable",
            detail: String(cause)
          })
      })

      if (!stored.ok) {
        return yield* new GatewayError({
          reference,
          route: policy.upload_url,
          reason: "rejected",
          detail: `HTTP ${stored.status}`
        })
      }

      const telling = new FormData()
      telling.append("authenticity_token", policy.asset_upload_authenticity_token)

      const told = yield* Effect.tryPromise({
        try: () =>
          fetch(`https://github.com${policy.asset_upload_url}`, {
            method: "PUT",
            headers: { ...REQUIRED_HEADERS, "X-Fetch-Nonce": nonce.value },
            credentials: "include",
            body: telling
          }),
        catch: (cause) =>
          new GatewayError({
            reference,
            route: policy.asset_upload_url,
            reason: "unreachable",
            detail: String(cause)
          })
      })

      const toldSaid = yield* textOf(told)
      if (!told.ok) {
        return yield* new GatewayError({
          reference,
          route: policy.asset_upload_url,
          reason: refusedBy(told),
          detail: reasonGiven(toldSaid) ?? `HTTP ${told.status}`
        })
      }

      /*
       * The address off the first answer where the third says nothing readable. Both carry the
       * same one, and a file that is up and named nowhere would be the worst of the three
       * things that can happen here.
       */
      const asset = yield* decodeUploadedAsset(parsed(toldSaid)).pipe(
        Effect.catch(() => Effect.succeed(policy.asset))
      )

      return { name: file.name, href: asset.href } satisfies Uploaded
    }),

    /**
     * The row as it was last read, out of the one store the bar can read in a frame.
     *
     * `localStorage` rather than the store behind every other memory here, and the reason is
     * upstairs: the bar renders before a promise can answer, and a row landing after the
     * first paint is the flicker this read exists to remove. See `repoTabs.ts`.
     */
    rememberedTabs: Effect.fn("GitHubGateway.rememberedTabs")(function* (reference: RepoRef) {
      const found = yield* Effect.sync(() => keptTabs(reference))

      return found.length === 0 ? Option.none<ReadonlyArray<Tab>>() : Option.some(found)
    }),

    /**
     * Everything about a repository that is neither its files nor its README.
     *
     * One request for six sections, which is how GitHub serves it. Four
     * kilobytes, and it is asked for beside the commit column rather than before
     * the file list, so nothing on the page waits for it.
     */
    standing: Effect.fn("GitHubGateway.standing")(function* (reference: RepoRef) {
      const route = "/_sidebar"
      const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

      const response = yield* Effect.tryPromise({
        try: () => fetch(url, { headers: REQUIRED_HEADERS, credentials: "include" }),
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
        try: () => response.json(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
      })

      return yield* decodeSidebar(raw).pipe(
        Effect.map(standingFrom),
        Effect.catch(undecodableFrom(reference, route))
      )
    }),

    /**
     * Star a repository, or take the star back.
     *
     * Two plain routes of their own rather than the GraphQL a persisted mutation
     * would need. Recorded off their own button on a repository of ours: `POST
     * /owner/repo/star` and `POST /owner/repo/unstar`, no body at all, and the
     * nonce is the header that stands in for a CSRF token. Both were then read
     * back from the page to make sure the star really landed.
     *
     * Answers nothing. The reader is told by the button, which moved before this
     * was sent and moves back where it fails.
     */
    star: Effect.fn("GitHubGateway.star")(function* (reference: RepoRef, to: Starring) {
      const route = to === "starred" ? "/star" : "/unstar"
      const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

      const nonce = nonceOn(document)
      if (Option.isNone(nonce)) {
        return yield* new GatewayError({
          reference,
          route,
          reason: "rejected",
          detail: "no fetch-nonce on this page"
        })
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "POST",
            headers: { ...REQUIRED_HEADERS, ...VERIFIED, "X-Fetch-Nonce": nonce.value },
            credentials: "include"
          }),
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

      /*
       * The kept front still says the star is where it was, and the star is on
       * the front. Only the default branch's, which is the one a reader lands on
       * and the only one this knows the key for — a front kept for some other
       * branch keeps its old count until it is read again.
       */
      yield* forgetRoute(frontKey(reference, null))
    }),

    treeCommits: Effect.fn("GitHubGateway.treeCommits")(function* (
      reference: RepoRef,
      sha: string,
      folder = ""
    ) {
      const route =
        folder === ""
          ? `/tree-commit-info/${sha}`
          : `/tree-commit-info/${sha}/${folder.split("/").map(encodeURIComponent).join("/")}`
      const raw = yield* readRepoRoute(reference, route)

      // Not kept. A date is drawn identically whether it is a second or a day
      // old, and this arrives a quarter of a second after the rows it decorates,
      // so there is nothing for a stored copy to save.
      return yield* decodeTreeCommitInfo(raw).pipe(
        Effect.map((decoded) => touchesFrom(decoded, folder)),
        Effect.catch(undecodableFrom(reference, route))
      )
    }),

    whoTouched: Effect.fn("GitHubGateway.whoTouched")(function* (
      reference: RepoRef,
      sha: string
    ) {
      const route = `/latest-commit/${sha}`
      const raw = yield* readRepoRoute(reference, route)

      // Not kept, for the same reason the column is not: it decorates a row that
      // is already drawn, and the folder it belongs to is asked for again on the
      // next visit anyway.
      return yield* decodeLatestCommit(raw).pipe(
        Effect.map((decoded) => wroteIn(sha, decoded)),
        Effect.catch(undecodableFrom(reference, route))
      )
    }),

    /**
     * Every path in the repository, at one commit.
     *
     * The route their own file finder is built on, and the only one that answers
     * with the whole tree rather than one directory of it. It is the largest
     * thing this gateway asks for — seven thousand paths and six hundred
     * kilobytes on `react/react` — which is why the screen draws the root from
     * the page first and folds this in behind it.
     */
    /**
     * One file, for the pane where the README usually is.
     *
     * Their page for it rather than the raw host, and the extra weight buys one
     * field: their rendering of a markdown file, which the pane offers as a tab
     * beside the source. A caller that only wants the text wants
     * {@link rawFileAt} instead, which is a hundredth of this.
     */
    fileAt: Effect.fn("GitHubGateway.fileAt")(function* (
      reference: RepoRef,
      branch: string,
      path: string
    ) {
      const route = `/blob/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`
      const { payloads } = yield* readRepoPage(reference, route)

      return yield* openedFrom(payloads, path).pipe(
        Effect.catch(undecodableFrom(reference, route))
      )
    }),

    /**
     * One file's blame, for the screen `docs/spec/blame.md` describes.
     *
     * Their page for it rather than a route: the ranges, the commits and the
     * file's own lines are three of their payloads sitting in one document,
     * exactly as a blob's lines and rendering are, so one fetch answers all
     * of it.
     */
    blameAt: Effect.fn("GitHubGateway.blameAt")(function* (
      reference: RepoRef,
      branch: string,
      path: string
    ) {
      const route = `/blame/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`
      const { payloads } = yield* readRepoPage(reference, route)

      return yield* blamedFrom(payloads).pipe(Effect.catch(undecodableFrom(reference, route)))
    }),

    /**
     * One file as its own text, off their raw route.
     *
     * The route is on github.com and the answer is not: it redirects to the raw
     * host, which allows any origin to read it. That is the whole arrangement,
     * and it is the same one `log` above relies on. Credentials are left at
     * their default deliberately — the session goes to github.com, which needs
     * it to sign the redirect for a private repository, and is dropped at the
     * redirect, which refuses a request that carries one.
     *
     * A branch with a slash in it is written whole, as `fileAt` writes it. Their
     * route resolves the ambiguity between `feat/x` holding `README.md` and
     * `feat` holding `x/README.md` against the refs that exist.
     */
    rawFileAt: Effect.fn("GitHubGateway.rawFileAt")(function* (
      reference: RepoRef,
      branch: string,
      path: string
    ) {
      const route = `/raw/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`
      const url = `https://github.com/${reference.owner}/${reference.repo}${route}`

      const response = yield* Effect.tryPromise({
        try: () => fetch(url, { headers: { Accept: "text/plain" } }),
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
        try: () => response.text(),
        catch: (cause) =>
          new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
      })
    }),

    treePaths: Effect.fn("GitHubGateway.treePaths")(function* (
      reference: RepoRef,
      sha: string
    ) {
      const route = `/tree-list/${sha}`
      const raw = yield* readRepoRoute(reference, route)

      return yield* decodeTreeList(raw).pipe(
        Effect.map((list) => list.paths),
        Effect.catch(undecodableFrom(reference, route))
      )
    }),

    rememberedRepoHome: Effect.fn("GitHubGateway.rememberedRepoHome")(function* (
      reference: RepoRef,
      branch: string | null
    ) {
      const raw = yield* recallRoute(frontKey(reference, branch))
      if (Option.isNone(raw)) return Option.none<Front>()

      // Checked rather than trusted: the store outlives the code, and an entry
      // written before an update is the one shape that would reach the screen
      // and fail there.
      if (!isKeptFront(raw.value)) return Option.none<Front>()

      const front = frontFromKept(reference, raw.value)
      return branch === null || front.branch === branch ? Option.some(front) : Option.none()
    }),

    rememberedCommits: Effect.fn("GitHubGateway.rememberedCommits")(function* (
      list: CommitList
    ) {
      const raw = yield* recallRoute(pageKey(list))
      if (Option.isNone(raw)) return Option.none<History>()

      return yield* historyFrom(raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<History>()))
      )
    }),

    branchesOf: Effect.fn("GitHubGateway.branchesOf")(function* (reference: RepoRef) {
      const route = BRANCHES_ROUTE
      const raw = yield* readRepoRoute(reference, route)

      yield* Effect.forkDetach(rememberRoute(refsKey(reference), raw))

      return yield* branchesFrom(raw).pipe(Effect.catch(undecodableFrom(reference, route)))
    }),

    rememberedBranchesOf: Effect.fn("GitHubGateway.rememberedBranchesOf")(function* (
      reference: RepoRef
    ) {
      const raw = yield* recallRoute(refsKey(reference))
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<string>>()

      return yield* branchesFrom(raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<string>>()))
      )
    }),

    authorsOf: Effect.fn("GitHubGateway.authorsOf")(function* (reference: RepoRef) {
      const raw = yield* readRepoRoute(reference, AUTHORS_ROUTE)

      yield* Effect.forkDetach(rememberRoute(authorsKey(reference), raw))

      return yield* authorsFrom(raw).pipe(
        Effect.catch(undecodableFrom(reference, AUTHORS_ROUTE))
      )
    }),

    rememberedAuthorsOf: Effect.fn("GitHubGateway.rememberedAuthorsOf")(function* (
      reference: RepoRef
    ) {
      const raw = yield* recallRoute(authorsKey(reference))
      if (Option.isNone(raw)) return Option.none<ReadonlyArray<Participant>>()

      return yield* authorsFrom(raw.value).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<Participant>>()))
      )
    }),

    commitStat: Effect.fn("GitHubGateway.commitStat")(function* (
      reference: RepoRef,
      sha: string
    ) {
      const kept = yield* recallStats([sha])
      const known = kept.get(sha)
      if (known !== undefined) return Option.some(known)

      const diff = yield* diffTextAt(reference, `/commit/${sha}.diff`)
      if (Option.isNone(diff)) return Option.none<Stat>()

      const stat = statIn(diff.value)
      yield* Effect.forkDetach(rememberStat(sha, stat))

      return Option.some(stat)
    }),

    rememberedStats: (shas: ReadonlyArray<string>) => recallStats(shas),

    commitMarks: Effect.fn("GitHubGateway.commitMarks")(function* (
      reference: RepoRef,
      route: string
    ) {
      const raw = yield* readRepoRoute(reference, route)

      return yield* marksFrom(raw).pipe(Effect.catch(undecodableFrom(reference, route)))
    }),

    diffs: Effect.fn("GitHubGateway.diffs")(function* (
      reference: PullRequestRef,
      head: string,
      paths: ReadonlyArray<string>
    ) {
      const askFor = (wanted: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const route = diffEntriesRoute(head, wanted)
          const raw = yield* fetchRoute(reference, route)

          return yield* toDiffs(raw).pipe(
            Effect.catch((cause) =>
              Effect.fail(
                new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
              )
            )
          )
        })

      const answered = yield* askFor(paths)
      if (paths.length < 2) return answered

      /*
       * A batched answer is budgeted by bytes, and a file too big for what is
       * left of the budget comes back marked too big with no lines — while the
       * same file, asked for by itself, answers whole. Their own Files tab
       * re-asks exactly this way. Believing the starved answer wrote "binary,
       * or too large" over an 805-line Go file on a real pull request, and the
       * library remembers answers for good, so it stayed written. One more
       * question per starved file settles which of the two it is; a file that
       * is too big even alone comes back the same and keeps its message.
       */
      const starved = answered.filter((one) => one.diff.isTruncated && one.diff.lines.length === 0)
      if (starved.length === 0) return answered

      const whole = new Map<string, FetchedDiff>()
      for (const one of starved) {
        const alone = yield* askFor([one.path]).pipe(
          Effect.catch(() => Effect.succeed<ReadonlyArray<FetchedDiff>>([]))
        )
        for (const again of alone) whole.set(again.path, again)
      }

      return answered.map((one) => whole.get(one.path) ?? one)
    })
})

const parsed = UndefinedOr.liftThrowable(JSON.parse)

/**
 * The sentence out of GitHub's answer, when it left one.
 *
 * Under either of the two keys they use for it. The merge routes refuse under
 * `error` and the rest under `message`, and reading only the second turned
 * every refused merge into "HTTP 422" — the one place on this interface where
 * GitHub's own words are the whole of what the reader needs.
 */
const reasonGiven = (body: string): string | undefined => {
  const said = parsed(body) as { message?: unknown; error?: unknown } | undefined
  const sentence = said?.message ?? said?.error
  return typeof sentence === "string" && sentence.length > 0 ? sentence : undefined
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

/**
 * The same again for the inbox, which names no repository to blame.
 *
 * A {@link WorkingSetError} because that is what the read it stands in for fails with, and
 * the route is the press's own so that a test reading this knows which button was pressed.
 */
const noInboxHere = (route: string) =>
  new WorkingSetError({ route, reason: "not-recorded", detail: "No inbox is recorded here" })

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
    // A recording is the pull request's own routes, and the run behind a failing
    // check is not one of them. The checks stand as they were recorded.
    tolerated: (checks: ReadonlyArray<Check>) => Effect.succeed(checks),
    // Nothing was read before this test began. A test that wants to watch what
    // a remembered pull request does to the screen says so with a layer of its
    // own, which is what the seam is for.
    remembered: () => Effect.succeed(Option.none()),
    // A recording is one page as GitHub served it, and the files it held back
    // are exactly the ones no recording contains.
    diffs: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    commit: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    commitDiffs: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    commits: (list: CommitList) => Effect.fail(nothingRecordedFor(list.repo)),
    commitMarks: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedCommits: () => Effect.succeed(Option.none()),
    commitStat: () => Effect.succeed(Option.none()),
    rememberedStats: () => Effect.succeed(new Map()),
    branchesOf: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedBranchesOf: () => Effect.succeed(Option.none()),
    authorsOf: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedAuthorsOf: () => Effect.succeed(Option.none()),
    // A recording is the pull request's own routes, and the Checks tab is not
    // one of them: nothing was written against these checks here.
    notes: () => Effect.succeed([]),
    log: () => Effect.succeed([]),
    tail: () => Effect.succeed([]),
    steps: () => Effect.succeed([]),
    comment: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    settle: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    remark: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    review: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    merge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    mergeStack: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    makeStack: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    enqueue: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    dequeue: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    cancelAutoMerge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    updateBranch: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    close: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    reopen: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    markReady: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    toDraft: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    deleteBranch: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    // One pull request stood in for here, never the Participant's Working Set.
    // An empty shelf is what "nothing was listed" looks like, and a test that
    // wants a Working Set says so with a layer of its own.
    workingSet: () => Effect.succeed([]),
    // Nothing was read before this test began, here as above.
    rememberedShelf: () => Effect.succeed(Option.none()),
    // Nothing found, rather than a page of nothing: offline there is no repository
    // to have pull requests in.
    search: () => Effect.succeed({ rows: [], pages: Option.none() }),
    rememberedSearch: () => Effect.succeed(Option.none()),
    standingsFor: () => Effect.succeed(new Map() as Standings),
    // Nothing to stack against: a lone pull request has no siblings here, and a
    // row with no branches is a row drawn flat.
    branches: () => Effect.succeed(Option.none()),
    // No merge box behind a recording either. A test that wants a row's merge to
    // go somewhere says so with a layer of its own.
    howToMerge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    // No listing here to want sizes for. A failure rather than zero lines,
    // because a recording that cannot say is not a pull request that changes
    // nothing — and the lists already draw a row whose size never arrived.
    sizeOf: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    // Nothing was kept about any row, here as above.
    rememberedRows: () => Effect.succeed({ branches: new Map(), sizes: new Map() as Sizes, standings: new Map() as Standings }),

    // Nobody offline is anybody: the card is a live read and nothing here fakes one.
    portrait: () => Effect.succeed(Option.none<Portrait>()),
    contributions: () => Effect.succeed(Option.none<number>()),

    // None of these lists is about the pull request a test stood up here: no repositories,
    // nothing happening anywhere, no issues owed to anybody. A test that wants one says so
    // with a layer of its own.
    repositories: () => Effect.succeed([]),
    rememberedRepositories: () => Effect.succeed(Option.none()),
    activity: () => Effect.succeed([]),
    rememberedActivity: () => Effect.succeed(Option.none()),
    involvedIssues: () => Effect.succeed([]),
    rememberedInvolvedIssues: () => Effect.succeed(Option.none()),
    issue: (reference: IssueRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedIssue: () => Effect.succeed(Option.none()),
    issueSearch: () => Effect.succeed({ rows: [], pages: Option.none() }),
    rememberedIssueSearch: () => Effect.succeed(Option.none()),
    // Nothing is written from a recording. A raise that answered with a number
    // would be this layer inventing an issue nobody can open.
    raise: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    repoHome: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    star: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    standing: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    treePaths: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    fileAt: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    blameAt: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rawFileAt: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    treeCommits: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    whoTouched: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    // No run recorded, and a failure rather than an empty one: a run with no jobs
    // and no facts is not a run that did nothing, and the screen says so either way.
    run: (reference: RunRef) => Effect.fail(nothingRecordedFor(reference.repo)),
    rememberedCommit: () => Effect.succeed(Option.none()),
    tabs: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    suggesting: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    upload: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    reply: (reference: PullRequestRef) => Effect.fail(nothingRecordedFor(reference)),
    unsettle: (reference: PullRequestRef) => Effect.fail(nothingRecordedFor(reference)),
    settleIssue: (reference: IssueRef) => Effect.fail(nothingRecordedFor(reference)),
    sayOnIssue: (reference: IssueRef) => Effect.fail(nothingRecordedFor(reference)),
    reopenIssue: (reference: IssueRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedTabs: () => Effect.succeed(Option.none()),
    rememberedRun: () => Effect.succeed(Option.none()),
    rerunRun: (reference: RunRef) => Effect.fail(nothingRecordedFor(reference.repo)),
    cancelRun: (reference: RunRef) => Effect.fail(nothingRecordedFor(reference.repo)),
    strands: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedStrands: () => Effect.succeed(Option.none()),
    releases: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    builds: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedReleases: () => Effect.succeed(Option.none()),
    discussions: (list: DiscussionList) => Effect.fail(nothingRecordedFor(homeRef(list.home))),
    rememberedDiscussions: () => Effect.succeed(Option.none()),
    discussion: (reference: DiscussionRef) =>
      Effect.fail(nothingRecordedFor(homeRef(reference.home))),
    rememberedDiscussion: () => Effect.succeed(Option.none()),
    // An empty menu, which is what a reader who may do nothing is shown.
    discussionDoings: () => Effect.succeed([]),
    pressDiscussion: (reference: DiscussionRef) =>
      Effect.fail(nothingRecordedFor(homeRef(reference.home))),
    // An empty inbox, which is what a page nobody recorded looks like from here, and
    // nothing written to one: a press answered without a request would be this layer
    // telling a test that GitHub agreed to something nobody asked.
    notices: () => Effect.succeed([]),
    rememberedNotices: () => Effect.succeed(Option.none()),
    pressNotice: (press: Press) => Effect.fail(noInboxHere(press.route)),
    // An empty page with nothing behind it, for the same reason the inbox is empty
    // here: a list nobody recorded has no second page either.
    personRepositories: () => Effect.succeed({ rows: [], more: false }),
    person: () => Effect.succeed(Option.none()),
    rememberedPerson: () => Effect.succeed(Option.none()),
    rememberedRepoHome: () => Effect.succeed(Option.none())
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
    // A snapshot made by hand already says what its checks are. A test that
    // wants a tolerated failure writes one, rather than standing up a run page
    // for this to read it off.
    tolerated: (checks: ReadonlyArray<Check>) => Effect.succeed(checks),
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
    commits: (list: CommitList) => Effect.fail(nothingRecordedFor(list.repo)),
    commitMarks: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedCommits: () => Effect.succeed(Option.none()),
    commitStat: () => Effect.succeed(Option.none()),
    rememberedStats: () => Effect.succeed(new Map()),
    branchesOf: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedBranchesOf: () => Effect.succeed(Option.none()),
    authorsOf: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedAuthorsOf: () => Effect.succeed(Option.none()),
    notes: () => Effect.succeed([]),
    log: () => Effect.succeed([]),
    tail: () => Effect.succeed([]),
    steps: () => Effect.succeed([]),
    // Nothing to merge into: these snapshots are made up, and a test that wants
    // to watch a merge should say so with its own gateway.
    comment: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    settle: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    remark: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    review: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    merge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    mergeStack: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    makeStack: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    enqueue: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    dequeue: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    cancelAutoMerge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    updateBranch: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    close: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    reopen: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    markReady: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    toDraft: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    deleteBranch: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    // One pull request stood in for here, never the Participant's Working Set.
    // An empty shelf is what "nothing was listed" looks like, and a test that
    // wants a Working Set says so with a layer of its own.
    workingSet: () => Effect.succeed([]),
    // Nothing was read before this test began, here as above.
    rememberedShelf: () => Effect.succeed(Option.none()),
    // Nothing found, rather than a page of nothing: offline there is no repository
    // to have pull requests in.
    search: () => Effect.succeed({ rows: [], pages: Option.none() }),
    rememberedSearch: () => Effect.succeed(Option.none()),
    standingsFor: () => Effect.succeed(new Map() as Standings),
    // Nothing to stack against: a lone pull request has no siblings here, and a
    // row with no branches is a row drawn flat.
    branches: () => Effect.succeed(Option.none()),
    // A hand-built snapshot carries no merge box to read this out of.
    howToMerge: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    // As above: nothing is listed here, so nothing here has a size.
    sizeOf: (reference: PullRequestRef) => Effect.fail(notRecorded(reference)),
    // Nothing was kept about any row, here as above.
    rememberedRows: () => Effect.succeed({ branches: new Map(), sizes: new Map() as Sizes, standings: new Map() as Standings }),

    // Nobody offline is anybody: the card is a live read and nothing here fakes one.
    portrait: () => Effect.succeed(Option.none<Portrait>()),
    contributions: () => Effect.succeed(Option.none<number>()),

    // None of these lists is about the pull request a test stood up here: no repositories,
    // nothing happening anywhere, no issues owed to anybody. A test that wants one says so
    // with a layer of its own.
    repositories: () => Effect.succeed([]),
    rememberedRepositories: () => Effect.succeed(Option.none()),
    activity: () => Effect.succeed([]),
    rememberedActivity: () => Effect.succeed(Option.none()),
    involvedIssues: () => Effect.succeed([]),
    rememberedInvolvedIssues: () => Effect.succeed(Option.none()),
    issue: (reference: IssueRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedIssue: () => Effect.succeed(Option.none()),
    issueSearch: () => Effect.succeed({ rows: [], pages: Option.none() }),
    rememberedIssueSearch: () => Effect.succeed(Option.none()),
    // Nothing is written from a recording. A raise that answered with a number
    // would be this layer inventing an issue nobody can open.
    raise: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    repoHome: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    star: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    standing: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    treePaths: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    fileAt: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    blameAt: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rawFileAt: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    treeCommits: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    whoTouched: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    // No run recorded, and a failure rather than an empty one: a run with no jobs
    // and no facts is not a run that did nothing, and the screen says so either way.
    run: (reference: RunRef) => Effect.fail(nothingRecordedFor(reference.repo)),
    rememberedCommit: () => Effect.succeed(Option.none()),
    tabs: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    suggesting: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    upload: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    reply: (reference: PullRequestRef) => Effect.fail(nothingRecordedFor(reference)),
    unsettle: (reference: PullRequestRef) => Effect.fail(nothingRecordedFor(reference)),
    settleIssue: (reference: IssueRef) => Effect.fail(nothingRecordedFor(reference)),
    sayOnIssue: (reference: IssueRef) => Effect.fail(nothingRecordedFor(reference)),
    reopenIssue: (reference: IssueRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedTabs: () => Effect.succeed(Option.none()),
    rememberedRun: () => Effect.succeed(Option.none()),
    rerunRun: (reference: RunRef) => Effect.fail(nothingRecordedFor(reference.repo)),
    cancelRun: (reference: RunRef) => Effect.fail(nothingRecordedFor(reference.repo)),
    strands: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedStrands: () => Effect.succeed(Option.none()),
    releases: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    builds: (reference: RepoRef) => Effect.fail(nothingRecordedFor(reference)),
    rememberedReleases: () => Effect.succeed(Option.none()),
    discussions: (list: DiscussionList) => Effect.fail(nothingRecordedFor(homeRef(list.home))),
    rememberedDiscussions: () => Effect.succeed(Option.none()),
    discussion: (reference: DiscussionRef) =>
      Effect.fail(nothingRecordedFor(homeRef(reference.home))),
    rememberedDiscussion: () => Effect.succeed(Option.none()),
    // An empty menu, which is what a reader who may do nothing is shown.
    discussionDoings: () => Effect.succeed([]),
    pressDiscussion: (reference: DiscussionRef) =>
      Effect.fail(nothingRecordedFor(homeRef(reference.home))),
    // An empty inbox, which is what a page nobody recorded looks like from here, and
    // nothing written to one: a press answered without a request would be this layer
    // telling a test that GitHub agreed to something nobody asked.
    notices: () => Effect.succeed([]),
    rememberedNotices: () => Effect.succeed(Option.none()),
    pressNotice: (press: Press) => Effect.fail(noInboxHere(press.route)),
    // An empty page with nothing behind it, for the same reason the inbox is empty
    // here: a list nobody recorded has no second page either.
    personRepositories: () => Effect.succeed({ rows: [], more: false }),
    person: () => Effect.succeed(Option.none()),
    rememberedPerson: () => Effect.succeed(Option.none()),
    rememberedRepoHome: () => Effect.succeed(Option.none())
  })
