import { Option } from "effect"
import { termsIn, understood } from "./sieve"
import { urgencyOf } from "./sittings"
import { courtOfOne, type InvolvedPullRequest } from "./workingSet"

/**
 * A repository's own pull request list — `/owner/repo/pulls`.
 *
 * A different page from the Working Set at `/pulls`, asking a different question.
 * The Working Set asks what the reader is involved in, across everything; this
 * asks what is open in one repository, most of which the reader has nothing to do
 * with. GitHub's inbox shelves answer the first and cannot answer the second, so
 * this is read through their dashboard's plain search instead.
 */
export type RepoList = {
  readonly repo: { readonly owner: string; readonly repo: string }
  /**
   * Whatever search the address carried, unread and unedited.
   *
   * GitHub's filter controls write their state into `q`, so this is where "closed
   * only", "authored by me" and every sort arrive. Kept verbatim rather than
   * parsed into fields: the vocabulary is theirs, it is large, and it grows.
   */
  readonly query: string
  readonly page: number
}

/**
 * Their first page, for an address that names no page or names one that is not a
 * page at all. A hand-edited address is worth answering with the first page rather
 * than with nothing.
 */
const firstPage = 1

const pageIn = (search: URLSearchParams): number => {
  const asked = Number(search.get("page"))
  return Number.isInteger(asked) && asked >= 1 ? asked : firstPage
}

/**
 * Reads a repository's pull request list out of an address, or nothing where the
 * address is not one.
 *
 * Written against the whole URL rather than a pathname because it has to reject
 * other hosts: this runs on every page a content script is matched into, and a
 * page that merely ends in `/pulls` on some other site is not a GitHub list.
 */
export const repoListIn = (url: string): Option.Option<RepoList> => {
  // `URL.parse` rather than the constructor: an address that is not one is an
  // ordinary answer here, not an exception to be caught.
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()

  // Exactly three, so that `/pulls` (the Working Set, one segment) and
  // `/owner/repo/pulls/something` (not a page GitHub has) are both refused.
  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  if (segments.length !== 3) return Option.none()

  const [owner, repo, last] = segments
  if (last !== "pulls" || owner === undefined || repo === undefined) return Option.none()

  return Option.some({
    repo: { owner, repo },
    query: address.searchParams.get("q") ?? "",
    page: pageIn(address.searchParams)
  })
}

/**
 * What the reader asked for, with the page's own terms taken back out.
 *
 * Read once and used twice: by the search that fetches the rows, and by the
 * filter box that says what is being looked at. The two must be the same list.
 * A box holding a term the search did not carry narrows a page that was never
 * narrowed, and a search carrying a term the box does not show narrows a page
 * that says it is showing everything.
 *
 * What comes out is the repository — the address named it, and a `repo:` in the
 * query would point this page at a different one with the heading saying the
 * first — and the kind, because this route answers about issues just as readily.
 */
const readerTerms = (query: string): ReadonlyArray<string> =>
  termsIn(query).filter(
    (term) => !term.startsWith("repo:") && term !== "is:pr" && term !== "is:issue"
  )

/**
 * The search that reads one page of a repository's list.
 *
 * Three things are ours and the rest is the reader's: the repository and the
 * kind, which {@link readerTerms} takes out, and `is:open`, added here but only
 * where the reader has not said otherwise — `is:open` on top of `is:closed`
 * matches nothing and leaves an empty list with no visible cause.
 */
export const queryFor = ({ repo, query }: RepoList): string => {
  const asked = readerTerms(query)
  const state = asked.some((term) => term.startsWith("is:") && STATES.includes(term.slice(3)))

  return [`repo:${repo.owner}/${repo.repo}`, "is:pr", ...(state ? [] : ["is:open"]), ...asked].join(
    " "
  )
}

/**
 * What the filter box says when the address arrived with a search already on it.
 *
 * A reader who pressed one of GitHub's own filters before this interface took
 * over, or who followed a link to merged pull requests, is looking at a narrowed
 * list. Without this the box is empty and the page reads as everything there is.
 *
 * Only the terms the box can act on. The rest of GitHub's vocabulary was applied
 * by the search and cannot be undone here, and putting `sort:created-asc` into a
 * box that reads unknown terms as words to find in a title would empty the list
 * the reader came to see.
 */
export const seeding = ({ query }: RepoList): string =>
  readerTerms(query).filter(understood).join(" ")

/** The states GitHub understands, so that asking for one is recognised as having asked. */
const STATES: ReadonlyArray<string> = ["open", "closed", "merged", "draft"]

/**
 * The shelf GitHub put each of the reader's own pull requests on, by id.
 *
 * More urgent wins where a pull request is on two, for the same reason the Working
 * Set does it: the shelves overlap, and being wrong towards Needs You costs a
 * glance where being wrong away from it costs the reader their turn.
 */
const shelvedById = (
  shelved: ReadonlyArray<InvolvedPullRequest>
): ReadonlyMap<number, InvolvedPullRequest> => {
  const best = new Map<number, InvolvedPullRequest>()

  for (const one of shelved) {
    const already = best.get(one.id)
    const weigh = (row: InvolvedPullRequest): number => urgencyOf(courtOfOne(row))

    if (already === undefined || weigh(one) < weigh(already)) best.set(one.id, one)
  }

  return best
}

/**
 * A page of a repository's list, with the reader's own involvement written back on.
 *
 * The search says what is in the repository and knows nothing about the reader; the
 * shelves say what the reader has to do and know nothing about repositories. Neither
 * alone can group this page: without the shelves every row would read as somebody
 * else's, and the reader's own three pull requests would be lost among two hundred.
 *
 * The search stays in charge of *which* rows there are. The shelves only ever add a
 * shelf to a row already listed — a shelf row for this repository that the address
 * did not ask for is not smuggled in, because a page that shows rows its own address
 * excludes is a page whose paging does not add up.
 */
export const onTheirShelves = (
  rows: ReadonlyArray<InvolvedPullRequest>,
  shelved: ReadonlyArray<InvolvedPullRequest>
): ReadonlyArray<InvolvedPullRequest> => {
  const mine = shelvedById(shelved)

  return rows.map((row) => {
    const found = mine.get(row.id)
    // `why` comes with the shelf because only shelves carry it, and it is the
    // reason GitHub gives for wanting the reader — meaningless without one.
    return found === undefined ? row : { ...row, shelf: found.shelf, why: found.why }
  })
}
