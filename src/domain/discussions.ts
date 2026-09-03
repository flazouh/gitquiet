/**
 * The Discussions surface: every address it has, and the rules over it that need
 * nothing of GitHub's markup.
 *
 * `docs/spec/discussions.md` is the whole of why this exists and what is still
 * missing. The short of it: a discussion can be owed to somebody exactly as an
 * issue can — a question nobody answered, an answer nobody read — and it is the
 * one kind of work in this codebase with no Court, because GitHub gives it no
 * list. There is no `/discussions` for a signed-in person, no dashboard tab, and
 * no filter on either dashboard that would make one.
 *
 * What is here is the half of that which can be written honestly from where it was
 * written: the addresses, which are public and stable, and four folds over facts
 * a read will carry. What is not here is every parser, because no discussions page
 * could be fetched to write one against — see the spec's last section, which says
 * what to capture and in what order to build.
 */

import { Option } from "effect"
import type { RepoRef } from "./PullRequestRef"
import type { Court } from "./workingSet"

/**
 * A discussion's address: a repository and a number.
 *
 * A third type with the same three fields as {@link RepoRef} plus a number, for
 * the reason `IssueRef` is a third rather than a reuse of `PullRequestRef`. The
 * pages are `/pull/`, `/issues/` and `/discussions/`, and a shared type is one
 * careless template literal away from linking to whichever of the three the
 * number happens to also name — which on GitHub it very often does, because
 * issues, pull requests and discussions of one repository are numbered from
 * three separate sequences and collide constantly.
 */
export type DiscussionRef = {
  readonly owner: string
  readonly repo: string
  readonly number: number
}

/**
 * An organisation's discussions, which are the same two pages with an
 * organisation where a repository goes.
 *
 * Its own type rather than a `RepoRef` with a made-up repository, because there
 * is no repository: `/orgs/community/discussions/10369` names none, and a
 * `{ owner: "community", repo: "" }` handed to anything expecting a repository
 * builds an address with two slashes in it.
 */
export type OrgDiscussionRef = {
  readonly org: string
  readonly number: number
}

/**
 * A repository's list, and where in it the reader is.
 *
 * `discussions_q` rather than `q`: the surface has a query language of its own,
 * overlapping issue search without being it, and this carries whatever was in the
 * box unread and unedited for the reason `IssueList.query` does — the vocabulary
 * is theirs, it is large, and it grows.
 *
 * The category is separate from the query even though their own filter can express
 * one either way, because the two arrive by different routes: `/discussions/categories/q-a`
 * is a page a reader reached from the sidebar, and `category:Q&A` inside the query is
 * something they typed. Read as one field, a press of the sidebar would be indistinguishable
 * from a search, and the heading would have to guess which it was looking at.
 */
export type DiscussionList = {
  readonly repo: RepoRef
  /** The slug from `/categories/{slug}`, and nothing where the list is every category. */
  readonly category: Option.Option<string>
  readonly query: string
}

const HOST = "github.com"

/**
 * The one first segment that looks like an owner and is not one.
 *
 * `/orgs/community/discussions` has the shape of a repository's list exactly —
 * three segments ending in `discussions` — and is an organisation's, which is a
 * different page with a different read behind it. Nowhere else on GitHub can a
 * person be called this: `orgs` is theirs, and an account cannot be named it.
 *
 * A refusal rather than an ordering, so that the two parsers below can be asked in
 * either order and neither can answer for the other's page.
 */
const THEIRS = "orgs"

const isRepository = (owner: string): boolean => owner !== THEIRS

/** The path, in segments, for a GitHub address — and nothing for anywhere else. */
const segmentsOf = (url: string): Option.Option<ReadonlyArray<string>> => {
  // `URL.parse` rather than the constructor: an address that is not one is an
  // ordinary answer here, not an exception to be caught.
  const address = URL.parse(url)
  if (address === null || address.hostname !== HOST) return Option.none()

  return Option.some(address.pathname.split("/").filter((part) => part.length > 0))
}

