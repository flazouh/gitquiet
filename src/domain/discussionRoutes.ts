/**
 * Every address a Discussions page has, and everything that reads or writes one.
 *
 * Its own file for the reason `issueList.ts` is one beside `issues.ts`: an address is a different
 * job from a row. Nothing here knows what a discussion says, how far along its answer is or which
 * Court it lands in, and nothing in `discussions.ts` has to spell a path.
 *
 * The split is also what keeps the rule in one place. A home is a repository or an organisation,
 * and the moment a second file was reading the path itself, `/orgs/community/discussions/88425`
 * was read as a repository called `community` owned by `orgs`.
 */
import { Option } from "effect"
import type { RepoRef } from "./PullRequestRef"
import { NOT_AN_OWNER } from "./repoHome"

/**
 * Where discussions live, which GitHub gives two of.
 *
 * A repository's are at `/{owner}/{repo}/discussions` and an organisation's at
 * `/orgs/{org}/discussions`, and the second is not a lesser version of the first: it is where
 * GitHub runs its own product feedback, and it is the busiest Discussions surface there is.
 *
 * One type rather than two parallel sets of everything, because the two differ in exactly one
 * thing: the path in front of the word `discussions`. Every row, every comment, every category
 * and every press is the same on both, which the parsers prove by reading both with one code
 * path.
 */
export type Home =
  | { readonly kind: "repository"; readonly owner: string; readonly repo: string }
  | { readonly kind: "organisation"; readonly org: string }

/** The part of the address in front of `/discussions`. */
export const homePath = (home: Home): string =>
  home.kind === "repository" ? `/${home.owner}/${home.repo}` : `/orgs/${home.org}`

/** What to call it on the screen: `owner/repo`, or an organisation's own name. */
export const homeName = (home: Home): string =>
  home.kind === "repository" ? `${home.owner}/${home.repo}` : home.org

/**
 * A home as the repository a failure is named against.
 *
 * Every read in this codebase reports where it went wrong as an owner and a repository, and an
 * organisation's discussions have neither. The pair here is their address instead —
 * `orgs/community` is what a failure report needs in order to say which page could not be read —
 * and nothing draws it on a screen, which is what {@link homeName} is for.
 *
 * Here rather than in each gateway, because there are two of them and they had a copy each.
 */
export const homeRef = (home: Home): RepoRef =>
  home.kind === "repository"
    ? { owner: home.owner, repo: home.repo }
    : { owner: "orgs", repo: home.org }

/**
 * A discussion's address, which is where it lives and a number.
 *
 * Its own type for the reason `IssueRef` is its own type rather than a `PullRequestRef`: the page
 * is at `/discussions/` rather than `/issues/` or `/pull/`, and sharing one type would put a link
 * to a discussion one careless template literal away from a link to whatever else carries that
 * number.
 */
export type DiscussionRef = {
  readonly home: Home
  readonly number: number
}

/**
 * The picture a maintainer chose for a category.
 *
 * Three cases and not a string, because GitHub draws two different things there and a string
 * would have to stand for both. A category set to an ordinary emoji gets a `g-emoji` element
 * holding the character. A category set to one of GitHub's own — `:shipit:`, `:octocat:` — gets
 * an `<img>` instead, because those are not characters at all. `vercel/next.js` has one of each
 * among its nine, and a read that only knew about the first drew Show and tell with a blank
 * where every other row has its picture.
 */
/**
 * Where GitHub's own form for raising one is.
 *
 * Handed over rather than drawn. Raising a discussion asks which category, and which categories a
 * repository has and what each one is for is their page's to explain — the same reason a reader
 * choosing an issue template is sent to GitHub's own chooser rather than to this interface's
 * form.
 */
export const raisingAddressOf = (home: Home): string => `${homePath(home)}/discussions/new`

/** Where a home's discussions are, and one category of them. */
export const listAddressOf = (
  home: Home,
  category: Option.Option<string> = Option.none()
): string =>
  Option.isSome(category)
    ? `${homePath(home)}/discussions/categories/${encodeURIComponent(category.value)}`
    : `${homePath(home)}/discussions`

/**
 * A repository's discussion list — `/{owner}/{repo}/discussions`, and one category of it.
 *
 * The category is part of the address rather than part of the query, unlike everything else a
 * reader can narrow this list by. GitHub keeps both: `?discussions_q=category:"Help"` and
 * `/discussions/categories/help` list the same rows, and their own sidebar links the second.
 */
export type DiscussionList = {
  readonly home: Home
  /** Whichever category the address named, or nothing for all of them. */
  readonly category: Option.Option<string>
  /**
   * Whatever search the address carried, unread and unedited.
   *
   * Their filter controls write their state into `discussions_q`, so this is where `is:open`,
   * `is:unanswered`, `sort:top` and every label arrive. Kept verbatim rather than parsed into
   * fields: the vocabulary is theirs, it is large, and it grows. The same choice `issueList.ts`
   * makes next door about `q`.
   */
  readonly query: string
  readonly page: number
}

/** Their first page, for an address that names no page or names one that is not a page at all. */
const firstPage = 1

const pageIn = (search: URLSearchParams): number => {
  const asked = Number(search.get("page"))
  return Number.isInteger(asked) && asked >= 1 ? asked : firstPage
}

