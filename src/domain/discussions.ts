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
import type { RepoRef } from "./PullRequestRef"
import { NOT_AN_OWNER } from "./repoHome"
import { asked, termsIn, toggling } from "./sieve"
import type { Court } from "./workingSet"

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
  /**
   * Whatever a maintainer labelled it, in the order their row prints them.
   *
   * Carried because a label is how a maintainer triages, and a row without one loses the only
   * thing on it that somebody put there on purpose. One of the twenty-five rows recorded here
   * has one, which is what a label list looks like on a real repository.
   */
  readonly labels: ReadonlyArray<string>
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
  /** Their rendered markdown, as they served it. Empty on a comment GitHub is hiding. */
  readonly body: string
  /**
   * Their own sentence for a comment they have folded away, or nothing for an ordinary one.
   *
   * "This comment was marked as off-topic." and its handful of siblings. GitHub serves neither
   * the author nor the words of one of these, so a read that ignored the state drew eight empty
   * rows on `orgs/community#88425` — which is a thread of thirty comments where eight have been
   * moderated.
   */
  readonly hiddenAs: string
  readonly upvotes: number
  /** The faces on it, in the order their page drew them. Empty where nobody has reacted. */
  readonly reactions: ReadonlyArray<Reaction>
  /**
   * Whether GitHub offered this reader a press to mark it, or to take the mark off.
   *
   * Read off their own page rather than worked out from a permission: the control is on the page
   * when the reader may use it and absent when they may not, and that is a fact rather than a
   * conclusion. See `discussionForms.ts`.
   */
  readonly mayMarkAnswer: boolean
  /** Whether GitHub offered this reader a vote on it. False for everyone who is signed out. */
  readonly mayUpvote: boolean
  /**
   * Whether this is the marked Answer.
   *
   * On a reply as well as on a comment, because the page says so per comment and this reads what
   * the page says. Whether GitHub lets anybody mark a reply is their rule to change, and a read
   * that assumed the answer was always top-level would lose it on the day they do.
   */
  readonly isAnswer: boolean
}

/**
 * One of the eight faces, and how many people put it there.
 *
 * Apart from an upvote, which GitHub keeps apart too: a discussion's upvote is a rank and a
 * reaction is an opinion. Their own page draws them side by side and counts them separately.
 */
export type Reaction = {
  /** GitHub's own name for it, which is what a press sends: `+1`, `heart`, `rocket`. */
  readonly content: string
  /** The character their page drew, so this interface draws the same one. */
  readonly emoji: string
  readonly count: number
  /** Whether this reader is one of them. */
  readonly mine: boolean
  /** Whether GitHub offered this reader a press on it. */
  readonly mayPress: boolean
}

/**
 * One way to answer a Poll, and how many people took it.
 *
 * The share is the number their own page prints beside the option rather than one worked out
 * from the votes. They round it, they round it their way, and a second arithmetic here would
 * disagree with the page a reader has just come from.
 */
export type PollOption = {
  /** GitHub's own id for the option, which is what a vote sends. */
  readonly id: string
  readonly name: string
  /** Their percentage, 0 to 100. */
  readonly share: number
  /** Whether this reader took it. Only ever true on a page GitHub served to somebody signed in. */
  readonly chosen: boolean
}

/**
 * A Poll, which is a discussion whose body carries one.
 *
 * Its own field on the snapshot rather than left inside the body's markup. Their page puts it in
 * a table cell after the comment body, so drawing the body alone would drop it, and drawing the
 * cell as body would hand a reader a poll they cannot vote in.
 *
 * A Poll never closes on its own. That is why Running is empty on the list beside this: there is
 * no clock anywhere in this, and nothing is running down.
 */
export type Poll = {
  readonly question: string
  readonly options: ReadonlyArray<PollOption>
  /** How many people have answered, as their footer counts it. */
  readonly votes: number
  /** Whether GitHub says nobody may answer any more. */
  readonly locked: boolean
  /**
   * Where a vote is sent, off their own `data-vote-url`.
   *
   * Their markup names the route, so this is the one write on this screen that guesses at
   * nothing at all: the address, the field and the value are all on the page.
   */
  readonly voteUrl: string
  /** The name their radio group carries, which is GitHub's id for the poll itself. */
  readonly field: string
  /** Whether GitHub offered this reader a way to answer it. */
  readonly mayVote: boolean
}

