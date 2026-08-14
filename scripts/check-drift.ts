#!/usr/bin/env bun
import { Effect, Option, Schema } from "effect"
import { existsSync, readFileSync } from "node:fs"
import { SHELVES } from "../src/domain/workingSet"
import { embeddedPayload } from "../src/github/embedded"
import { preloadedIn } from "../src/github/preloaded"
import { whereverItIs } from "../src/github/wherever"
import {
  BlobRoute,
  ChangesRoute,
  CommitDiffsRoute,
  CommitAnswer,
  CommitsAnswer,
  ContributorsRoute,
  DeferredCommitsRoute,
  DeferredRoute,
  DescriptionRoute,
  DiffEntriesRoute,
  DiffstatRoute,
  FilteredRepositories,
  HeaderRoute,
  IssueCommentsRoute,
  IssueSearchAnswer,
  IssueViewRoute,
  Mentionable,
  MergeBoxRoute,
  PreviewStackRoute,
  PublicEvents,
  QueryRoute,
  Referable,
  RefsRoute,
  RepoHomeRoute,
  ShelfRoute,
  SidebarRoute,
  StatusChecksRoute,
  TreeCommitInfoRoute,
  TreeListRoute,
  whyItWouldNotDecode
} from "../src/github/wire"

/**
 * Re-fetches the routes the gateway depends on from live GitHub and decodes
 * them with the same schemas production uses. A shape change fails here rather
 * than reaching a Participant as a broken page.
 *
 * Every schema in `wire.ts` that decodes a read is asked for here, which is the
 * whole value of the check and was not true until 2026-08-14: it covered five
 * routes out of thirty-four schemas, and all five were on one pull request. On
 * the morning `/search?type=issues` moved its entire answer into
 * `payload.blackbirdSearchRoute`, blanking both issue screens, running this
 * printed five `ok` lines and said nothing. A schema this cannot ask for is named
 * in {@link WRITES} with the reason, so the surface is accounted for rather than
 * partly remembered.
 *
 * Reads over the wire with GITHUB_SESSION_COOKIE, because these routes
 * authenticate with a browser session. Or reads a capture a browser took, with
 * `DRIFT_FROM=<directory>`, which is the same decode against the same schemas and
 * asks for no credential at all: `capture-drift.mjs` fetches the routes from inside
 * a logged-in page, where the session is already. See fixtures/README.md for both,
 * and for why this runs on demand rather than on every CI run.
 */

/** A directory of bodies a browser fetched, or nothing to read live. */
const captured = process.env["DRIFT_FROM"]

const cookie = process.env["GITHUB_SESSION_COOKIE"] ?? ""
if (captured === undefined && cookie.length === 0) {
  console.error("GITHUB_SESSION_COOKIE is not set, and DRIFT_FROM names no capture.")
  console.error("See fixtures/README.md.")
  process.exit(2)
}

/** What a capture calls the file it kept a route's answer in. */
const slug = (name: string): string => name.replace(/[^a-z0-9]+/gi, "-")

/** What the capture recorded about each route, beside the bodies. */
const recorded: Record<string, { readonly status: number; readonly why?: string }> =
  captured === undefined
    ? {}
    : JSON.parse(readFileSync(`${captured}/index.json`, "utf8"))

/**
 * What the routes are asked about.
 *
 * Public and large, so the check answers for anybody who runs it, and overridable
 * one by one, because a target eventually dies and the check should outlive it.
 *
 * The commit is pinned rather than taken off the top of the branch, and pinned to
 * a large one: GitHub embeds nine of its nineteen files and holds the rest back,
 * and a commit that arrives whole leaves their `/diffs` route with nothing to
 * answer. The issue is a number that really is an issue: `facebook/react#2` is a
 * pull request, and their `/issues/2` serves the pull request page, which carries
 * none of the queries an issue page does.
 */
