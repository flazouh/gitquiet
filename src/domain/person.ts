/**
 * A person's own three pages — `/login`, `?tab=repositories` and `?tab=stars`.
 *
 * One address with a query parameter deciding which page it is, which is GitHub's
 * arrangement and not ours: the profile, the repositories tab and the stars tab are
 * three different screens reached by changing one word. So the three parsers here
 * are written as one shape read three ways, and each refuses what the other two
 * claim. `docs/spec/profile.md` says what each page is for.
 *
 * These are the only addresses in this codebase told apart by a query parameter
 * rather than by a path segment, and the only ones a single path segment reaches.
 * Both facts make them easy to claim by accident, which is what most of this file
 * is about.
 */

import { Option } from "effect"
import { NOT_AN_OWNER } from "./repoHome"

/** Which of the three a person's address asks for. */
export type Tab = "profile" | "repositories" | "stars"

/**
 * One of a person's three pages, as its address describes it.
 *
 * The same shape for all three, because the three differ in what is drawn and not
 * in what the address says. A screen that only wants the login ignores the rest.
 */
export type PersonPage = {
  readonly login: string
  readonly tab: Tab
  readonly page: number
  /**
   * What the reader typed in GitHub's own find box, or nothing.
   *
   * Both tabs have one, both write it to `q`, and both mean it as text to find in a
   * repository's name. Kept because a reader who arrives having already narrowed
   * the list is looking at a narrowed list, and a screen that ignores that shows
   * them everything under an address that says otherwise.
   */
  readonly find: string
  /**
   * Every other narrowing the address carried, verbatim, `page` excepted.
   *
   * GitHub's own controls on these tabs write `type`, `language`, `sort` and
   * `direction`, and this screen has no opinion about any of them: they are handed
   * straight back when a later page is fetched, so the rows that arrive are the
   * rows the address asked for. Grouping happens after, over whatever came.
   *
   * Held as a string rather than as fields because the vocabulary is theirs and it
   * grows, which is the same reason `RepoList` keeps its query unparsed.
   */
  readonly narrowing: string
}

/**
 * The site's own one-segment pages, which are not people.
 *
 * {@link NOT_AN_OWNER} lists the first segments that host a second one, and says in
 * as many words that `/features` and `/pricing` are left out because they never do.
 * A person's address is one segment on its own, so for this parser those are
 * exactly the dangerous ones: every marketing page GitHub has looks like a login.
 *
 * So this is that list plus the pages that end where they start. GitHub reserves
 * all of them, so none can be somebody's name, and a name missing from here costs
 * one page of theirs replaced by an interface that finds no profile and hands the
 * page back.
 */
const NOT_A_PERSON: ReadonlySet<string> = new Set([
  ...NOT_AN_OWNER,
  "copilot",
  "customer-stories",
  "features",
  "feed",
  "home",
  "join",
  "mobile",
  "nonprofit",
  "pricing",
  "readme",
  "signup",
  "solutions",
  "team",
  "why-github"
])

/**
 * The tabs a person's address can name, and which of ours each is.
 *
 * `overview` is GitHub's word for the profile and is what their own tab links write
 * when a reader presses back onto it, so it has to mean the same as no tab at all.
 * Every other tab they have — `achievements`, `followers`, `packages`, `projects`,
 * `sponsoring` — is a page this interface does not draw, and is deliberately absent
 * so that all three parsers refuse it and GitHub keeps the page.
 */
const TABS: Readonly<Record<string, Tab>> = {
  overview: "profile",
  repositories: "repositories",
  stars: "stars"
}

/** Their first page, for an address naming none or naming one that is not a page. */
const firstPage = 1

const pageIn = (search: URLSearchParams): number => {
  const asked = Number(search.get("page"))
  return Number.isInteger(asked) && asked >= 1 ? asked : firstPage
}

/**
 * Everything the address carried except the page, in the order it carried it.
 *
 * The page comes off because paging is ours to do: it is the one parameter this
 * interface writes itself, and leaving it in would have a later read ask for page
 * two of page two.
 */
const narrowingIn = (search: URLSearchParams): string => {
  const rest = new URLSearchParams(search)
  rest.delete("page")
  return rest.toString()
}

/**
 * Reads one of a person's three pages out of an address, or nothing.
 *
 * Written against the whole URL rather than a pathname for the reason every parser
 * here is: this runs on every page a content script is matched into, and one
 * segment on some other host is not a GitHub profile.
 *
 * What this cannot tell is a person from an organisation. `/microsoft` is one
 * segment and a reserved-word list will never catch it, because it is a real
 * account name. Measured rather than assumed: an organisation's page carries none
 * of a person's hooks — no `user-profile-frame`, no profile sidebar — and their
 * `?tab=repositories` answers 302 to `/orgs/microsoft/repositories`. So the address
 * is claimed, no gate fires without the proof, and the screen hands the page back
 * when the frame is not there. See `docs/spec/profile.md`.
 */
export const personPageIn = (url: string): Option.Option<PersonPage> => {
  // `URL.parse` rather than the constructor: an address that is not one is an
  // ordinary answer here, not an exception to be caught.
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()

  // Exactly one, so that `/login/repositories` — a repository called
  // `repositories` — stays a repository, and `/` stays the reader's own dashboard.
  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  if (segments.length !== 1) return Option.none()

  const [login] = segments
  if (login === undefined || NOT_A_PERSON.has(login.toLowerCase())) return Option.none()

  const asked = address.searchParams.get("tab")
  const tab = asked === null ? "profile" : TABS[asked]
  if (tab === undefined) return Option.none()

  return Option.some({
    login,
    tab,
    page: pageIn(address.searchParams),
    find: address.searchParams.get("q") ?? "",
    narrowing: narrowingIn(address.searchParams)
  })
}

/** The profile itself, or nothing where the address is one of the other two. */
export const profileIn = (url: string): Option.Option<PersonPage> =>
  Option.filter(personPageIn(url), (page) => page.tab === "profile")

/** Their repositories tab, or nothing. */
export const personReposIn = (url: string): Option.Option<PersonPage> =>
  Option.filter(personPageIn(url), (page) => page.tab === "repositories")

/** Their stars tab, or nothing. */
export const personStarsIn = (url: string): Option.Option<PersonPage> =>
  Option.filter(personPageIn(url), (page) => page.tab === "stars")

/** GitHub's word for one of our three, for writing an address back out. */
const wordFor: Readonly<Record<Tab, string>> = {
  profile: "overview",
  repositories: "repositories",
  stars: "stars"
}

/**
 * The address of one page of a tab, as GitHub serves it.
 *
 * Used for every page after the served one, so the narrowing goes back exactly as
 * it arrived and the rows that come are the rows the reader's own address asked
 * for. The tab is written even where the reader's address left it out, because a
 * fetch without it answers with the profile.
 */
export const tabRoute = (page: PersonPage, wanted: number): string => {
  const search = new URLSearchParams(page.narrowing)
  search.set("tab", wordFor[page.tab])
  if (wanted > firstPage) search.set("page", String(wanted))

  return `/${page.login}?${search.toString()}`
}
