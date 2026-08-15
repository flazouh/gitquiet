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

/** Somewhere they said to go, as the one line their page gives it. */
export type Way = {
  /** What their page shows: `acepe.dev`, `@sasha_zelts`, `u/SashaZelt`. */
  readonly label: string
  readonly href: string
}

/**
 * Who the account is, as their own page says it beside their repositories.
 *
 * Not a `Portrait`, which is the four lines a hovercard shows over a face in a
 * row and comes from GitHub's own card endpoint. This is the column down the left of
 * a person's page — the face at 260 pixels, the name, the words they wrote about
 * themselves, who they work for, where they are, and the ways they asked to be
 * reached — read out of the document that was served.
 *
 * It exists because this interface now draws that column rather than leaving it. The
 * page is one page: a reader deciding whether this is the right `alex` reads the face
 * and the bio, then the list, and a left column in GitHub's type beside a list in
 * ours is two apps in one window.
 *
 * Every field but the login is optional because every field but the login is optional
 * on GitHub, and the counts are kept as the words their page wrote — "25", "1.2k" —
 * rather than as numbers. Their own page abbreviates above a thousand and the exact
 * figure is nowhere in the markup, so a number here would be a number invented.
 */
export type Person = {
  readonly login: string
  readonly name: Option.Option<string>
  readonly bio: Option.Option<string>
  /** Their face at the size a column wants rather than the size a row wants. */
  readonly faceUrl: Option.Option<string>
  readonly company: Option.Option<string>
  readonly location: Option.Option<string>
  readonly followers: Option.Option<string>
  readonly following: Option.Option<string>
  /** The one site their page calls their own, above the rest. */
  readonly site: Option.Option<Way>
  /** Everywhere else they said to find them, in their own order. */
  readonly ways: ReadonlyArray<Way>
  /** Where to sponsor them, where GitHub offered the button. */
  readonly sponsorAt: Option.Option<string>
  /**
   * The counts on their own tab row, for the row this interface draws instead.
   *
   * Read rather than counted. The walk over their list stops at a cap and the stars
   * tab is not read at all, so a total counted here would disagree with their page on
   * exactly the accounts where the number matters.
   */
  readonly tally: {
    readonly repositories: Option.Option<string>
    readonly stars: Option.Option<string>
  }
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
