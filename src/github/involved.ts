import { Option, Schema } from "effect"
import type {
  CheckRollup,
  InvolvedPullRequest,
  Opinion,
  Shelf
} from "../domain/workingSet"
import { DeferredRoute, QueryRoute, ShelfRoute, type WorkingSetRow } from "./wire"

export const decodeShelf = Schema.decodeUnknownEffect(ShelfRoute)
export const decodeQuery = Schema.decodeUnknownEffect(QueryRoute)
export const decodeDeferred = Schema.decodeUnknownEffect(DeferredRoute)

/**
 * Turning GitHub's Working Set rows into Involved Pull Requests.
 *
 * The same job `snapshot.ts` does for one pull request's four routes, for the
 * two routes that answer about many. Kept apart from it because they share no
 * payload and no field: a row is a twenty-six field summary of a pull request
 * nobody has opened, and a snapshot is the whole of one somebody has.
 */

/** `owner/repo`, which is how the Working Set names a repository. */
const splitRepo = (nameWithOwner: string): Option.Option<{ owner: string; repo: string }> => {
  const at = nameWithOwner.indexOf("/")
  if (at <= 0 || at === nameWithOwner.length - 1) return Option.none()

  const owner = nameWithOwner.slice(0, at)
  const repo = nameWithOwner.slice(at + 1)
  // A second slash means this is not `owner/repo` and guessing which half is
  // which would build a URL that quietly reads the wrong pull request.
  return repo.includes("/") ? Option.none() : Option.some({ owner, repo })
}

/**
 * A draft is a state here and a flag there.
 *
 * GitHub reports a draft as `OPEN` with `isDraft` set, while everything above
 * this treats draft as one of the four states a pull request is in — because a
 * draft can be neither merged nor queued, which is a difference in kind rather
 * than a decoration on an open one.
 */
const stateOf = (row: WorkingSetRow): InvolvedPullRequest["state"] => {
  if (row.state === "MERGED") return "merged"
  if (row.state === "CLOSED") return "closed"
  return row.isDraft || row.state === "DRAFT" ? "draft" : "open"
}

const nothing = <T>(value: T | null | undefined): Option.Option<T> =>
  value === null || value === undefined ? Option.none() : Option.some(value)

/**
 * One row as an Involved Pull Request, or nothing where it cannot be addressed.
 *
 * None rather than a failure: a row whose repository name this cannot split is
 * one pull request that will not be drawn, and refusing the whole payload over
 * it would cost the Participant their entire Working Set instead.
 */
export const involvedFrom = (
  shelf: Shelf,
  row: WorkingSetRow
): Option.Option<InvolvedPullRequest> =>
  Option.map(splitRepo(row.repoNameWithOwner), ({ owner, repo }) => ({
    reference: { owner, repo, number: row.number },
    id: row.id,
    title: row.title,
    author: {
      // A row without an author is one whose account is gone. GitHub renders
      // those as `ghost`, and so does everything else here that meets one.
      login: row.author?.displayLogin ?? "ghost",
      isAutomated: row.authoredByAgent ?? false,
      // Rows carry no avatar. `faceOf` builds one from the login, which is what
      // every other face in this interface is already built from.
      faceUrl: Option.none()
    },
    state: stateOf(row),
    shelf,
    why: nothing(row.category),
    readByViewer: row.isReadByCurrentUser,
    comments: row.commentCount,
    labels: row.labels.length,
    assignees: row.assignees.length,
    openedAt: row.createdAt,
    changedAt: row.updatedAt,
    headSha: row.headSha,
    channels: Option.match(nothing(row.commitHeadShaChannel), {
      onNone: (): ReadonlyArray<string> => [],
      onSome: (channel) => (channel.length > 0 ? [channel] : [])
    }),
    checks: Option.none(),
    reviewed: Option.none()
  }))

/** Every row of a listing that can be addressed, in the order GitHub gave them. */
export const involvedIn = (
  shelf: Shelf,
  rows: ReadonlyArray<WorkingSetRow>
): ReadonlyArray<InvolvedPullRequest> =>
  rows.flatMap((row) => Option.match(involvedFrom(shelf, row), {
    onNone: (): ReadonlyArray<InvolvedPullRequest> => [],
    onSome: (involved) => [involved]
  }))

/**
 * Their five status states as the three a row can draw.
 *
 * `ERROR` and `EXPECTED` join `PENDING` rather than `FAILURE`: a run that
 * errored has not reported a verdict on the branch, and one still expected has
 * not started. Neither is a check the Participant can go and fix yet, which is
 * the only thing calling it failing would be for.
 */
const rollupState = (state: string): CheckRollup["state"] => {
  if (state === "SUCCESS") return "passing"
  return state === "FAILURE" ? "failing" : "running"
}

const opinionOf = (decision: string): Opinion => {
  if (decision === "APPROVED") return "approved"
  return decision === "CHANGES_REQUESTED" ? "changes-requested" : "review-required"
}

/** What the deferred read added, by the id it answered about. */
export type Standings = ReadonlyMap<
  number,
  { readonly checks: Option.Option<CheckRollup>; readonly reviewed: Option.Option<Opinion> }
>

export const standingsIn = (route: DeferredRoute): Standings => {
  const found = new Map<
    number,
    { checks: Option.Option<CheckRollup>; reviewed: Option.Option<Opinion> }
  >()

  for (const result of route.payload.pullsInboxSurfaceContentDeferredData.results) {
    found.set(result.id, {
      checks: Option.map(nothing(result.statusCheckRollup), (rollup) => ({
        state: rollupState(rollup.state),
        total: rollup.totalCount,
        passed: rollup.successCount
      })),
      reviewed: Option.map(nothing(result.reviewDecisionState), opinionOf)
    })
  }

  return found
}

/**
 * The same pull requests with whatever the deferred read had to say about them.
 *
 * Rows the deferred read did not answer about keep their absent checks rather
 * than gaining empty ones, because the two mean different things to a reader: a
 * pull request with no checks configured is finished, and one not yet asked
 * about is still loading.
 */
export const withStandings = (
  involved: ReadonlyArray<InvolvedPullRequest>,
  standings: Standings
): ReadonlyArray<InvolvedPullRequest> =>
  involved.map((one) => {
    const found = standings.get(one.id)
    return found === undefined ? one : { ...one, checks: found.checks, reviewed: found.reviewed }
  })
