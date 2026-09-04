import { Effect } from "effect"
import type { WorkingSetRow } from "../shared/wire"
import { graphRead } from "./api"

/**
 * The whole Working Set, in one request.
 *
 * The extension makes six — one per shelf — because GitHub's dashboard has a
 * `filter` argument and answers each separately. The documented API has no such
 * argument, so this asks four searches at once and works out the shelves
 * afterwards, which turns out to be fewer requests rather than more: a row from
 * a search can carry its own check rollup, its review decision, its line counts
 * and its branches, all of which cost the extension a second, third and fourth
 * read.
 *
 * Four searches and not one, because `involves:@me` does not mean what it
 * sounds like: GitHub define it as author, assignee, mentions or commenter, and
 * a review somebody asked of you is none of those. So the buckets are asked for
 * separately and folded together here, and two of them overlap on purpose —
 * `review-requested:@me` matches a pull request asked of the reader *or* of a
 * team they are on, while `user-review-requested:@me` matches only the reader.
 * A row in the first and not the second is therefore a team's to pick up, which
 * is how this tells the two shelves apart without asking GitHub for the reader's
 * organisations, and so without asking anybody for `read:org`.
 */

/**
 * Everything a row needs, asked for once and reused by all four searches.
 *
 * `contexts` is the expensive part and there is no cheaper way to it: GitHub
 * report the rollup's overall state but no count of what passed, so the passing
 * ones have to be counted here. A hundred is where that stops — a pull request
 * with more than a hundred checks will have its total right and its tally short,
 * which is a wrong number in a place that already says "of".
 */
const ROW = `
  fragment row on PullRequest {
    databaseId
    number
    title
    createdAt
    updatedAt
    isDraft
    state
    isReadByViewer
    headRefOid
    baseRefName
    headRefName
    additions
    deletions
    viewerDidAuthor
    repository { name owner { login } }
    author { login __typename avatarUrl }
    comments { totalCount }
    labels(first: 1) { totalCount }
    assignees(first: 1) { totalCount }
    reviewDecision
    mergeQueueEntry { state }
    commits(last: 1) {
      nodes {
        commit {
          statusCheckRollup {
            state
            contexts(first: 100) {
              totalCount
              nodes {
                __typename
                ... on CheckRun { conclusion }
                ... on StatusContext { state }
              }
            }
          }
        }
      }
    }
  }
`

/**
 * `sort:updated` and a cap of fifty per bucket.
 *
 * A Working Set is a list somebody is going to work through, and a person with
 * more than fifty pull requests waiting on them in one bucket has a problem this
 * app cannot fix. Sorting by last touched means the fifty it keeps are the fifty
 * that moved most recently rather than fifty arbitrary ones.
 */
const BUCKETS = {
  mine: "is:open is:pr author:@me archived:false sort:updated",
  direct: "is:open is:pr user-review-requested:@me archived:false sort:updated",
  asked: "is:open is:pr review-requested:@me archived:false sort:updated",
  involved: "is:open is:pr involves:@me archived:false sort:updated"
} as const

type Bucket = keyof typeof BUCKETS

/**
 * One search, as its own request.
 *
 * Four searches in one document is the tidier query and the slower read: GitHub
 * answer the fields of one request in series, so the four waits add up. Timed
 * against a real account, one request with all four took 5.2 to 7.1 seconds and
 * the same four sent at once took 4.2 to 4.8 — the slowest of them rather than
 * the sum. `desktop/scripts/time-working-set.ts` is that measurement, kept so the
 * next person does not have to take this on trust.
 *
 * What is left is GitHub's search itself, which cannot be hurried: the cheapest
 * of the four still takes 1.3 seconds, and dropping the check tally — the one
 * field the search index cannot answer — saves about one second of four. So the
 * wait is not removed here. It is removed by not being waited on: the window
 * draws the last answer it kept while this one is in the air.
 */
const searchFor = (bucket: Bucket) => `
  query ${bucket} {
    found: search(query: ${JSON.stringify(BUCKETS[bucket])}, type: ISSUE, first: 50) {
      nodes { ...row }
    }
  }
  ${ROW}
`