/** One comment on a discussion, and the replies underneath it. */
export type Comment = Reply & {
  readonly replies: ReadonlyArray<Reply>
  /** Whether GitHub offered this reader a box to reply under it. */
  readonly mayReply: boolean
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
  /** The faces on the question itself. */
  readonly reactions: ReadonlyArray<Reaction>
  readonly comments: ReadonlyArray<Comment>
  /** The Poll their body carries, where the discussion is one. */
  readonly poll: Option.Option<Poll>
  /**
   * What GitHub offered this reader on this page.
   *
   * Every one of these is the presence of one of their own forms. A reader who is not signed in
   * gets none of them, and so does a locked discussion and an archived repository — which is why
   * this is read rather than derived from `locked` and a login.
   */
  readonly allowed: {
    readonly say: boolean
    readonly upvote: boolean
  }
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

/**
 * One press of the filter bar, as the terms it puts in their own search.
 *
 * Terms and not a state of this screen's own, so that pressing one writes an address a reader
 * can copy, send and come back to, and so that GitHub does the filtering across every page
 * rather than this screen filtering the twenty-five rows it happens to hold.
 */
export type Chip = {
  readonly name: string
  /** Their own vocabulary, all of it put in together and all of it taken out together. */
  readonly terms: ReadonlyArray<string>
  /**
   * Chips that answer the same question, at most one of which can be on.
   *
   * Sorting is the plain case: `sort:top` and `sort:date_created` are two answers to one
   * question, and a line carrying both is a line GitHub reads the last of.
   */
  readonly group?: string
}

/**
 * The filter bar, in the order a reader asks these questions.
 *
 * Stale is the first of them and it is not a term GitHub has. It is two terms GitHub does have,
 * and the pairing is the whole point: `is:unanswered` alone is 98 of the 120 Questions counted
 * across eight repositories, and 94 of those already have somebody's reply in them. Adding
 * `comments:>0` cuts the 98 to the 94 that a person can finish by pointing at what is already
 * there — server-side, across every page, rather than over the twenty-five rows on this one.
 *
 * Measured on 2026-09-03 against `vercel/next.js`: `comments:0` answered rows whose counts were
 * all zero and `comments:>5` answered rows whose counts were all above five, so the qualifier is
 * real on this route and not merely accepted.
 */
export const CHIPS: ReadonlyArray<Chip> = [
  { name: "Stale", terms: ["is:unanswered", "comments:>0"], group: "answering" },
  { name: "Unanswered", terms: ["is:unanswered"], group: "answering" },
  { name: "Answered", terms: ["is:answered"], group: "answering" },
  { name: "Open", terms: ["is:open"], group: "standing" },
  { name: "Closed", terms: ["is:closed"], group: "standing" },
  { name: "Top", terms: ["sort:top"], group: "order" },
  { name: "Newest", terms: ["sort:date_created"], group: "order" }
]

/** Whether every term of a chip is already in the line, so the chip is on. */
export const asking = (typed: string, chip: Chip): boolean =>
  chip.terms.every((term) => asked(typed, term))

/**
 * The line with a chip pressed: all of its terms in, or all of them out.
 *
 * Pressing one on takes off whichever chip of the same group was on, because those are answers
 * to one question. Everything else the reader typed is left exactly where they typed it.
 */
export const toggled = (typed: string, chip: Chip): string => {
  if (asking(typed, chip)) {
    return chip.terms.reduce((line, term) => toggling(line, term), typed)
  }

  const others = CHIPS.filter(
    (one) => one !== chip && one.group !== undefined && one.group === chip.group
  )

  const cleared = others
    .flatMap((one) => one.terms)
    .reduce((line, term) => (asked(line, term) ? toggling(line, term) : line), typed)

  return chip.terms.reduce((line, term) => (asked(line, term) ? line : toggling(line, term)), cleared)
}

/**
 * Whatever the reader typed that is not one of the chips' terms.
 *
 * What the search box holds. Kept apart so that pressing a chip does not appear in the box as
 * text the reader has to delete by hand, and so that typing in the box does not take a chip off.
 */
export const wordsIn = (typed: string): string => {
  const owned = new Set(CHIPS.flatMap((chip) => chip.terms).map((term) => term.toLowerCase()))
  return termsIn(typed)
    .filter((term) => !owned.has(term.toLowerCase()))
    .join(" ")
}

/** The line with the reader's own words replaced and every chip left where it was. */
export const asWordsGo = (typed: string, words: string): string => {
  const owned = new Set(CHIPS.flatMap((chip) => chip.terms).map((term) => term.toLowerCase()))
  const chips = termsIn(typed).filter((term) => owned.has(term.toLowerCase()))

  return [...chips, ...termsIn(words)].join(" ")
}

/**
 * Something a reader does to a discussion, as the four presses their page offers.
 *
 * One type and not four methods on the port, because they are one act from the gateway's side:
 * find the form GitHub put on the page for this, add whatever the reader typed, send it back.
 * What differs between them is which form, and that is a line of code rather than a method.
 */
export type DiscussionPress =
  /** Say something on the discussion itself. */
  | { readonly kind: "say"; readonly body: string }
  /** Reply under one comment, which is the one level of nesting GitHub allows. */
  | { readonly kind: "reply"; readonly comment: string; readonly body: string }
  /** Mark one comment as the Answer, which is the press this whole screen exists for. */
  | { readonly kind: "mark-answer"; readonly comment: string }
  /** Answer a Poll, by the option's own id. */
  | { readonly kind: "vote"; readonly option: string }
  /** Put one of the eight faces on something, or take it off again. */
  | {
      readonly kind: "react"
      readonly on: "Discussion" | "DiscussionComment"
      readonly id: string
      /** GitHub's own name for the face: `+1`, `heart`, `rocket`. */
      readonly content: string
    }
  /** Upvote the question, or something said about it. */
  | {
      readonly kind: "upvote"
      readonly on: "Discussion" | "DiscussionComment"
      /** GitHub's own name for whichever of the two it is. */
      readonly id: string
    }
