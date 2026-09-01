import { Option } from "effect"
import type { PullRequestState } from "./PullRequest"
import { sieveOf, termsIn, understood } from "./sieve"
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
 * The terms the sieve answers on its own, held out of the search.
 *
 * `is:failing`, `review:approved`, `is:unread`, `has:comments`, `is:stale` are
 * this interface's vocabulary, not GitHub's — their search reads `is:failing` as
 * a term it has never heard of. Each of them only ever narrows rows already
 * fetched, so the sieve applies them over whatever the search returns and the
 * search is not asked a question it would answer wrongly.
 */
const sieveAnswers = (term: string): boolean => {
  const alone = sieveOf(term)
  return (
    alone.checks.size > 0 || alone.review.size > 0 || alone.unread || alone.commented || alone.stale
  )
}

/** The states the reader's terms name, read the way the sieve reads them. */
const statesAsked = (terms: ReadonlyArray<string>): ReadonlySet<PullRequestState> =>
  sieveOf(terms.join(" ")).states

/**
 * The search that reads one page of a repository's list.
 *
 * Three things are ours and the rest is the reader's: the repository and the
 * kind, which {@link readerTerms} takes out, and `is:open`, added here but only
 * where the reader has not said otherwise — `is:open` on top of `is:closed`
 * matches nothing and leaves an empty list with no visible cause.
 *
 * Two of the reader's spellings are theirs and not GitHub's. `author:me` is what
 * the filter box says, and their search reads it as somebody whose login is the
 * word "me"; it goes out as the `author:@me` they do understand. And two states
 * at once — `is:open is:merged` — is an either to the sieve but a both to their
 * search, which a pull request cannot be: the states are left out of the search,
 * which then returns every state for the sieve to narrow to the two asked.
 */
export const queryFor = ({ repo, query }: RepoList): string => {
  const asked = readerTerms(query)
  const states = statesAsked(asked)

  const sent = asked
    .filter((term) => !sieveAnswers(term))
    .filter((term) => states.size <= 1 || statesAsked([term]).size === 0)
    .map((term) => (term.toLowerCase() === "author:me" ? "author:@me" : term))

  return [
    `repo:${repo.owner}/${repo.repo}`,
    "is:pr",
    ...(states.size === 0 ? ["is:open"] : []),
    ...sent
  ].join(" ")
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
const STATES: ReadonlyArray<PullRequestState> = ["open", "closed", "merged", "draft"]

/**
 * The states the rows of a search could be in, given the states its address named.
 *
 * Wider than the terms in three places, each a fact about GitHub's search rather
 * than a choice here. Naming no state fetches their default, which is open pull
 * requests with the drafts among them. `is:closed` includes the merged, because a
 * merged pull request is a closed one to their search. And two states at once go
 * out as none — see {@link queryFor} — which fetches every state there is.
 */
const fetched = (named: ReadonlySet<PullRequestState>): ReadonlySet<PullRequestState> => {
  if (named.size > 1) return new Set(STATES)
  if (named.has("closed")) return new Set(["closed", "merged"])
  if (named.has("draft") || named.has("merged")) return named
  return new Set(["open", "draft"])
}

/**
 * The address that fetches what the filter box is asking, or nothing while this
 * page's rows can already answer it.
 *
 * The box narrows the rows on the screen and asks GitHub for nothing, which is
 * right for every term but a state: the rows were fetched open unless the address
 * said otherwise, so `is:merged` typed into the box excludes every row there is —
 * an empty list under a chip this interface offered. A state the fetch did not
 * carry is a new question, and a new question is a new address.
 *
 * The new address keeps the terms the box never showed — a `label:` or a `sort:`
 * from a link, which the search applied and the box cannot undo — and says what
 * the box now says, so the seed on the far side agrees with it. Words stay out:
 * the sieve reads them as letters to find and their search reads them as words,
 * and the reader's half-typed `fla` fetching nothing would be this page emptying
 * a list it was asked to widen. They keep narrowing on the reader's side of it.
 *
 * Asking for less needs no new address — the sieve narrows fetched rows as
 * readily as ever — but a box that no longer names any state stands over rows
 * that are still merged or closed, reading as everything when it is not, so that
 * one goes back to the default list.
 */
export const addressFor = (list: RepoList, box: string): Option.Option<string> => {
  const had = statesAsked(readerTerms(list.query))
  const asking = sieveOf(box).states

  const answered =
    asking.size === 0
      ? fetched(had).has("open")
      : [...asking].every((state) => fetched(had).has(state))
  if (answered) return Option.none()

  const kept = readerTerms(list.query).filter((term) => !understood(term))
  const terms = [...kept, ...termsIn(box).filter(understood)]

  const path = `/${list.repo.owner}/${list.repo.repo}/pulls`
  if (terms.length === 0) return Option.some(path)
  return Option.some(`${path}?${new URLSearchParams({ q: terms.join(" ") }).toString()}`)
}

/**
 * The shelf GitHub put each of the reader's own pull requests on, by id.
 *
 * More urgent wins where a pull request is on two, for the same reason the Working
 * Set does it: the shelves overlap, and being wrong towards Needs You costs a
 * glance where being wrong away from it costs the reader their turn.
 */
const shelvedById = (
  shelved: ReadonlyArray<InvolvedPullRequest>
): ReadonlyMap<string, InvolvedPullRequest> => {
  const best = new Map<string, InvolvedPullRequest>()

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