type Context =
  | { readonly __typename: "CheckRun"; readonly conclusion: string | null }
  | { readonly __typename: "StatusContext"; readonly state: string }
  | { readonly __typename: string }

type Node = {
  readonly databaseId: number | null
  readonly number: number
  readonly title: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly isDraft: boolean
  readonly state: "OPEN" | "CLOSED" | "MERGED"
  readonly isReadByViewer: boolean | null
  readonly headRefOid: string
  readonly baseRefName: string
  readonly headRefName: string
  readonly additions: number
  readonly deletions: number
  readonly viewerDidAuthor: boolean
  readonly repository: { readonly name: string; readonly owner: { readonly login: string } }
  readonly author: { readonly login: string; readonly __typename: string; readonly avatarUrl: string } | null
  readonly comments: { readonly totalCount: number }
  readonly labels: { readonly totalCount: number } | null
  readonly assignees: { readonly totalCount: number }
  readonly reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null
  readonly mergeQueueEntry: { readonly state: string } | null
  readonly commits: {
    readonly nodes: ReadonlyArray<{
      readonly commit: {
        readonly statusCheckRollup: {
          readonly state: string
          readonly contexts: { readonly totalCount: number; readonly nodes: ReadonlyArray<Context> }
        } | null
      }
    }>
  }
}

type Found = { readonly found: { readonly nodes: ReadonlyArray<Node | null> } }

/** A check that came good, counting the two conclusions that are not a pass but are not a problem. */
const passed = (context: Context): boolean => {
  if (context.__typename === "CheckRun") {
    const { conclusion } = context as { readonly conclusion: string | null }
    return conclusion === "SUCCESS" || conclusion === "NEUTRAL" || conclusion === "SKIPPED"
  }
  if (context.__typename === "StatusContext") {
    return (context as { readonly state: string }).state === "SUCCESS"
  }
  return false
}

/**
 * The rollup, narrowed to the three states a row has room to draw.
 *
 * GitHub's `ERROR` and `EXPECTED` both mean a run that has not come good, and a
 * row cannot say more than "failing" about either.
 */
const rollupOf = (node: Node): WorkingSetRow["checks"] => {
  const rollup = node.commits.nodes[0]?.commit.statusCheckRollup
  if (rollup === null || rollup === undefined) return null

  const total = rollup.contexts.totalCount
  if (total === 0) return null

  const state =
    rollup.state === "SUCCESS"
      ? "passing"
      : rollup.state === "PENDING"
        ? "running"
        : "failing"

  return { state, total, passed: rollup.contexts.nodes.filter(passed).length }
}

const reviewedAs = (decision: Node["reviewDecision"]): WorkingSetRow["reviewed"] => {
  if (decision === "APPROVED") return "approved"
  if (decision === "CHANGES_REQUESTED") return "changes-requested"
  if (decision === "REVIEW_REQUIRED") return "review-required"
  return null
}

const rowFrom = (
  node: Node,
  asked: { readonly askedOfViewer: boolean; readonly askedOfTeam: boolean }
): WorkingSetRow => ({
  // A pull request with no `databaseId` cannot be keyed, and GitHub only omits
  // it for things the token may not see. The caller drops those.
  id: String(node.databaseId ?? 0),
  owner: node.repository.owner.login,
  repo: node.repository.name,
  number: node.number,
  title: node.title,
  authorLogin: node.author?.login ?? "ghost",
  authorIsBot: node.author?.__typename === "Bot",
  authorFaceUrl: node.author?.avatarUrl ?? null,
  state: node.isDraft
    ? "draft"
    : node.state === "MERGED"
      ? "merged"
      : node.state === "CLOSED"
        ? "closed"
        : "open",
  // Null on a pull request GitHub will not say about, which is not the same as
  // unread — an unknown is treated as read so it does not shout for no reason.
  readByViewer: node.isReadByViewer ?? true,
  comments: node.comments.totalCount,
  labels: node.labels?.totalCount ?? 0,
  assignees: node.assignees.totalCount,
  openedAt: node.createdAt,
  changedAt: node.updatedAt,
  headSha: node.headRefOid,
  added: node.additions,
  deleted: node.deletions,
  baseBranch: node.baseRefName,
  headBranch: node.headRefName,
  checks: rollupOf(node),
  reviewed: reviewedAs(node.reviewDecision),
  viewerIsAuthor: node.viewerDidAuthor,
  askedOfViewer: asked.askedOfViewer,
  askedOfTeam: asked.askedOfTeam,
  inMergeQueue: node.mergeQueueEntry !== null
})

