import { Effect } from "effect"
import type {
  Card,
  CardFacts,
  CheckFacts,
  CommitFacts,
  FaceFacts,
  FileFacts,
  MergeFacts,
  MergeWay,
  RemarkFacts,
  ReviewFacts,
  SaidFacts,
  ThreadFacts
} from "../shared/wire"
import { graphRead, restRead } from "./api"
import { waysToMerge } from "./write"

/**
 * One pull request, read from the documented API.
 *
 * Two requests, made together. GraphQL answers everything about the pull request
 * itself in one round trip — the description, the checks, the threads, the merge
 * state, who has approved — and REST answers the one thing GraphQL will not say
 * about a changed file: its blob sha, which is what Reviewed State expires
 * against, and its patch, which is the content itself.
 *
 * The extension gets all of this from six of GitHub's private routes, and gets
 * more of it: the individual branch rule that blocked a merge, the signed socket
 * channels that make the card update itself. Neither is documented and neither
 * has a public equivalent, so this reads what there is and the interface says
 * only what it was told.
 */

const FACE = `
  fragment face on Actor {
    login
    __typename
    avatarUrl
  }
`

const SAID = `
  fragment said on Comment {
    body
    bodyHTML
    createdAt
    author { ...face }
  }
`

const QUERY = `
  query Card($owner: String!, $repo: String!, $number: Int!) {
    viewer { login }
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        title
        body
        bodyHTML
        state
        isDraft
        createdAt
        closedAt
        mergedAt
        author { ...face }
        baseRefName
        headRefName
        headRefOid
        baseRefOid
        mergeable
        mergeStateStatus
        viewerCanMergeAsAdmin
        viewerCanUpdateBranch
        viewerCannotUpdateReasons
        viewerCanEnableAutoMerge
        viewerCanDisableAutoMerge
        isInMergeQueue
        viewerLatestReview { commit { oid } }
        autoMergeRequest { mergeMethod }
        mergeQueue { url }
        mergeQueueEntry { position }
        files(first: 100) {
          nodes { path viewerViewedState }
        }
        commits(first: 100) {
          nodes {
            commit {
              oid
              abbreviatedOid
              messageHeadline
              committedDate
              author { name user { login } }
            }
          }
        }
        latestOpinionatedReviews(first: 50) {
          nodes { state author { ...face } }
        }
        comments(first: 50) {
          nodes { id ...said }
        }
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            path
            line
            startLine
            originalLine
            originalStartLine
            diffSide
            comments(first: 50) { nodes { ...said } }
          }
        }
        rollup: commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      name
                      status
                      conclusion
                      title
                      summary
                      detailsUrl
                      startedAt
                      completedAt
                      isRequired(pullRequestNumber: $number)
                    }
                    ... on StatusContext {
                      context
                      state
                      description
                      targetUrl
                      createdAt
                      isRequired(pullRequestNumber: $number)
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  ${FACE}
  ${SAID}
`

type Actor = { readonly login: string; readonly __typename: string; readonly avatarUrl: string } | null

type Said = {
  readonly body: string
  readonly bodyHTML: string
  readonly createdAt: string
  readonly author: Actor
}

type Context =
  | {
      readonly __typename: "CheckRun"
      readonly name: string
      readonly status: string
      readonly conclusion: string | null
      readonly title: string | null
      readonly summary: string | null
      readonly detailsUrl: string | null
      readonly startedAt: string | null
      readonly completedAt: string | null
      readonly isRequired: boolean
    }
  | {
      readonly __typename: "StatusContext"
      readonly context: string
      readonly state: string
      readonly description: string | null
      readonly targetUrl: string | null
      readonly createdAt: string
      readonly isRequired: boolean
    }
  | { readonly __typename: string }