/** The query their filter box writes, or the empty string where it wrote none. */
const queryIn = (url: string): string =>
  Option.getOrElse(
    Option.fromNullishOr(URL.parse(url)?.searchParams.get("discussions_q")),
    () => ""
  )

/**
 * A number GitHub could have given out, out of what an address said.
 *
 * Zero is the one string that parses and cannot be a discussion, and it is what a
 * hand-edited address and a stray slash both come to.
 */
const numbered = (said: string): Option.Option<number> => {
  if (!/^\d+$/.test(said)) return Option.none()

  const number = Number.parseInt(said, 10)
  return number < 1 ? Option.none() : Option.some(number)
}

/**
 * A repository's discussions list, or nothing where the address is not one.
 *
 * Three segments for the whole list, five for one category. The refusals matter
 * more on this surface than on the issues one: `new` and `categories` sit exactly
 * where a number sits, so a parser that took "the segment after `discussions`" as
 * an address would claim the form and the category page as discussion 0.
 */
export const discussionListIn = (url: string): Option.Option<DiscussionList> => {
  const found = segmentsOf(url)
  if (Option.isNone(found)) return Option.none()

  const segments = found.value
  const [owner, repo, discussions, categories, slug] = segments
  if (owner === undefined || repo === undefined || discussions !== "discussions") {
    return Option.none()
  }
  if (!isRepository(owner)) return Option.none()

  if (segments.length === 3) {
    return Option.some({ repo: { owner, repo }, category: Option.none(), query: queryIn(url) })
  }

  if (segments.length === 5 && categories === "categories" && slug !== undefined) {
    return Option.some({
      repo: { owner, repo },
      category: Option.some(slug),
      query: queryIn(url)
    })
  }

  return Option.none()
}

/**
 * One discussion's own page, and nothing else under `/discussions`.
 *
 * Takes a pathname rather than a URL, as `issues.ts` does, because its callers
 * hold one: the comment an address names is an anchor, and an anchor is not part
 * of what decides which page this is.
 */
const DISCUSSION_PATH = /^\/([^/]+)\/([^/]+)\/discussions\/(\d+)\/?$/

export const discussionIn = (pathname: string): Option.Option<DiscussionRef> => {
  const match = DISCUSSION_PATH.exec(pathname)
  if (match === null) return Option.none()

  const [, owner, repo, said] = match
  if (owner === undefined || repo === undefined || said === undefined) return Option.none()
  if (!isRepository(owner)) return Option.none()

  return Option.map(numbered(said), (number) => ({ owner, repo, number }))
}

/** The form, and the category it was opened with where their link named one. */
export type Raising = {
  readonly repo: RepoRef
  readonly category: Option.Option<string>
}

const NEW_PATH = /^\/([^/]+)\/([^/]+)\/discussions\/new\/?$/

export const raisingDiscussionIn = (url: string): Option.Option<Raising> => {
  const address = URL.parse(url)
  if (address === null || address.hostname !== HOST) return Option.none()

  const match = NEW_PATH.exec(address.pathname)
  if (match === null) return Option.none()

  const [, owner, repo] = match
  if (owner === undefined || repo === undefined || !isRepository(owner)) return Option.none()

  return Option.some({
    repo: { owner, repo },
    category: Option.fromNullishOr(address.searchParams.get("category"))
  })
}

/**
 * An organisation's list — `/orgs/{org}/discussions` — or nothing.
 *
 * The same page as a repository's with one thing missing, and the thing missing is
 * the repository. `orgs/community/discussions` is where GitHub's own users report
 * what is wrong with GitHub, including with this surface, which is why it is here
 * rather than left for later: it is the busiest instance of the page in existence.
 */
export const orgDiscussionListIn = (url: string): Option.Option<string> => {
  const found = segmentsOf(url)
  if (Option.isNone(found)) return Option.none()

  const [orgs, org, discussions] = found.value
  if (found.value.length !== 3 || orgs !== "orgs" || discussions !== "discussions") {
    return Option.none()
  }

  return Option.fromNullishOr(org)
}