/**
 * The segments of a github.com address, or nothing where it is not one.
 *
 * Written against the whole URL rather than a pathname because it has to refuse other hosts:
 * this runs on every page a content script is matched into, and a page that merely ends in
 * `/discussions` on some other site is not a GitHub list.
 */
const segmentsIn = (url: string): Option.Option<ReadonlyArray<string>> => {
  // `URL.parse` rather than the constructor: an address that is not one is an ordinary answer
  // here, not an exception to be caught.
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()
  return Option.some(address.pathname.split("/").filter((part) => part.length > 0))
}

/**
 * Where the segments in front of `discussions` say this list lives, or nothing.
 *
 * Two shapes, and the second is why this is a function rather than a pair of strings.
 * `/orgs/community/discussions` is where GitHub runs its own product feedback, so `orgs` in the
 * first segment is an organisation's page and never an owner called "orgs" — and every other
 * reserved word there is one of GitHub's own pages and not an owner at all.
 */
const homeIn = (segments: ReadonlyArray<string>): Home | null => {
  const [first, second] = segments

  if (first === "orgs") {
    return second === undefined || second === ""
      ? null
      : { kind: "organisation", org: second }
  }

  if (first === undefined || second === undefined || first === "" || second === "") return null
  if (NOT_AN_OWNER.has(first.toLowerCase())) return null

  return { kind: "repository", owner: first, repo: second }
}

/**
 * Reads a repository's discussion list out of an address, or nothing where the address is not
 * one.
 *
 * Two shapes and no more. Three segments ending in `discussions` is the whole list, and five
 * with `categories` fourth is one category of it. `/discussions/new` is the form for raising
 * one and `/discussions/2137` is a thread, and both are three or four segments that this has to
 * refuse rather than read as a list of nothing.
 */
export const discussionListIn = (url: string): Option.Option<DiscussionList> => {
  const found = segmentsIn(url)
  if (Option.isNone(found)) return Option.none()

  const segments = found.value
  const [, , third, fourth, fifth] = segments
  const home = homeIn(segments)
  if (home === null || third !== "discussions") return Option.none()

  const category =
    segments.length === 3
      ? Option.none<string>()
      : segments.length === 5 && fourth === "categories" && fifth !== undefined && fifth !== ""
        ? Option.some(decodeURIComponent(fifth))
        : null

  // `null` is this function's word for "three or five segments, and not either of the two
  // shapes above" — a thread, the raise form, or something GitHub has not shipped yet.
  if (category === null) return Option.none()

  const address = URL.parse(url)
  const search = address === null ? new URLSearchParams() : address.searchParams

  return Option.some({
    home,
    category,
    query: search.get("discussions_q") ?? "",
    page: pageIn(search)
  })
}

/**
 * Reads one discussion's address, or nothing where the address is not one.
 *
 * The number is refused unless it is one. `/discussions/new` is the raise form and would
 * otherwise be read as discussion `NaN`, which is a page that draws a failure where GitHub
 * draws a form.
 */
export const discussionIn = (url: string): Option.Option<DiscussionRef> => {
  const found = segmentsIn(url)
  if (Option.isNone(found)) return Option.none()

  const segments = found.value
  if (segments.length !== 4) return Option.none()

  const [, , third, fourth] = segments
  const home = homeIn(segments)
  if (home === null || third !== "discussions" || fourth === undefined) return Option.none()

  // Their own numbers, and nothing else: `Number("12abc")` is NaN and `Number("")` is 0, so both
  // fall out here rather than reaching a read as an address GitHub will answer 404 to.
  if (!/^\d+$/.test(fourth)) return Option.none()
  const number = Number(fourth)
  if (!Number.isSafeInteger(number) || number < 1) return Option.none()

  return Option.some({ home, number })
}

/** Where one discussion is, which is the address this interface stands on. */
export const addressOf = (reference: DiscussionRef): string =>
  `${homePath(reference.home)}/discussions/${reference.number}`

/**
 * The whole address of one page of a list: the repository, the category, the search and the
 * page.
 *
 * Written once and read by three. The gateway asks GitHub at it, the store keeps the answer
 * under it, and the screen tells one visit from another by it. Those were three strings before,
 * and the third was a hand-made join whose separator could appear inside a search — so a
 * category with no query and a query that began with the category's name were one name.
 *
 * The inverse of {@link discussionListIn}, and the two are tested against each other: an address
 * this writes reads back as the list it was written from.
 */
export const listRouteOf = (list: DiscussionList): string =>
  `${homePath(list.home)}${listWithinHome(list)}`

/**
 * The same address with the repository or organisation taken off the front.
 *
 * The half a read of one of GitHub's own pages takes, since that read is given the home
 * separately. Its own function rather than a slice off {@link listRouteOf}, because cutting a
 * prefix back off a string that was just built is a way of being wrong later.
 */
export const listWithinHome = (list: DiscussionList): string => {
  const path = Option.isSome(list.category)
    ? `/discussions/categories/${encodeURIComponent(list.category.value)}`
    : "/discussions"

  const asked = new URLSearchParams()
  if (list.query !== "") asked.set("discussions_q", list.query)
  if (list.page > firstPage) asked.set("page", String(list.page))

  const search = asked.toString()
  return search === "" ? path : `${path}?${search}`
}
