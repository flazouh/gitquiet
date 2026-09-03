/**
 * A repository's Discussions: the list, one category of it, and one thread.
 *
 * The word this file exists for is Stale. A Question is a discussion in a category that takes
 * answers, and GitHub prints two states on it, Answered and Unanswered. Counted over the first
 * page of eight repositories that run Discussions in earnest on 2026-09-03 — `vercel/next.js`,
 * `tailwindlabs/tailwindcss`, `supabase/supabase`, `vitejs/vite`, `shadcn-ui/ui`, `nuxt/nuxt`,
 * `laravel/framework` and `denoland/deno` — 120 of the 200 rows were Questions, 22 of those were
 * answered, 94 had somebody's reply in them and nothing marked, and 4 had no reply at all.
 *
 * So Unanswered is two states wearing one word, and the larger of the two by a factor of
 * twenty-three. One needs a person to write an answer. The other needs the person who asked to
 * point at an answer that is already sitting there. See `docs/spec/discussions.md`.
 */

import { Option } from "effect"
import { COURTS } from "./attention"
import { NOT_AN_OWNER } from "./repoHome"
import type { Court } from "./workingSet"

/**
 * A discussion's address, which is a repository and a number.
 *
 * Its own type for the reason `IssueRef` is its own type rather than a `PullRequestRef`: the
 * three fields are the same three, the page is at `/discussions/` rather than `/issues/` or
 * `/pull/`, and sharing one type would put a link to a discussion one careless template literal
 * away from a link to whatever else carries that number.
 */
export type DiscussionRef = {
  readonly owner: string
  readonly repo: string
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
export type Emoji =
  | { readonly kind: "none" }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "image"; readonly url: string; readonly name: string }

/**
 * The category a discussion was asked in, as their row prints it.
 *
 * The emoji is theirs and is carried rather than mapped to an Octicon. A maintainer chose it,
 * it is the only thing on GitHub's own row that separates a Poll from a support question at a
 * glance, and there is no icon in the set that means "Turbopack error report".
 */
export type Category = {
  readonly name: string
  /** The last segment of `/discussions/categories/{slug}`, which is what an address takes. */
  readonly slug: string
  readonly emoji: Emoji
}

/**
 * What a discussion is waiting for, which is the fact GitHub has no word for.
 *
 * Four values where GitHub draws three: a filled green check, an outlined grey one, and nothing
 * at all. `stale` is the split of their outlined grey check, and it is 94 of the 98 rows that
 * carry it.
 */
export type Answering =
  /** A Question somebody marked an Answer on. */
  | "answered"
  /** A Question with replies and no Answer. Somebody has to point at one. */
  | "stale"
  /** A Question nobody has replied to at all. Somebody has to write one. */
  | "unanswered"
  /** Not a Question. Its category takes no answers, so there is nothing to be waiting for. */
  | "unanswerable"

/**
 * One discussion as a row, as much of it as a row needs.
 *
 * Every field is on their own list page, so nothing here is absent until a second request
 * lands. `answerable` and `answered` are kept as the two facts their row carries rather than
 * folded into {@link answeringOf} at the edge: the parser's job is to report what the page
 * said, and the conclusion drawn from it belongs to the domain.
 */
export type ListedDiscussion = {
  readonly reference: DiscussionRef
  /**
   * GitHub's own name for it, off the upvote button's id.
   *
   * A number in a repository is not a name GitHub's own writes take. Every mutation on a
   * discussion takes this instead, so a row that can be drawn can also be acted on.
   */
  readonly id: string
  readonly title: string
  readonly url: string
  readonly category: Category
  /** Whether the category takes answers, which is what makes this a Question. */
  readonly answerable: boolean
  /** Whether one of the replies is marked as the Answer. False on anything unanswerable. */
  readonly answered: boolean
  /**
   * Whether somebody closed it, which GitHub added to discussions after answers.
   *
   * Its own field beside {@link ListedDiscussion.answered}, because their row prints both and
   * they are not the same claim. `vercel/next.js` has closed discussions in Ideas, a category
   * that takes no answers at all, and closed Questions that are still unanswered.
   */
  readonly closed: boolean
  readonly locked: boolean
  readonly upvotes: number
  /** Replies of every depth, which is the number their own row prints. */
  readonly comments: number
  readonly author: string
  /** When it was asked, as their `relative-time` carries it. */
  readonly askedAt: string
  /** Everyone their avatar stack names, the author first. */
  readonly participants: ReadonlyArray<string>
}

/**
 * What deciding an Answering and a Court needs, which is less than a whole discussion.
 *
 * The sibling of `workingSet.ts`'s and `issues.ts`'s, and here for the reason theirs are: the
 * rule is one rule, and it is asked twice. A row on the list has these five fields and a
 * discussion's own page has them too, so both are weighed by the same code rather than by two
 * copies of it that drift.
 */
export type Weighing = {
  readonly answerable: boolean
  readonly answered: boolean
  readonly closed: boolean
  readonly locked: boolean
  /** Replies of every depth, which is the number their own row prints. */
  readonly comments: number
}