const ORG_DISCUSSION_PATH = /^\/orgs\/([^/]+)\/discussions\/(\d+)\/?$/

export const orgDiscussionIn = (pathname: string): Option.Option<OrgDiscussionRef> => {
  const match = ORG_DISCUSSION_PATH.exec(pathname)
  if (match === null) return Option.none()

  const [, org, said] = match
  if (org === undefined || said === undefined) return Option.none()

  return Option.map(numbered(said), (number) => ({ org, number }))
}

/** Where a press on a discussion goes, which is GitHub's own page for it. */
export const pageOf = (reference: DiscussionRef): string =>
  `/${reference.owner}/${reference.repo}/discussions/${reference.number}`

/** The same for an organisation's, which has no repository in it. */
export const orgPageOf = (reference: OrgDiscussionRef): string =>
  `/orgs/${reference.org}/discussions/${reference.number}`

/** One comment of a discussion, by the anchor GitHub gives it. */
export const commentAt = (reference: DiscussionRef, comment: number): string =>
  `${pageOf(reference)}#discussioncomment-${comment}`

/**
 * What deciding a discussion's Court needs, which is less than the discussion.
 *
 * Every field is a fact somebody answered rather than a conclusion, in the shape
 * `Weighing` next door in `issues.ts` has: the rule below is the only place any
 * of it is weighed, so it can be read in one screen and tested without a network.
 */
export type Standing = {
  /** Whether the reader is the one who asked. */
  readonly askedByViewer: boolean
  /** Whether its Category takes an Answer at all — a Q&A category, in their words. */
  readonly answerable: boolean
  /** Whether somebody entitled to say so has marked one. */
  readonly answered: boolean
  /** Closed, however it was closed: resolved, outdated, duplicate. */
  readonly closed: boolean
  /**
   * Who said the last thing. `nobody` is a discussion with no comments at all,
   * which is not the same as one the reader spoke last on and is the commonest
   * state of an unanswered question.
   */
  readonly lastSpeaker: "viewer" | "someone-else" | "nobody"
  /** Whether the reader may mark an answer here, which is write access in their terms. */
  readonly maintainer: boolean
}

/**
 * Which Court a discussion sits in.
 *
 * Never `running`. Nothing on this surface is waited on by a machine — there are no
 * checks, no merge queue and no build — so the Court that exists because nobody can
 * be asked to hurry has nothing to hold here. Three of the four, and a discussion
 * that would land in the fourth is a bug in this function rather than a state.
 *
 * The order of the rules is the whole of the content:
 *
 * Closed first, because it overrules everything else for the reason a closed issue
 * does — a read is a snapshot of a moment, and a discussion closed since owes nobody
 * anything whatever else was true of it.
 *
 * A marked Answer settles a Question next. This is the one place the surface has a
 * fact meaning "the thing this wanted has happened", and honouring it is the reason
 * to keep `answerable` and `answered` as two fields rather than a tri-state: a
 * discussion in a category that takes no Answer is not unanswered, it is not the
 * kind of thing that has one, and a rule that read the two as one would put every
 * announcement ever posted into somebody's Court forever.
 *
 * Then the reader's own question with somebody else's words under it, which is the
 * move this whole surface most reliably loses: an answer arrived, the notification
 * was read weeks ago, and nothing anywhere still says the reader has not come back
 * to it. This is `needs-you` even where an Answer is not possible, because reading
 * a reply to your own question is a move whoever asked owes.
 *
 * Then an unanswered Question in a repository the reader can answer for. That is a
 * maintainer's backlog, and it is the second half of the same complaint: the person
 * who could end it is the one person GitHub never tells.
 *
 * Everything else waits. Being mentioned in somebody else's thread is being asked to
 * read, and reading is not a move this interface can watch anybody make — the same
 * judgement `COURT_OF_INVOLVEMENT` makes for a mentioned issue, made here for the
 * same reason.
 */