export const readWorkingSet = Effect.fn("readWorkingSet")(function* (token: string) {
  // Four requests in the air together, so the reader waits out the slowest rather
  // than the sum. Ordered afterwards by the names below, not by which landed first.
  const found = yield* Effect.all(
    {
      mine: graphRead<Found>(token, searchFor("mine")),
      direct: graphRead<Found>(token, searchFor("direct")),
      asked: graphRead<Found>(token, searchFor("asked")),
      involved: graphRead<Found>(token, searchFor("involved"))
    },
    { concurrency: "unbounded" }
  )

  const real = (nodes: ReadonlyArray<Node | null>) =>
    nodes.filter((one): one is Node => one !== null && one.databaseId !== null)

  const direct = new Set(real(found.direct.found.nodes).map((one) => one.databaseId))
  const anyone = new Set(real(found.asked.found.nodes).map((one) => one.databaseId))

  /*
   * Folded by id, and later buckets do not overwrite earlier ones.
   *
   * The same pull request arrives in up to four of them with identical fields,
   * so which copy wins does not matter — but it arrives *at all* in a bucket
   * only because of how it got there, and that is what the two sets above keep.
   */
  const byId = new Map<number, WorkingSetRow>()

  for (const bucket of [found.mine, found.direct, found.asked, found.involved]) {
    for (const node of real(bucket.found.nodes)) {
      const id = node.databaseId as number
      if (byId.has(id)) continue
      byId.set(
        id,
        rowFrom(node, {
          askedOfViewer: direct.has(id),
          askedOfTeam: anyone.has(id) && !direct.has(id)
        })
      )
    }
  }

  return [...byId.values()]
})

type SearchAnswer = {
  readonly search: {
    readonly issueCount: number
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null }
    readonly nodes: ReadonlyArray<Node | null>
  }
}

const SEARCH = `
  ${ROW}
  query PullSearch($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: 25, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes { ...row }
    }
  }
`

/**
 * One page of pull-request search, twenty-five at a time.
 *
 * The same row fragment the Working Set uses, so a search result can sit in the
 * same Court a shelf row can. No involvement is known, so neither review flag
 * is set — the Court is concluded from author, draft and queue alone.
 */
export const searchPullRequests = Effect.fn("searchPullRequests")(function* (
  token: string,
  query: string,
  page: number
) {
  let after: string | null = null
  let last = { rows: [] as ReadonlyArray<WorkingSetRow>, current: page, total: 1, count: 0 }

  for (let at = 1; at <= page; at += 1) {
    const vars: { readonly query: string; readonly after: string | null } = {
      query: `${query} is:pr`,
      after
    }
    const answer: SearchAnswer = yield* graphRead<SearchAnswer>(token, SEARCH, vars)
    const rows = answer.search.nodes.flatMap((one) =>
      one !== null && one.databaseId !== null
        ? [rowFrom(one, { askedOfViewer: false, askedOfTeam: false })]
        : []
    )
    const count = answer.search.issueCount
    last = {
      rows,
      current: at,
      total: Math.max(1, Math.ceil(count / 25)),
      count
    }
    if (at === page) return last
    if (!answer.search.pageInfo.hasNextPage || answer.search.pageInfo.endCursor === null) {
      return { ...last, rows: [] }
    }
    after = answer.search.pageInfo.endCursor
  }

  return last
})