type Answer = {
  readonly viewer: { readonly login: string }
  readonly repository: {
    readonly pullRequest: {
      readonly title: string
      readonly body: string
      readonly bodyHTML: string
      readonly state: "OPEN" | "CLOSED" | "MERGED"
      readonly isDraft: boolean
      readonly createdAt: string | null
      readonly closedAt: string | null
      readonly mergedAt: string | null
      readonly author: Actor
      readonly baseRefName: string
      readonly headRefName: string
      readonly headRefOid: string
      readonly baseRefOid: string
      readonly mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN"
      readonly mergeStateStatus: string
      readonly viewerCanMergeAsAdmin: boolean
      readonly viewerCanUpdateBranch: boolean
      readonly viewerCannotUpdateReasons: ReadonlyArray<string>
      readonly viewerCanEnableAutoMerge: boolean
      readonly viewerCanDisableAutoMerge: boolean
      readonly isInMergeQueue: boolean
      readonly viewerLatestReview: { readonly commit: { readonly oid: string } | null } | null
      readonly autoMergeRequest: { readonly mergeMethod: string | null } | null
      readonly mergeQueue: { readonly url: string | null } | null
      readonly mergeQueueEntry: { readonly position: number | null } | null
      readonly files: {
        readonly nodes: ReadonlyArray<{ readonly path: string; readonly viewerViewedState: string } | null>
      }
      readonly commits: {
        readonly nodes: ReadonlyArray<{
          readonly commit: {
            readonly oid: string
            readonly abbreviatedOid: string
            readonly messageHeadline: string
            readonly committedDate: string
            readonly author: { readonly name: string | null; readonly user: { readonly login: string } | null } | null
          }
        } | null>
      }
      readonly latestOpinionatedReviews: {
        readonly nodes: ReadonlyArray<{ readonly state: string; readonly author: Actor } | null>
      }
      readonly comments: { readonly nodes: ReadonlyArray<(Said & { readonly id: string }) | null> }
      readonly reviewThreads: {
        readonly nodes: ReadonlyArray<{
          readonly id: string
          readonly isResolved: boolean
          readonly path: string
          readonly line: number | null
          readonly startLine: number | null
          readonly originalLine: number | null
          readonly originalStartLine: number | null
          readonly diffSide: "LEFT" | "RIGHT"
          readonly comments: { readonly nodes: ReadonlyArray<Said | null> }
        } | null>
      }
      readonly rollup: {
        readonly nodes: ReadonlyArray<{
          readonly commit: {
            readonly statusCheckRollup: {
              readonly contexts: { readonly nodes: ReadonlyArray<Context | null> }
            } | null
          }
        } | null>
      }
    } | null
  } | null
}

/** One file as REST describes it, which is the only place its sha and its patch are. */
type RestFile = {
  readonly filename: string
  readonly sha: string
  readonly status: string
  readonly additions: number
  readonly deletions: number
  readonly changes: number
  readonly patch?: string
}

const real = <A>(nodes: ReadonlyArray<A | null>): ReadonlyArray<A> =>
  nodes.filter((one): one is A => one !== null)

/**
 * A missing author is GitHub's `ghost`, which is what their own page draws.
 *
 * An account can be deleted after it has written things, and the things stay.
 */
const faceOf = (actor: Actor): FaceFacts => ({
  login: actor?.login ?? "ghost",
  isAutomated: actor?.__typename === "Bot",
  faceUrl: actor?.avatarUrl ?? null
})

const saidOf = (said: Said): SaidFacts => ({
  author: faceOf(said.author),
  body: said.body,
  html: said.bodyHTML,
  createdAt: said.createdAt
})

const CHANGES: Record<string, FileFacts["changeType"]> = {
  added: "added",
  modified: "modified",
  removed: "deleted",
  renamed: "renamed",
  copied: "copied",
  changed: "changed",
  unchanged: "changed"
}

/**
 * How many files come back with their content, and why it is not all of them.
 *
 * A pull request of two hundred files is two hundred patches, and every one of
 * them crosses a socket to a webview that will draw four. So the card carries
 * the first handful — the ones a reader is looking at a second later — and the
 * rest are asked for by path when a file is opened, which is the same bargain
 * GitHub's own page makes.
 */
const EMBEDDED = 10

const fileOf = (rest: RestFile, viewed: Map<string, string>, embed: boolean): FileFacts => {
  const patch = rest.patch ?? null

  /*
   * GitHub sends no patch for a file it will not diff, and does not say which kind
   * of will-not it is. A file with lines counted and no patch was held back for
   * being a large change; one with nothing counted has nothing to count, which is
   * what a binary file looks like from here.
   */
  const content: FileFacts["content"] =
    patch === null ? (rest.changes > 0 ? "withheld" : "binary") : embed ? "here" : "unasked"

  return {
    path: rest.filename,
    digest: rest.sha,
    changeType: CHANGES[rest.status] ?? "changed",
    linesAdded: rest.additions,
    linesDeleted: rest.deletions,
    readByViewer: viewed.get(rest.filename) === "VIEWED",
    content,
    patch: content === "here" ? patch : null
  }
}