/**
 * What one discussion is waiting for.
 *
 * Closed and locked are not among the four. Either one finishes a discussion whatever it was
 * waiting for, and that is a Court rather than an Answering: {@link courtOf} reads all three.
 */
export const answeringOf = (one: Weighing): Answering => {
  if (!one.answerable) return "unanswerable"
  if (one.answered) return "answered"
  return one.comments > 0 ? "stale" : "unanswered"
}

/**
 * Which Court a discussion sits in.
 *
 * Needs You is the Stale ones, and on a busy repository it is the biggest group on the screen.
 * That is not a design choice about emphasis; it is the census. A reader who wants their own
 * question rather than the repository's has the category filter and GitHub's own sort, both of
 * which this screen keeps.
 *
 * Running is never returned. No machine works on a discussion: there is no check to run, no
 * build to wait for, and a poll has no closing time to run down to. The Court is left in the
 * vocabulary and off this screen, rather than filled with something that is not a machine
 * working.
 */
export const courtOf = (one: Weighing): Court => {
  // Somebody ended it, or nobody can add to it. Either way nothing is owed on it now, whatever
  // it was waiting for a moment ago. Read before the Answering, because their own rows carry
  // "· Closed · Unanswered" together and the first of those two is the last word.
  if (one.closed || one.locked) return "settled"

  switch (answeringOf(one)) {
    case "stale":
      return "needs-you"
    case "unanswered":
      return "waiting"
    // An answered Question is finished. So is a Show and tell post, an Idea and a Poll: not
    // because the conversation is over, but because nothing is owed, which is what Settled has
    // meant on every other screen of this product.
    case "answered":
    case "unanswerable":
      return "settled"
  }
}

/** Where a repository's discussions are, and one category of them. */
export const listAddressOf = (
  repo: { readonly owner: string; readonly repo: string },
  category: Option.Option<string> = Option.none()
): string =>
  Option.isSome(category)
    ? `/${repo.owner}/${repo.repo}/discussions/categories/${encodeURIComponent(category.value)}`
    : `/${repo.owner}/${repo.repo}/discussions`

/**
 * A repository's discussion list — `/{owner}/{repo}/discussions`, and one category of it.
 *
 * The category is part of the address rather than part of the query, unlike everything else a
 * reader can narrow this list by. GitHub keeps both: `?discussions_q=category:"Help"` and
 * `/discussions/categories/help` list the same rows, and their own sidebar links the second.
 */
export type DiscussionList = {
  readonly repo: { readonly owner: string; readonly repo: string }
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
 * Whether the first two segments are a repository rather than one of GitHub's own pages.
 *
 * `/orgs/community/discussions` is the shape this refuses, and it is not a hypothetical: it is
 * where GitHub's own product feedback lives, so it is a page a reader of this extension opens.
 * An organisation's discussions are a different screen with a different spec, and reading
 * `orgs/community` as a repository would take over that page with a list of nothing.
 */
const isRepo = (owner: string | undefined, repo: string | undefined): owner is string =>
  owner !== undefined &&
  repo !== undefined &&
  owner !== "" &&
  repo !== "" &&
  !NOT_AN_OWNER.has(owner.toLowerCase())

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
  const [owner, repo, third, fourth, fifth] = segments
  if (!isRepo(owner, repo) || repo === undefined) return Option.none()
  if (third !== "discussions") return Option.none()

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
    repo: { owner, repo },
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

  const [owner, repo, third, fourth] = segments
  if (!isRepo(owner, repo) || repo === undefined) return Option.none()
  if (third !== "discussions" || fourth === undefined) return Option.none()

  // Their own numbers, and nothing else: `Number("12abc")` is NaN and `Number("")` is 0, so both
  // fall out here rather than reaching a read as an address GitHub will answer 404 to.
  if (!/^\d+$/.test(fourth)) return Option.none()
  const number = Number(fourth)
  if (!Number.isSafeInteger(number) || number < 1) return Option.none()

  return Option.some({ owner, repo, number })
}

/** Where one discussion is, which is the address this interface stands on. */
export const addressOf = (reference: DiscussionRef): string =>
  `/${reference.owner}/${reference.repo}/discussions/${reference.number}`

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
  `/${list.repo.owner}/${list.repo.repo}${listWithinRepo(list)}`

/**
 * The same address with the repository taken off the front.
 *
 * The half a read of one of GitHub's own repository pages takes, since that read is given the
 * repository separately. Its own function rather than a slice off {@link listRouteOf}, because
 * cutting a prefix back off a string that was just built is a way of being wrong later.
 */
export const listWithinRepo = (list: DiscussionList): string => {
  const path = Option.isSome(list.category)
    ? `/discussions/categories/${encodeURIComponent(list.category.value)}`
    : "/discussions"

  const asked = new URLSearchParams()
  if (list.query !== "") asked.set("discussions_q", list.query)
  if (list.page > firstPage) asked.set("page", String(list.page))

  const search = asked.toString()
  return search === "" ? path : `${path}?${search}`
}