export const courtOfDiscussion = (standing: Standing): Court => {
  if (standing.closed) return "settled"
  if (standing.answerable && standing.answered) return "settled"
  if (standing.askedByViewer && standing.lastSpeaker === "someone-else") return "needs-you"
  if (!standing.askedByViewer && standing.maintainer && standing.answerable && !standing.answered) {
    return "needs-you"
  }

  return "waiting"
}

/** As much of a listed discussion as any count here reads. */
export type Counted = {
  readonly category: string
  readonly answerable: boolean
  readonly answered: boolean
  readonly closed: boolean
}

/**
 * The open questions nobody has answered, out of a page of rows.
 *
 * The number their own list cannot give: their pager is a cursor with Newer and
 * Older on it, so a narrowed list of twenty-five rows looks the same at 25 as at
 * 2,500. This counts what was read, which is honest about being a page rather than
 * a total — a screen saying "25 of the 25 read" is a different and truer sentence
 * than a screen saying nothing.
 *
 * Closed rows are not unanswered. A question closed as outdated was disposed of,
 * and counting it as backlog is how a backlog stops being worked.
 */
export const unansweredAmong = (rows: ReadonlyArray<Counted>): number =>
  rows.filter((row) => row.answerable && !row.answered && !row.closed).length

/**
 * The same count per category, in the order the categories were first met.
 *
 * Per category because that is the number a maintainer acts on, and the sidebar —
 * the one place per-category numbers could go — spends that space on the total.
 * Categories that take no Answer are absent rather than present with a zero, which
 * would read as a category somebody had cleared.
 */
export const perCategory = (
  rows: ReadonlyArray<Counted>
): ReadonlyArray<{ readonly category: string; readonly unanswered: number }> => {
  const tally = new Map<string, number>()

  for (const row of rows) {
    if (!row.answerable) continue

    const owed = !row.answered && !row.closed
    tally.set(row.category, (tally.get(row.category) ?? 0) + (owed ? 1 : 0))
  }

  return [...tally].map(([category, unanswered]) => ({ category, unanswered }))
}

/**
 * The agreements, which are the whole text of what people write to say "this too".
 *
 * Matched as a set of exact phrases rather than by a pattern over words, and that
 * choice is the safety in this: a rule that folded anything *containing* "+1" would
 * fold a comment reporting that a counter went up by one, and a rule over word
 * counts would fold "the fix is `--legacy-peer-deps`". What is here can only ever
 * fold something that says nothing else.
 */
const AGREEMENTS: ReadonlyArray<string> = [
  "+1",
  "1",
  "same",
  "same here",
  "same issue",
  "same issue here",
  "same problem",
  "same problem here",
  "me too",
  "this",
  "this too",
  "any update",
  "any updates",
  "any update on this",
  "any updates on this",
  "any news",
  "following",
  "subscribing",
  "watching",
  "bump",
  "still an issue",
  "still happening",
  "still waiting"
]

/**
 * What a comment says with everything that is not words taken off it.
 *
 * Emoji, punctuation and case all go, because "+1!!!", "Same here 👍" and "SAME
 * HERE." are one comment written three ways: the last rule keeps letters, digits
 * and the plus sign, and everything else on the keyboard and off it becomes a
 * space. Markdown is not parsed — anything with a fence, a link or an image in it
 * is refused whole by {@link isMeToo} before this is consulted.
 *
 * The shortcodes go first and whole, because that rule cannot do them: it would
 * leave `:smile:` behind as the word "smile", and "same :smile:" would then read
 * as two words and match nothing.
 */
const said = (body: string): string =>
  body
    .replace(/:[a-z0-9_+-]+:/gi, " ")
    .replace(/[^a-z0-9+]+/gi, " ")
    .trim()
    .toLowerCase()

/** The longest a Me Too may be before it is treated as content, in characters. */
const SHORT = 40