const pullRequest = process.env["DRIFT_PULL_REQUEST"] ?? "microsoft/vscode/pull/327442"
const repository = process.env["DRIFT_REPOSITORY"] ?? "microsoft/vscode"
const commit = process.env["DRIFT_COMMIT"] ?? "64b605d39db1f483fc95468f00cdc49e72f8d7bb"
const branch = process.env["DRIFT_BRANCH"] ?? "main"
const file = process.env["DRIFT_FILE"] ?? "README.md"
const issue = process.env["DRIFT_ISSUE"] ?? "microsoft/vscode/issues/1000"
const issueQuery = process.env["DRIFT_ISSUE_QUERY"] ?? "repo:microsoft/vscode is:issue is:open"
const pullQuery = process.env["DRIFT_PULL_QUERY"] ?? "repo:microsoft/vscode is:pr is:open"
/** Somebody whose feed is busy: their received events are what Activity reads. */
const login = process.env["DRIFT_ACTIVITY_LOGIN"] ?? "gaearon"

const PULL = `https://github.com/${pullRequest}`
const REPO = `https://github.com/${repository}`

/**
 * What one read answered, with a refusal kept apart from a shape change.
 *
 * A 404 means the target has been deleted and a 400 means the route was asked
 * wrongly. Neither is GitHub changing shape, and reporting them as drift is how a
 * reader learns to stop reading this.
 */
type Answer =
  | { readonly said: "payload"; readonly payload: unknown }
  | { readonly said: "refused"; readonly status: number }
  | { readonly said: "nothing"; readonly why: string }

const asPayload = (body: string): Answer =>
  Option.match(Option.liftThrowable(JSON.parse)(body), {
    onNone: (): Answer => ({ said: "nothing", why: "the body is not JSON" }),
    onSome: (payload): Answer => ({ said: "payload", payload })
  })

/**
 * A body, from the wire or from a capture, read the way production reads it.
 *
 * The two roads meet here so that a capture is decoded by the same code as a live
 * read: the headers are what GitHub is asked with, and the reading is what turns the
 * answer into a payload, and only the first of the two is about the network.
 */
const asking =
  (headers: Record<string, string>, reading: (body: string) => Answer) =>
  async (url: string, name: string): Promise<Answer> => {
    if (captured !== undefined) {
      const at = `${captured}/${slug(name)}.body`
      const kept = recorded[slug(name)]
      if (kept !== undefined && kept.status !== 200) {
        return kept.status === 0
          ? { said: "nothing", why: kept.why ?? "the capture skipped it" }
          : { said: "refused", status: kept.status }
      }
      if (!existsSync(at)) return { said: "nothing", why: "the capture holds no answer for it" }

      return reading(readFileSync(at, "utf8"))
    }

    const response = await fetch(url, { headers })

    return response.ok ? reading(await response.text()) : { said: "refused", status: response.status }
  }

/** GitHub answers 406 to these routes without the XMLHttpRequest header. */
const asJson = asking(
  { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookie },
  asPayload
)

/**
 * The repository filter, which takes a different pair of headers from everything
 * else here and is asked for with the pair `askedWithoutXhr` sends.
 *
 * Both halves of that pair are load-bearing: measured on 2026-08-14, the route
 * answers 400 with an empty body to `Content-Type: application/json` alone and 200
 * to the two together.
 */
const asFiltered = asking(
  { Accept: "application/json", "Content-Type": "application/json", Cookie: cookie },
  asPayload
)

/**
 * A payload out of a page of theirs rather than out of a route of theirs.
 *
 * The two code view reads are documents for the reason `readRepoPage` gives:
 * `Accept: application/json` answers with the route alone and never with the
 * layout around it. Asked for the same way here, script tag and all, because a
 * check that read the lighter answer would be checking a shape production never
 * sees.
 */