const CHECK_CONCLUSIONS: Record<string, CheckFacts["state"]> = {
  SUCCESS: "succeeded",
  FAILURE: "failed",
  TIMED_OUT: "failed",
  ACTION_REQUIRED: "failed",
  STARTUP_FAILURE: "failed",
  STALE: "failed",
  CANCELLED: "cancelled",
  SKIPPED: "skipped",
  NEUTRAL: "neutral"
}

const STATUS_STATES: Record<string, CheckFacts["state"]> = {
  SUCCESS: "succeeded",
  FAILURE: "failed",
  ERROR: "failed",
  PENDING: "running",
  EXPECTED: "queued"
}

const seconds = (from: string | null, to: string | null): number => {
  if (from === null || to === null) return 0
  const took = (Date.parse(to) - Date.parse(from)) / 1000
  return Number.isFinite(took) && took > 0 ? Math.round(took) : 0
}

const checkOf = (context: Context): CheckFacts | null => {
  if (context.__typename === "CheckRun") {
    const run = context as Extract<Context, { readonly __typename: "CheckRun" }>
    const state =
      run.status === "COMPLETED"
        ? (CHECK_CONCLUSIONS[run.conclusion ?? ""] ?? "neutral")
        : run.status === "QUEUED" || run.status === "WAITING" || run.status === "PENDING"
          ? "queued"
          : "running"

    return {
      name: run.name,
      state,
      isRequired: run.isRequired,
      summary: run.title ?? run.summary ?? "",
      url: run.detailsUrl ?? "",
      durationSeconds: seconds(run.startedAt, run.completedAt)
    }
  }

  if (context.__typename === "StatusContext") {
    const status = context as Extract<Context, { readonly __typename: "StatusContext" }>
    return {
      name: status.context,
      state: STATUS_STATES[status.state] ?? "neutral",
      isRequired: status.isRequired,
      summary: status.description ?? "",
      url: status.targetUrl ?? "",
      durationSeconds: 0
    }
  }

  return null
}

const VERDICTS: Record<string, ReviewFacts["decision"]> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes-requested",
  COMMENTED: "commented",
  DISMISSED: "dismissed"
}

/**
 * Where a thread hangs, or nowhere.
 *
 * `line` is null once the lines it was written about have moved out of the diff,
 * and `originalLine` is where they were. Either will do for a reader looking for
 * the remark; neither being there means the thread is about code that is no
 * longer in the comparison at all, and the interface draws it in the
 * conversation instead of pointing at a line that is not there.
 */
const anchorOf = (thread: {
  readonly path: string
  readonly line: number | null
  readonly startLine: number | null
  readonly originalLine: number | null
  readonly originalStartLine: number | null
  readonly diffSide: "LEFT" | "RIGHT"
}): ThreadFacts["at"] => {
  const line = thread.line ?? thread.originalLine
  if (line === null) return null

  return {
    path: thread.path,
    side: thread.diffSide === "LEFT" ? "before" : "after",
    line,
    startLine: thread.startLine ?? thread.originalStartLine ?? line
  }
}

const mergeOf = (
  pull: NonNullable<NonNullable<Answer["repository"]>["pullRequest"]>,
  ways: ReadonlyArray<MergeWay>
): MergeFacts => ({
  ways,
  mergeable: pull.mergeable,
  status: pull.mergeStateStatus,
  mayBypass: pull.viewerCanMergeAsAdmin,
  mayUpdateBranch: pull.viewerCanUpdateBranch,
  whyNotUpdate: pull.viewerCannotUpdateReasons,
  autoMerge:
    pull.autoMergeRequest === null
      ? null
      : { method: pull.autoMergeRequest.mergeMethod, mayCancel: pull.viewerCanDisableAutoMerge },
  // A repository without a merge queue has no queue to be in, and a card that
  // draws one would be offering a line that does not exist.
  queue:
    pull.mergeQueue === null
      ? null
      : {
          waiting: pull.isInMergeQueue,
          position: pull.mergeQueueEntry?.position ?? null,
          mayQueue: pull.viewerCanEnableAutoMerge,
          url: pull.mergeQueue.url
        }
})

/** The files, whole: REST pages until GitHub stops, and never more than three. */
const readFiles = Effect.fn("readFiles")(function* (token: string, card: Card) {
  const files: Array<RestFile> = []

  for (let page = 1; page <= 3; page += 1) {
    const some = yield* restRead<ReadonlyArray<RestFile>>(
      token,
      `/repos/${card.owner}/${card.repo}/pulls/${card.number}/files?per_page=100&page=${page}`
    )
    files.push(...some)
    if (some.length < 100) break
  }

  return files
})

