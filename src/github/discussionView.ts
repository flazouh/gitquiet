/**
 * One discussion's own page, read for the body, everyone who spoke, and which of it was marked.
 *
 * Scraping, as the list beside it is, and for the same reason: their discussion page is served
 * whole by Rails. Measured on 2026-09-03, `vercel/next.js/discussions/70178` is 396,008 bytes
 * carrying nine comments, of which 4,165 characters are what anybody wrote. That is 1.05 percent.
 * The other 99 is 151 inline SVGs, 24 `include-fragment` elements and a per-comment actions menu
 * fetched from a route of its own when it is opened.
 *
 * So this is one request where their own page is one request and then a dozen more, and the
 * thing it goes looking for is the one fact their page draws twice and their list draws as a
 * fill on a check: whether any of these comments is the answer.
 *
 * Written to come back with nothing rather than with something wrong, as the list parser is. A
 * page whose title cannot be read is not a discussion, and the screen hands the document back to
 * GitHub rather than drawing an empty one.
 *
 * Measured against `tests/fixtures/discussionAnswered.html` and
 * `tests/fixtures/discussionView.html`, which are `vercel/next.js` #98177 and #70178 as GitHub
 * served them on 2026-09-03.
 */

import { Option } from "effect"
import type {
  Category,
  Comment,
  DiscussionRef,
  DiscussionSnapshot,
  Reply
} from "../domain/discussions"
import { text } from "./outcome"
import { emojiIn } from "./discussionsList"

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