const asPage = (naming: string) =>
  asking({ Accept: "text/html", Cookie: cookie }, (body) =>
    Option.match(embeddedPayload(body, naming), {
      onNone: (): Answer => ({ said: "nothing", why: `no ${naming} embedded in the page` }),
      onSome: (payload): Answer => ({ said: "payload", payload })
    })
  )

/**
 * The answer GitHub wrote into an issue's own page.
 *
 * Their `/_graphql` route will not answer an issue by name alone: it wants a hash
 * GitHub mints per deploy, which `persisted.ts` reads off their own traffic in a
 * browser and nothing in a shell can know. The same result is in the served page
 * under `preloadedQueries`, which is the way in the gateway falls back to, so the
 * schema is checked against the payload that arrives rather than not at all.
 */
const asPreloaded = (query: string) =>
  asking({ Cookie: cookie }, (body) =>
    Option.match(preloadedIn(body, query), {
      onNone: (): Answer => ({ said: "nothing", why: `no ${query} preloaded in the page` }),
      onSome: (found): Answer => ({ said: "payload", payload: found.result })
    })
  )

/** Their public events, with the cookies left off as the gateway leaves them off. */
const asPublic = asking({ Accept: "application/json" }, asPayload)

type Check = {
  readonly name: string
  /** Nothing where the route this one is asked with did not answer. */
  readonly url: () => string | undefined
  readonly ask: (url: string, name: string) => Promise<Answer>
  /** Decodes the answer, and says what was in it. */
  readonly read: (payload: unknown) => Effect.Effect<string, unknown>
}

const checking = <A>(check: {
  readonly name: string
  readonly url: () => string | undefined
  readonly ask?: (url: string, name: string) => Promise<Answer>
  readonly schema: Schema.ConstraintCodec<A, unknown>
  /** Where a route below takes the address it can only be asked with. */
  readonly learn?: (answered: A) => void
  /**
   * How much the answer held, for the routes that can legitimately answer with
   * nothing: a shelf nobody has put anything on decodes whatever shape it is, so
   * an `ok` on an empty list is worth less than an `ok` on twenty rows and should
   * not read the same.
   */
  readonly note?: (answered: A) => string
}): Check => ({
  name: check.name,
  url: check.url,
  ask: check.ask ?? asJson,
  // Through the finder, so a payload GitHub has re-parented reads here as it reads in
  // production: the schema says what the answer is and not where it was put.
  read: (payload) =>
    Effect.map(whereverItIs(check.schema)(payload), (answered) => {
      check.learn?.(answered)
      return check.note?.(answered) ?? ""
    })
})

/**
 * The addresses no default can hold, because each is in the answer before it.
 *
 * A held-back diff is asked for by the paths and the head commit the changes route
 * names, the deferred marks of a commit list by the address that list carries, the
 * rest of a commit's files by the cursor its own page ends at, and the standing of
 * listed pull requests by GitHub's numeric ids for the rows just sent. Their own
 * pages read them in this order, which is why the table below is ordered rather
 * than sorted.
 */
let heldBackDiffs: string | undefined
let extraCommitDiffs: string | undefined
let deferredCommits: string | undefined
let deferredRows: string | undefined
let head: string | undefined

/**
 * Their Files tab's route for the diffs a pull request did not carry, spelled as
 * `diffEntriesRoute` spells it: the paths are encoded twice, so a path with a
 * comma in it survives being put in a comma-separated list.
 */
const diffEntriesQuery = (headOid: string, paths: ReadonlyArray<string>): string => {
  const list = paths.map((path) => encodeURIComponent(path)).join(",")
  return `${PULL}/page_data/diff_entries?paths=${encodeURIComponent(list)}&ctx=${encodeURIComponent(":::")}&w=0&range=${headOid}`
}

/** Their suggester takes the repository in two halves rather than as a path. */
const suggesting = (): string => {
  const [owner = "", name = ""] = repository.split("/")
  return `repository=${name}&user_id=${owner}`
}

