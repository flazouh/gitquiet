import { Option } from "effect"
import type { Involvement } from "./issues"
import { termsIn, understood } from "./sieve"

/**
 * Every issue the reader is party to, across everything — `/issues`.
 *
 * The issue side of the Working Set, and the third of these list pages. What it
 * has that the other two do not is a question in the address itself: GitHub's
 * own tabs are Assigned, Created and Mentioned, and those are exactly the three
 * involvements this codebase already reads Home from.
 *
 * One tab at a time rather than all three at once, which is the difference from
 * Home. Home asks all three and files the answers into Courts, because its job
 * is to say what the reader owes across every kind of work. This page was asked
 * for by somebody who named one of the three, and the name of it is on the tab
 * they pressed.
 */
export type IssueDashboard = {
  readonly involvement: Involvement
  /**
   * Whatever search the address carried, unread and unedited.
   *
   * GitHub's filter controls write their state into `q`, so this is where
   * "closed only", "in this repository" and every sort arrive. Kept verbatim
   * rather than parsed into fields: the vocabulary is theirs, it is large, and
   * it grows.
   */
  readonly query: string
  readonly page: number
}

/**
 * Their word for each tab, which is not this codebase's word for two of them.
 *
 * `created` is what GitHub calls the issues the reader raised and `authored` is
 * what everything here calls it, because that is the word a pull request uses
 * for the same fact. The translation lives in this one table rather than at
 * each end of it.
 */
const TAB_OF: Record<Involvement, string> = {
  assigned: "assigned",
  authored: "created",
  mentioned: "mentioned"
}

const INVOLVEMENT_OF: ReadonlyMap<string, Involvement> = new Map(
  Object.entries(TAB_OF).map(([involvement, tab]) => [tab, involvement as Involvement])
)

/**
 * The tab GitHub opens on, for the bare address they publish.
 *
 * `/issues` is the one their own nav links to, and it shows Assigned. Answering
 * it with nothing would leave their page standing on the address they link to
 * most, which is the one this most needs to be the page at.
 */
const FIRST: Involvement = "assigned"

/** Their first page, for an address that names no page or names one that is not a page. */
const firstPage = 1

const pageIn = (search: URLSearchParams): number => {
  const asked = Number(search.get("page"))
  return Number.isInteger(asked) && asked >= 1 ? asked : firstPage
}

/**
 * Reads the global issue list out of an address, or nothing where the address
 * is not one.
 *
 * Written against the whole URL rather than a pathname because it has to reject
 * other hosts: this runs on every page a content script is matched into.
 */
export const issueDashboardIn = (url: string): Option.Option<IssueDashboard> => {
  // `URL.parse` rather than the constructor: an address that is not one is an
  // ordinary answer here, not an exception to be caught.
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()

  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  const [first, tab] = segments
  if (first !== "issues" || segments.length > 2) return Option.none()

  /*
   * Their tab row has more on it than these three — Subscribed, and whatever
   * they add next. A view nothing here can ask about is left to GitHub rather
   * than answered with the wrong list under the right heading.
   */
  const involvement = tab === undefined ? FIRST : INVOLVEMENT_OF.get(tab)
  if (involvement === undefined) return Option.none()

  return Option.some({
    involvement,
    query: address.searchParams.get("q") ?? "",
    page: pageIn(address.searchParams)
  })
}

/**
 * Where each tab goes, which is GitHub's own address for it.
 *
 * Theirs rather than one of ours, so that a reload of a tab this interface put
 * the reader on lands on the same list — and so that a reader who steps aside
 * to GitHub's page finds the tab they pressed already selected.
 */
export const pathOf = (involvement: Involvement): string => `/issues/${TAB_OF[involvement]}`

/** Their word for each involvement in a search, which is the query and nothing else. */
const QUALIFIER_OF: Record<Involvement, string> = {
  assigned: "assignee",
  authored: "author",
  mentioned: "mentions"
}

/** Every qualifier this page owns, so that one arriving in the query is refused. */
const OURS: ReadonlyArray<string> = Object.values(QUALIFIER_OF)

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
 * What comes out is the involvement — the tab named it, and a second
 * `assignee:` would point the rows at somebody else with nothing on the page
 * saying so — and the kind, because this route answers about pull requests just
 * as readily and those are the Working Set's.
 */
const readerTerms = (query: string): ReadonlyArray<string> =>
  termsIn(query).filter(
    (term) =>
      !OURS.some((qualifier) => term.startsWith(`${qualifier}:`)) &&
      term !== "is:pr" &&
      term !== "is:issue"
  )

/**
 * The search that reads one page of one tab.
 *
 * Three things are ours and the rest is the reader's: the involvement and the
 * kind, which {@link readerTerms} takes out, and `is:open`, added here but only
 * where the reader has not said otherwise — `is:open` on top of `is:closed`
 * matches nothing and leaves an empty list with no visible cause.
 */
export const queryFor = ({ involvement, query }: IssueDashboard): string => {
  const asked = readerTerms(query)
  const state = asked.some((term) => term.startsWith("is:") && STATES.includes(term.slice(3)))

  return [
    `${QUALIFIER_OF[involvement]}:@me`,
    "is:issue",
    ...(state ? [] : ["is:open"]),
    ...asked
  ].join(" ")
}

/**
 * What the filter box says when the address arrived with a search already on it.
 *
 * A reader who followed a link to closed issues, or who was on GitHub's own page
 * and pressed a filter before this interface took over, is looking at a narrowed
 * list. Without this the box is empty and the page reads as everything there is.
 *
 * Only the terms the box can act on. The rest of GitHub's vocabulary was applied
 * by the search and cannot be undone here, and putting `sort:created-asc` into a
 * box that reads unknown terms as words to find in a title would empty the list
 * the reader came to see. What is dropped stays true of the rows; it just has no
 * control on this page.
 */
export const seeding = ({ query }: IssueDashboard): string =>
  readerTerms(query).filter(understood).join(" ")