/** `…/discussions/categories/{slug}`, with whatever their filter appended left off. */
const CATEGORY = /\/discussions\/categories\/([^/?#]+)/

/**
 * `discussioncomment-18252316`, and `discussion-10735041` for the opening post.
 *
 * Anchored at both ends, which is the point of it. Every vote button on the page is named
 * `discussion-upvote-button-DiscussionComment-…`, so a prefix match on `discussion-` finds a
 * button in every comment on the page and the opening post stops being the one thing that
 * answers to it.
 */
const SAID_ID = /^(discussion|discussioncomment)-(\d+)$/

/** The block their page puts one comment's replies in, named after the comment. */
const CHILD_OF = /^child-comments-discussioncomment-(\d+)$/

const countIn = (label: string): number => {
  const found = Number(/^Upvote:\s*(\d+)$/.exec(label)?.[1])
  return Number.isSafeInteger(found) && found >= 0 ? found : 0
}

/** What a comment container is: the opening post, or one of the things said about it. */
type Named = {
  readonly id: string
  readonly isOpening: boolean
}

/**
 * The name inside a comment container, and whether it is the opening post's.
 *
 * The container carries the classes and their scroll target carries the name, so both are read.
 * The target is asked for by their own class rather than by an id prefix: every vote button on
 * the page is named `discussion-upvote-button-…`, and a prefix match finds one of those in every
 * comment.
 */
const namedWithin = (container: Element): Named | null => {
  for (const target of [...container.querySelectorAll(".discussions-timeline-scroll-target[id]")]) {
    const found = SAID_ID.exec(target.getAttribute("id") ?? "")
    if (found === null) continue

    return { id: found[2] ?? "", isOpening: found[1] === "discussion" }
  }

  return null
}

/**
 * Who wrote it, off their own class for the name.
 *
 * `a.author` and not the first user link in the comment. A reply's first user link is the avatar,
 * which is an anchor around an image and reads as an empty name, and the links after it are the
 * `@mentions` inside what the person wrote. So the fallback is scoped out of the body as well:
 * a comment whose first word is a mention would otherwise be signed by the person mentioned.
 */
const authorOf = (container: Element): Element | null => {
  const named = container.querySelector("a.author[href]")
  if (named !== null) return named

  return (
    [...container.querySelectorAll('a[data-hovercard-type="user"][href]')].find(
      (one) => (one.textContent ?? "").trim() !== "" && one.closest(".js-comment-body") === null
    ) ?? null
  )
}

/**
 * One comment as much of it as this screen draws.
 *
 * The body is their rendered markdown taken whole rather than re-rendered from source. GitHub
 * already did the work, their `.js-comment-body` is what the reader saw, and rendering it again
 * would mean a second markdown engine that agrees with theirs about task lists, mentions,
 * permalink expansion and every alert box they have ever shipped.
 */
const saidIn = (container: Element): Reply | null => {
  const named = namedWithin(container)
  if (named === null || named.id === "") return null

  const who = authorOf(container)
  const when = container.querySelector("relative-time[datetime]")
  const body = container.querySelector(".js-comment-body")
  const upvote = container.querySelector('button[id^="discussion-upvote-button-"]')

  return {
    id: named.id,
    author: text(who),
    at: when?.getAttribute("datetime") ?? "",
    body: body?.innerHTML ?? "",
    upvotes: countIn(upvote?.getAttribute("aria-label") ?? ""),
    /*
     * Their own class for it, written on the one comment somebody marked. Read per comment
     * rather than off the answer link in the header, because the header's link is an anchor to
     * a permalink and this has to hold for a page where GitHub changes what may be marked.
     */
    isAnswer: container.querySelector(".timeline-chosen-answer") !== null
  }
}

/**
 * The comment a reply hangs under, or nothing for a comment that hangs under the discussion.
 *
 * Read from the block their page nests it in rather than from a field, because there is no
 * field: the relationship is the nesting. One level and no more, which is all GitHub allows.
 */
const under = (container: Element): string | null => {
  const block = container.closest('[id^="child-comments-discussioncomment-"]')
  return CHILD_OF.exec(block?.getAttribute("id") ?? "")?.[1] ?? null
}

/**
 * The category the discussion was asked in, off the link in their header.
 *
 * The picture comes from the row's emoji box on the list and from the header link here, so
 * `emojiIn` is given whichever element holds it rather than being told where to look.
 */
const categoryIn = (page: Document): Category => {
  const link = page.querySelector('a[href*="/discussions/categories/"]')
  const url = link?.getAttribute("href") ?? ""

  return {
    name: text(link),
    slug: decodeURIComponent(CATEGORY.exec(url)?.[1] ?? ""),
    emoji: emojiIn(link)
  }
}

/**
 * Their header's own pills, which is where every state on this page is spelled.
 *
 * Four of them and each is a `title` on a `span.State`: "Answered", "Unanswered", "Locked", and
 * "Status: Closed as resolved" with the reason in it. Read off the title rather than off the
 * word inside the pill, because the word is what a translation moves and the class is what a
 * redesign moves. Measured on `vercel/next.js` #97925, which carries three of the four at once.
 */
const pillTitled = (page: Document, title: string): boolean =>
  page.querySelector(`.State[title="${title}"]`) !== null

/**
 * Whether somebody ended it, off the pill that says so and the reason it carries.
 *
 * A prefix, because their title is "Status: Closed as resolved" and the last word is one of
 * three: resolved, outdated, duplicate. Which one is a distinction worth drawing on the page
 * itself and not in a boolean, so this asks only whether any of them is there.
 */
const closedIn = (page: Document): boolean =>
  page.querySelector('.State[title^="Status: Closed"]') !== null

/**
 * One discussion out of the document GitHub served it as, or nothing where the page is not one.
 *
 * Nothing rather than an empty discussion. A page with no title is a page this parser does not
 * recognise, and the screen hands such a document back rather than drawing a discussion with no
 * name and no body over the top of whatever GitHub really sent.
 */
export const discussionOnPage = (
  reference: DiscussionRef,
  html: string
): Option.Option<DiscussionSnapshot> => {
  const page = parse(html)

  const heading = page.querySelector("h1 .js-issue-title")
  const title = text(heading).replace(/\s+/g, " ")
  if (title === "") return Option.none()

  const containers = [...page.querySelectorAll(".js-comment-container")]

  /*
   * The opening post is a comment container like the others, told apart by the name inside it:
   * theirs is `discussion-{id}` where every reply's is `discussioncomment-{id}`.
   */
  const opening = containers.find((one) => namedWithin(one)?.isOpening === true)
  if (opening === undefined) return Option.none()

  const post = saidIn(opening)
  if (post === null) return Option.none()

  /*
   * Read flat, then assembled. Their page nests a reply inside the block named after its
   * comment, so the nesting is the only statement of the relationship, and reading it as a pair
   * first means the comments are built once and never mutated afterwards.
   */
  const spoken = containers.flatMap((container) => {
    if (container === opening) return []

    const said = saidIn(container)
    return said === null ? [] : [{ said, under: under(container) }]
  })

  const repliesTo = new Map<string, Array<Reply>>()
  for (const one of spoken) {
    if (one.under === null) continue
    const held = repliesTo.get(one.under)
    if (held === undefined) repliesTo.set(one.under, [one.said])
    else held.push(one.said)
  }

  const comments: ReadonlyArray<Comment> = spoken
    /*
     * A reply whose comment is not on the page is kept as a comment of its own rather than
     * dropped. Their own pager can serve one, and a reply with nothing to hang under is still
     * something somebody wrote.
     */
    .filter((one) => one.under === null || !repliesTo.has(one.under))
    .map((one) => ({ ...one.said, replies: repliesTo.get(one.said.id) ?? [] }))

  /*
   * The state pill in their header, which is the only place the two words appear on this page.
   * Absent on a discussion in a category that takes no answers, and that absence is the fact:
   * six of `vercel/next.js`'s nine categories are in that state.
   */
  const answerable = pillTitled(page, "Answered") || pillTitled(page, "Unanswered")

  return Option.some({
    reference,
    id: post.id,
    title,
    category: categoryIn(page),
    answerable,
    /*
     * Their own class on the discussion, which is the same fact the pill carries and the one
     * that survives a page where the pill has moved. Both are read: `answered` on the wrapper
     * says it, and a comment wearing `timeline-chosen-answer` proves it.
     */
    answered:
      page.querySelector(".js-discussion.answered") !== null ||
      comments.some((one) => one.isAnswer || one.replies.some((reply) => reply.isAnswer)),
    closed: closedIn(page),
    locked: pillTitled(page, "Locked"),
    upvotes: post.upvotes,
    author: post.author,
    askedAt: post.at,
    body: post.body,
    comments
  })
}