/**
 * Whether a comment's whole text is agreement.
 *
 * Three locks, and each one is there to keep something. The length cap keeps a long
 * comment that happens to open with "same here" and then explains the reader's own
 * case. The refusal of anything carrying a fence, a link, an image or a quote keeps
 * every comment with evidence in it, which is the class this rule would do the most
 * damage by folding. And the phrase set is exact, so what survives both of those is
 * a comment saying nothing else.
 *
 * Wrong in the safe direction by construction: a Me Too this misses is a row on the
 * screen, and a comment this folded wrongly would be a piece of the record taken
 * away. Only the first is allowed to happen.
 */
export const isMeToo = (body: string): boolean => {
  const trimmed = body.trim()
  if (trimmed.length === 0 || trimmed.length > SHORT) return false
  if (/```|~~~|!\[|\]\(|https?:\/\/|^>/m.test(trimmed)) return false

  return AGREEMENTS.includes(said(trimmed))
}

/** As much of a comment as the fold reads. */
export type Comment = {
  readonly id: number
  readonly author: string
  readonly body: string
}

/**
 * A discussion's comments with the agreements taken out of the run and counted.
 *
 * What comes back is the comments that said something, in the order they were
 * written, and the people who agreed. Both halves are kept on purpose: the count is
 * the fact somebody wanted to report by writing "+1" in the first place, and the
 * names are who reported it, so nothing is lost by not drawing thirty rows — which
 * is the only reason this is allowed to fold anything at all.
 *
 * Each person once, in the order they first agreed. Somebody who wrote "+1" and
 * then "any update?" four months later is one person waiting, and counting them
 * twice would overstate the one number this exists to state.
 */
export const collapsedMeToo = (
  comments: ReadonlyArray<Comment>
): {
  readonly said: ReadonlyArray<Comment>
  readonly agreed: ReadonlyArray<string>
} => {
  const kept: Array<Comment> = []
  const agreed: Array<string> = []

  for (const comment of comments) {
    if (!isMeToo(comment.body)) {
      kept.push(comment)
      continue
    }

    if (!agreed.includes(comment.author)) agreed.push(comment.author)
  }

  return { said: kept, agreed }
}

/** As much of a comment as choosing a Working Answer reads. */
export type Weighed = {
  readonly id: number
  readonly author: string
  /** However much agreement it carries: their upvote where there is one, reactions otherwise. */
  readonly agreement: number
}

/**
 * The comment a Question with no marked Answer was probably answered by, or nothing.
 *
 * A **Working Answer** and never an Answer — see the vocabulary in the spec. Marking
 * one is a privilege GitHub gives to the person who asked and to people with write
 * access, so the ordinary life of a question on a large repository is that comment
 * nine answered it, five people said so, the asker never came back, and the page is
 * indistinguishable from a question nobody answered. Everything needed to say which
 * comment worked is already rendered on it.
 *
 * Two conditions, and both are here to make this refuse rather than guess:
 *
 * It must carry more agreement than the question itself, which is the shape a thread
 * with a real answer in it has. A question upvoted forty times whose best comment has
 * two has not been answered; it has been agreed with, and forty people are waiting.
 *
 * And it must be alone at the top. Two comments tied on agreement are an argument,
 * and an interface that picked one of them would be taking a side in it with a
 * heading. Nothing is drawn, and the reader reads the thread.
 *
 * Nothing at all where an Answer is marked: that is GitHub's own fact and this must
 * never sit above it.
 */
export const workingAnswer = (
  question: { readonly agreement: number; readonly answered: boolean },
  comments: ReadonlyArray<Weighed>
): Option.Option<Weighed> => {
  if (question.answered) return Option.none()

  const best = comments.reduce<Option.Option<Weighed>>(
    (found, one) =>
      Option.isNone(found) || one.agreement > found.value.agreement ? Option.some(one) : found,
    Option.none()
  )
  if (Option.isNone(best)) return Option.none()

  if (best.value.agreement <= question.agreement) return Option.none()
  if (comments.filter((one) => one.agreement === best.value.agreement).length > 1) {
    return Option.none()
  }

  return best
}
