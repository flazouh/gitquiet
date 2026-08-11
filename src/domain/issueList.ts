import { Option } from "effect"
import { termsIn, understood } from "./sieve"

/**
 * A repository's own issue list — `/owner/repo/issues`.
 *
 * The sibling of `repoList.ts` next door, and the same page in every way that
 * matters to this layer: one repository, whatever the reader typed in the box,
 * and which page of it they are on.
 *
 * What it deliberately does not carry is a Court. A repository's issues are not
 * owed to the reader — three hundred of them in `flowline-labs/flowline` and
 * fifteen assigned — and the search that lists them says nothing about why the
 * reader might be involved in any one. Home groups issues because it asked
 * three questions that each name the reader; this page asked one that does not,
 * so it draws one list in GitHub's own order and claims nothing more.
 */
export type IssueList = {
  readonly repo: { readonly owner: string; readonly repo: string }
  /**
   * Whatever search the address carried, unread and unedited.
   *
   * GitHub's filter controls write their state into `q`, so this is where
   * "closed only", "assigned to me" and every sort arrive. Kept verbatim rather
   * than parsed into fields: the vocabulary is theirs, it is large, and it grows.
   */
  readonly query: string
  readonly page: number
}

/**
 * Their first page, for an address that names no page or names one that is not
 * a page at all. A hand-edited address is worth answering with the first page
 * rather than with nothing.
 */
const firstPage = 1

const pageIn = (search: URLSearchParams): number => {
  const asked = Number(search.get("page"))
  return Number.isInteger(asked) && asked >= 1 ? asked : firstPage
}

/**
 * Reads a repository's issue list out of an address, or nothing where the
 * address is not one.
 *
 * Written against the whole URL rather than a pathname because it has to reject
 * other hosts: this runs on every page a content script is matched into, and a
 * page that merely ends in `/issues` on some other site is not a GitHub list.
 */
export const issueListIn = (url: string): Option.Option<IssueList> => {
  // `URL.parse` rather than the constructor: an address that is not one is an
  // ordinary answer here, not an exception to be caught.
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()

  /*
   * Exactly three, which refuses three neighbours at once: `/issues` and
   * `/issues/assigned` are the global dashboard and name no repository,
   * `/owner/repo/issues/2137` is one issue and has a screen of its own, and
   * `/owner/repo/issues/new` is the form for raising one.
   */
  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  if (segments.length !== 3) return Option.none()

  const [owner, repo, last] = segments
  if (last !== "issues" || owner === undefined || repo === undefined) return Option.none()

  return Option.some({
    repo: { owner, repo },
    query: address.searchParams.get("q") ?? "",
    page: pageIn(address.searchParams)
  })
}

/** The states GitHub understands, so that asking for one is recognised as having asked. */
const STATES: ReadonlyArray<string> = ["open", "closed"]

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
 * first — and the kind, because this route answers about pull requests just as
 * readily and those have a list of their own.
 */
const readerTerms = (query: string): ReadonlyArray<string> =>
  termsIn(query).filter(
    (term) => !term.startsWith("repo:") && term !== "is:pr" && term !== "is:issue"
  )

/**
 * The search that reads one page of a repository's issues.
 *
 * Three things are ours and the rest is the reader's: the repository and the
 * kind, which {@link readerTerms} takes out, and `is:open`, added here but only
 * where the reader has not said otherwise — `is:open` on top of `is:closed`
 * matches nothing and leaves an empty list with no visible cause.
 */
export const queryFor = ({ repo, query }: IssueList): string => {
  const asked = readerTerms(query)
  const state = asked.some((term) => term.startsWith("is:") && STATES.includes(term.slice(3)))

  return [
    `repo:${repo.owner}/${repo.repo}`,
    "is:issue",
    ...(state ? [] : ["is:open"]),
    ...asked
  ].join(" ")
}

/**
 * What the filter box says when the address arrived with a search already on it.
 *
 * A reader who pressed one of GitHub's own filters before this interface took
 * over, or who followed a link to closed issues, is looking at a narrowed list.
 * Without this the box is empty and the page reads as everything there is.
 *
 * Only the terms the box can act on. The rest of GitHub's vocabulary was applied
 * by the search and cannot be undone here, and putting `sort:created-asc` into a
 * box that reads unknown terms as words to find in a title would empty the list
 * the reader came to see.
 */
export const seeding = ({ query }: IssueList): string =>
  readerTerms(query).filter(understood).join(" ")