export const readCard = Effect.fn("readCard")(function* (token: string, card: Card) {
  /*
   * Three reads at once, the third being the repository's own merge settings.
   *
   * Beside the other two rather than behind them, so it costs no wait: the card
   * is not drawn until all three land anyway. It is here rather than left to the
   * view because this is where every other conclusion about merging is drawn,
   * and a card that decided it separately is how the card and a row in the list
   * came to answer the same question two different ways.
   */
  const [answer, rest, ways] = yield* Effect.all(
    [
      graphRead<Answer>(token, QUERY, { owner: card.owner, repo: card.repo, number: card.number }),
      readFiles(token, card),
      waysToMerge(token, card)
    ],
    { concurrency: 3 }
  )

  const pull = answer.repository?.pullRequest
  if (pull === null || pull === undefined) {
    return yield* Effect.fail(new Error(`No pull request ${card.owner}/${card.repo}#${card.number}`))
  }

  const viewed = new Map(real(pull.files.nodes).map((one) => [one.path, one.viewerViewedState]))

  return {
    title: pull.title,
    markdown: pull.body,
    html: pull.bodyHTML,
    state: pull.isDraft
      ? "draft"
      : pull.state === "MERGED"
        ? "merged"
        : pull.state === "CLOSED"
          ? "closed"
          : "open",
    openedAt: pull.createdAt,
    closedAt: pull.closedAt,
    mergedAt: pull.mergedAt,
    author: faceOf(pull.author),
    baseBranch: pull.baseRefName,
    headBranch: pull.headRefName,
    headSha: pull.headRefOid,
    baseSha: pull.baseRefOid,
    viewerLogin: answer.viewer.login,
    lastReviewPoint: pull.viewerLatestReview?.commit?.oid ?? null,
    files: rest.map((one, at) => fileOf(one, viewed, at < EMBEDDED)),
    commits: real(pull.commits.nodes).map(
      ({ commit }): CommitFacts => ({
        sha: commit.oid,
        abbreviatedSha: commit.abbreviatedOid,
        author: commit.author?.user?.login ?? commit.author?.name ?? "ghost",
        headline: commit.messageHeadline,
        createdAt: commit.committedDate
      })
    ),
    threads: real(pull.reviewThreads.nodes).map(
      (thread): ThreadFacts => ({
        id: thread.id,
        isResolved: thread.isResolved,
        at: anchorOf(thread),
        comments: real(thread.comments.nodes).map(saidOf)
      })
    ),
    remarks: real(pull.comments.nodes).map((one): RemarkFacts => ({ id: one.id, ...saidOf(one) })),
    checks: real(real(pull.rollup.nodes)[0]?.commit.statusCheckRollup?.contexts.nodes ?? [])
      .map(checkOf)
      .filter((one): one is CheckFacts => one !== null),
    reviews: real(pull.latestOpinionatedReviews.nodes)
      .map((one): ReviewFacts | null => {
        const decision = VERDICTS[one.state]
        return decision === undefined ? null : { reviewer: faceOf(one.author), decision }
      })
      .filter((one): one is ReviewFacts => one !== null),
    merge: mergeOf(pull, ways)
  } satisfies CardFacts
})

/**
 * The content of some files, asked for by path.
 *
 * REST has no way to ask for one file's patch, so this reads the same pages the
 * card read and keeps what was asked about. It stops as soon as every asked path
 * has been found, which for the usual case — a reader opening the third file of
 * eleven — is one request.
 */
export const readPatches = Effect.fn("readPatches")(function* (
  token: string,
  card: Card,
  paths: ReadonlyArray<string>
) {
  const wanted = new Set(paths)
  const found: Array<{ path: string; patch: string | null }> = []

  for (let page = 1; page <= 5 && wanted.size > 0; page += 1) {
    const some = yield* restRead<ReadonlyArray<RestFile>>(
      token,
      `/repos/${card.owner}/${card.repo}/pulls/${card.number}/files?per_page=100&page=${page}`
    )

    for (const file of some) {
      if (!wanted.has(file.filename)) continue
      wanted.delete(file.filename)
      found.push({ path: file.filename, patch: file.patch ?? null })
    }

    if (some.length < 100) break
  }

  return found
})