/**
 * The Courts a repository's discussions have, which is three of the product's four.
 *
 * Taken out of the four rather than written again, so the order a reader learns on every other
 * screen is the order here.
 *
 * Running is the one left out, and it is left out for the reason the inbox leaves it out:
 * {@link courtOf} cannot return it on any discussion, ever. Elsewhere an empty Court is drawn
 * anyway, because a reader finds Settled by where it sits and a heading that came and went with
 * the day's rows would take that away. That argument is about a Court which is empty this
 * morning and full this afternoon. A heading nothing can ever reach teaches the reader instead
 * that a heading may mean nothing.
 */
export const DISCUSSION_COURTS: ReadonlyArray<Court> = COURTS.filter((court) => court !== "running")

/** One Court of a repository's discussions, and the rows filed in it. */
export type Docket = {
  readonly court: Court
  readonly discussions: ReadonlyArray<ListedDiscussion>
  readonly count: number
}

/**
 * Every row in three piles, in the order a reader asks about them.
 *
 * GitHub's own order is kept inside each pile. They sorted the page, the reader may have sorted
 * it themselves with `sort:top`, and re-sorting it here would throw away an answer somebody
 * asked for. What this changes is which rows sit together, and nothing else.
 *
 * All three come back even where two are empty: "Nothing." under a heading is worth more than a
 * heading that moves.
 */
export const docketsOf = (rows: ReadonlyArray<ListedDiscussion>): ReadonlyArray<Docket> =>
  DISCUSSION_COURTS.map((court) => {
    const held = rows.filter((one) => courtOf(one) === court)
    return { court, discussions: held, count: held.length }
  })

/**
 * One reply, under one comment.
 *
 * Its own type rather than a comment that happens to have no replies, because GitHub allows
 * exactly one level of nesting: a reply cannot be replied to, and a type that let it would be a
 * type describing a page that cannot exist.
 */
export type Reply = {
  /** GitHub's own name for it, which is what a permalink and every write take. */
  readonly id: string
  readonly author: string
  readonly at: string
  /** Their rendered markdown, as they served it. */
  readonly body: string
  readonly upvotes: number
  /**
   * Whether this is the marked Answer.
   *
   * On a reply as well as on a comment, because the page says so per comment and this reads what
   * the page says. Whether GitHub lets anybody mark a reply is their rule to change, and a read
   * that assumed the answer was always top-level would lose it on the day they do.
   */
  readonly isAnswer: boolean
}

/** One comment on a discussion, and the replies underneath it. */
export type Comment = Reply & {
  readonly replies: ReadonlyArray<Reply>
}

/**
 * One discussion, whole: what was asked, what everybody said, and which of it was the answer.
 *
 * One read. Their own page is served by Rails with the body and every comment already in it, so
 * unlike a pull request's six requests there is nothing here to defer.
 */
export type DiscussionSnapshot = {
  readonly reference: DiscussionRef
  /** GitHub's own name for the discussion, which every write takes instead of the number. */
  readonly id: string
  readonly title: string
  readonly category: Category
  readonly answerable: boolean
  readonly answered: boolean
  readonly closed: boolean
  readonly locked: boolean
  readonly upvotes: number
  readonly author: string
  readonly askedAt: string
  /** Their rendered markdown for the opening post. */
  readonly body: string
  readonly comments: ReadonlyArray<Comment>
}

/**
 * Every comment of every depth, which is the number a Court is weighed against.
 *
 * Counted rather than taken from a field, because the page never prints one number for it: their
 * header says "6 comments · 3 replies" and their own list row says 9.
 */
export const spokenOn = (snapshot: DiscussionSnapshot): number =>
  snapshot.comments.reduce((sum, one) => sum + 1 + one.replies.length, 0)

/**
 * The five fields the Answering and the Court are decided from, out of a whole discussion.
 *
 * So the page and the row are weighed by one rule. A discussion drawn as Stale on the list and
 * as something else on its own page would be two answers to one question, and the reader would
 * have to decide which of the two screens to believe.
 */
export const weighingOf = (snapshot: DiscussionSnapshot): Weighing => ({
  answerable: snapshot.answerable,
  answered: snapshot.answered,
  closed: snapshot.closed,
  locked: snapshot.locked,
  comments: spokenOn(snapshot)
})

/**
 * The marked Answer, wherever in the thread it is.
 *
 * Looked for among the replies as well as among the comments, for the reason {@link Reply} gives
 * about `isAnswer`. Nothing where none is marked, which is 94 of the 98 unanswered Questions
 * counted across eight repositories.
 */
export const answerOf = (snapshot: DiscussionSnapshot): Option.Option<Reply> => {
  for (const one of snapshot.comments) {
    if (one.isAnswer) return Option.some(one)

    const below = one.replies.find((reply) => reply.isAnswer)
    if (below !== undefined) return Option.some(below)
  }

  return Option.none()
}