const routes: ReadonlyArray<Check> = [
  checking({
    name: "changes",
    url: () => `${PULL}/changes`,
    schema: ChangesRoute,
    learn: (answered) => {
      const page = answered.payload.pullRequestsChangesRoute
      const carried = new Set(page.diffContents.map((diff) => diff.path))
      const held = page.diffSummaries.map((summary) => summary.path).filter((path) => !carried.has(path))
      // The first file where GitHub held none of them back. Their route answers for
      // any path the Files tab could ask about, and a pull request small enough to
      // arrive whole would otherwise leave this route unasked.
      const asked = held.length > 0 ? held : page.diffSummaries.slice(0, 1).map((one) => one.path)
      if (asked.length > 0) {
        heldBackDiffs = diffEntriesQuery(page.comparison.fullDiff.headOid, asked)
      }
    }
  }),
  checking({
    name: "diff_entries",
    url: () => heldBackDiffs,
    schema: DiffEntriesRoute,
    note: (answered) => `${answered.length} files`
  }),
  checking({
    name: "status_checks",
    url: () => `${PULL}/page_data/status_checks`,
    schema: StatusChecksRoute,
    note: (answered) => `${answered.statusChecks.length} checks`
  }),
  checking({
    name: "merge_box",
    url: () => `${PULL}/page_data/merge_box?merge_method=MERGE&bypass_requirements=false`,
    schema: MergeBoxRoute
  }),
  checking({ name: "header", url: () => `${PULL}/page_data/header`, schema: HeaderRoute }),
  checking({
    name: "issue_comments",
    url: () => `${PULL}/page_data/issue_comments`,
    schema: IssueCommentsRoute,
    note: (answered) => `${answered.length} comments`
  }),
  checking({
    name: "description",
    url: () => `${PULL}/page_data/description`,
    schema: DescriptionRoute
  }),
  checking({ name: "diffstat", url: () => `${PULL}/page_data/diffstat`, schema: DiffstatRoute }),
  checking({
    name: "preview_stack",
    url: () => `${PULL}/page_data/preview_stack`,
    schema: PreviewStackRoute,
    // Null is their answer where there is nothing to offer, and it is a 200. The
    // note says which of the two arrived, so a route that started answering null
    // for everything is visible rather than green.
    note: (answered) => (answered === null ? "nothing to stack" : `${answered.length} entries`)
  }),
  checking({
    name: "commit",
    url: () => `${REPO}/commit/${commit}?_pjax=%23repo-content-pjax-container`,
    schema: CommitAnswer,
    learn: (answered) => {
      const page = answered
      const from = page.asyncDiffLoadInfo
      if (from === undefined || from === null) return
      const { sha1, sha2 } = page.commit
      if (typeof sha1 !== "string" || typeof sha2 !== "string") return

      extraCommitDiffs =
        `${REPO}/diffs?commit=${page.commit.oid}&sha2=${sha2}&sha1=${sha1}` +
        `&start_entry=${from.startIndex}&bytes=${from.byteCount}&lines=${from.lineShownCount}`
    },
    note: (answered) => `${answered.diffEntryData.length} files`
  }),
  checking({
    name: "commit_diffs",
    url: () => extraCommitDiffs,
    schema: CommitDiffsRoute,
    note: (answered) => `${answered.extraDiffEntries.length} files`
  }),
  checking({
    name: "commits",
    url: () => `${REPO}/commits/${encodeURIComponent(branch)}`,
    schema: CommitsAnswer,
    learn: (answered) => {
      const deferred = answered.metadata?.deferredDataUrl
      if (typeof deferred !== "string") return

      // Their address carries the repository as well as the route, and the
      // repository asked about is the one on the address here. `commits.ts` drops
      // the owner and the name for the same reason.
      deferredCommits = `${REPO}${deferred.replace(/^\/[^/]+\/[^/]+/, "")}`
    },
    note: (answered) =>
      `${answered.commitGroups.reduce((all, one) => all + one.commits.length, 0)} commits`
  }),
  checking({
    name: "deferred_commits",
    url: () => deferredCommits,
    schema: DeferredCommitsRoute,
    note: (answered) => `${answered.deferredCommits.length} commits`
  }),
  checking({
    name: "branches",
    url: () => `${REPO}/refs?type=branch`,
    schema: RefsRoute,
    note: (answered) => `${answered.refs.length} branches`
  }),
  checking({
    name: "authors",
    url: () => `${REPO}/commits/deferred_commit_contributors`,
    schema: ContributorsRoute,
    note: (answered) => `${answered.authors.length} authors`
  }),
  checking({ name: "sidebar", url: () => `${REPO}/_sidebar`, schema: SidebarRoute }),
  checking({
    name: "repo_home",
    url: () => REPO,
    ask: asPage("codeViewRepoRoute"),
    schema: RepoHomeRoute,
    learn: (answered) => {
      head = answered.payload.codeViewRepoRoute.refInfo.currentOid
    },
    note: (answered) => `${answered.payload.codeViewRepoRoute.tree.items.length} entries`
  }),
  checking({
    name: "tree_list",
    url: () => (head === undefined ? undefined : `${REPO}/tree-list/${head}`),
    schema: TreeListRoute,
    note: (answered) => `${answered.paths.length} paths`
  }),
  checking({
    name: "tree_commit_info",
    url: () => (head === undefined ? undefined : `${REPO}/tree-commit-info/${head}`),
    schema: TreeCommitInfoRoute,
    note: (answered) => `${Object.keys(answered.entries).length} entries`
  }),
  checking({
    name: "blob",
    url: () => `${REPO}/blob/${encodeURIComponent(branch)}/${file.split("/").map(encodeURIComponent).join("/")}`,
    ask: asPage("codeViewBlobLayoutRoute.StyledBlob"),
    schema: BlobRoute,
    note: (answered) =>
      `${answered.payload["codeViewBlobLayoutRoute.StyledBlob"].rawLines?.length ?? 0} lines`
  }),
  // Every shelf, from the list the Working Set reads, so that a seventh one GitHub
  // adds is asked for here as soon as this codebase knows about it.
  ...SHELVES.map((shelf) =>
    checking({
      name: `shelf ${shelf}`,
      url: () => `https://github.com/pulls/inbox/queries?filter=${shelf}&max_pr_age=1m`,
      schema: ShelfRoute,
      note: (answered) => `${answered.payload.pullsInboxSurfaceContentRoute.results.length} rows`
    })
  ),
  checking({
    name: "pulls_query",
    url: () => `https://github.com/pulls?${new URLSearchParams({ q: pullQuery, page: "1" }).toString()}`,
    schema: QueryRoute,
    learn: (answered) => {
      // Nine, because nine is what their own dashboard asks about at a time.
      const ids = answered.payload.pullsDashboardSurfaceContentRoute.results
        .slice(0, 9)
        .map((row) => row.id)
      if (ids.length === 0) return

      deferredRows = `https://github.com/pulls/inbox/deferred?page=1&${ids.map((id) => `pr_ids%5B%5D=${id}`).join("&")}`
    },
    note: (answered) => `${answered.payload.pullsDashboardSurfaceContentRoute.results.length} rows`
  }),
  checking({
    name: "pulls_deferred",
    url: () => deferredRows,
    schema: DeferredRoute,
    note: (answered) =>
      `${answered.payload.pullsInboxSurfaceContentDeferredData.results.length} rows`
  }),
  checking({
    name: "repositories",
    url: () => "https://github.com/_filter/repositories?q=&filter_value=",
    ask: asFiltered,
    schema: FilteredRepositories,
    note: (answered) => `${answered.repositories.length} repositories`
  }),
  checking({
    name: "issue_search",
    url: () =>
      `https://github.com/search?${new URLSearchParams({ q: issueQuery, type: "issues", p: "1" }).toString()}`,
    schema: IssueSearchAnswer,
    note: (answered) => `${answered.results.length} rows`
  }),
  checking({
    name: "activity",
    url: () =>
      `https://api.github.com/users/${encodeURIComponent(login)}/received_events/public?per_page=100`,
    ask: asPublic,
    schema: PublicEvents,
    note: (answered) => `${answered.length} events`
  }),
  checking({
    name: "issue",
    url: () => `https://github.com/${issue}`,
    ask: asPreloaded("IssueViewerViewQuery"),
    schema: IssueViewRoute,
    note: (answered) =>
      `${answered.data.repository.issue.frontTimelineItems?.edges.length ?? 0} timeline items`
  }),
  checking({
    name: "mentionable",
    url: () => `https://github.com/suggestions/issue?mention_suggester=1&${suggesting()}`,
    schema: Mentionable,
    note: (answered) => `${answered.length} people`
  }),
  checking({
    name: "referable",
    url: () => `https://github.com/suggestions/issue?issue_suggester=1&${suggesting()}`,
    schema: Referable,
    note: (answered) => `${answered.suggestions.length} suggestions`
  })
]

/**
 * The schemas this cannot ask for, and why each one.
 *
 * All five decode the answer to a write. Asking for them means creating a comment
 * on somebody's pull request, opening an issue in somebody's repository, or putting
 * a file in GitHub's asset store, once per run. So they are named here rather than
 * quietly missing. What covers them is `contract.test.ts`, which decodes the
 * recordings of them on every CI run, and production, where a failed decode is a
 * typed error that names the field.
 */
const WRITES = [
  {
    name: "CreatedComment",
    why: "answers page_data/create_review_comment, which writes a review comment"
  },
  { name: "AddedComment", why: "answers their addComment mutation, which writes a comment" },
  { name: "CreatedIssueRoute", why: "answers their createIssue mutation, which opens an issue" },
  { name: "UploadPolicy", why: "answers upload/policies/assets, which reserves an asset" },
  { name: "UploadedAsset", why: "answers the request that hands GitHub the bytes" }
] as const

let drifted = 0
let unread = 0
let ok = 0

for (const route of routes) {
  const url = route.url()
  if (url === undefined) {
    console.error(`${route.name}: not asked, because the route it is asked with did not answer`)
    unread += 1
    continue
  }

  const answer = await route.ask(url, route.name)

  if (answer.said === "refused") {
    console.error(`${route.name}: HTTP ${answer.status} from ${url}`)
    unread += 1
    continue
  }

  if (answer.said === "nothing") {
    console.error(`${route.name}: ${answer.why}, at ${url}`)
    unread += 1
    continue
  }

  const outcome = await Effect.runPromise(Effect.result(route.read(answer.payload)))

  if (outcome._tag === "Failure") {
    console.error(`${route.name}: DRIFTED`)
    console.error(whyItWouldNotDecode(outcome.failure))
    drifted += 1
  } else {
    console.log(`${route.name}: ok${outcome.success === "" ? "" : ` (${outcome.success})`}`)
    ok += 1
  }
}

console.log("")
console.log(`${ok} ok, ${drifted} drifted, ${unread} not read, of ${routes.length} reads.`)
console.log(`${WRITES.length} schemas are not read here, because each answers a write:`)
for (const write of WRITES) console.log(`  ${write.name}: ${write.why}`)

/**
 * Drift and a check that could not ask, told apart.
 *
 * 1 is GitHub having changed shape, which is the news this exists for. 2 is this
 * check being unable to look: a target deleted, a route answering 404, a body that
 * is not JSON. That is the same kind of trouble as a missing cookie and exits the
 * same way, and it is not a report that anything is wrong with GitHub.
 */
process.exit(drifted > 0 ? 1 : unread > 0 ? 2 : 0)
