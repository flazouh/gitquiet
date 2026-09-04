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
  Poll,
  Reaction,
  Reply
} from "../domain/discussions"
import { text } from "./outcome"
import { categoryAt, upvotesIn } from "./discussionParts"
import {
  markingAnswer,
  reactingTo,
  replyingUnder,
  sayingOn,
  upvoting,
  votingIn
} from "./discussionForms"

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

/** `…/discussions/categories/{slug}`, with whatever their filter appended left off. */

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


/**
 * The faces on one thing, off their own buttons.
 *
 * The name GitHub gives the face is carried beside the character, because the character is what a
 * reader sees and `+1` is what a press has to send. `aria-pressed` is their own word for whether
 * this reader is one of the count.
 */
const reactionsIn = (own: Element): ReadonlyArray<Reaction> =>
  [...own.querySelectorAll(".js-reaction-group-button[data-reaction-content]")].flatMap(
    (button) => {
      const content = button.getAttribute("data-reaction-content") ?? ""
      const count = Number(text(button.querySelector("span")))
      if (content === "" || !Number.isFinite(count) || count === 0) return []

      return [
        {
          content,
          emoji: text(button.querySelector("g-emoji")),
          count,
          mine: button.getAttribute("aria-pressed") === "true",
          mayPress: reactingTo(own, content) !== null
        }
      ]
    }
  )

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
 * One comment with its replies taken out of it.
 *
 * Their page nests a reply's whole container inside its parent's, so every read on a top-level
 * comment can reach into the replies underneath it. That is not a hypothetical: on
 * `vercel/next.js` #70178 the first comment is by `raju-sirigineedi` and its own name link
 * carries no `author` class, while the three replies below it do — so asking the container for
 * `a.author` signed that comment with a reply's author.
 *
 * A clone rather than a selector clever enough to avoid it, because the same trap is set for the
 * body, the moment, the vote count and the answer mark, and one of those would have been missed.
 */
const withoutReplies = (container: Element): Element => {
  const own = container.cloneNode(true) as Element
  for (const nested of [
    ...own.querySelectorAll('.js-nested-comment-container, [id^="child-comments-"]')
  ]) {
    nested.remove()
  }

  return own
}

/**
 * Who wrote it, off their own class for the name where they use one.
 *
 * A reply's name link carries `author` and a top-level comment's does not, so the class cannot be
 * insisted on. The fallback takes the first user link that says a name and is not inside what the
 * person wrote: their first link is the avatar, an anchor around an image that reads as an empty
 * name, and the ones after it are the `@mentions` in the text. A comment beginning with a mention
 * would otherwise be signed by whoever it mentions.
 */
const authorOf = (own: Element): Element | null => {
  const named = own.querySelector("a.author[href]")
  if (named !== null) return named

  return (
    [...own.querySelectorAll('a[data-hovercard-type="user"][href]')].find(
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
const saidIn = (page: Document, container: Element): Reply | null => {
  const named = namedWithin(container)
  if (named === null || named.id === "") return null

  /*
   * Every field is read from the comment with its replies removed. See {@link withoutReplies}:
   * their page nests a reply inside its parent, so the parent's first of anything can be the
   * child's.
   */
  const own = withoutReplies(container)

  /*
   * A comment GitHub has folded away carries their sentence for it and nothing else: no author,
   * no words, no vote. Read first, because everything below reads as empty on one of these and
   * the emptiness would look like a parse that had failed.
   */
  const minimized = own.querySelector(".minimized-comment summary h3")

  const who = authorOf(own)
  const when = own.querySelector("relative-time[datetime]")
  const body = own.querySelector(".js-comment-body")
  const upvote = own.querySelector('button[id^="discussion-upvote-button-"]')

  return {
    id: named.id,
    author: text(who),
    at: when?.getAttribute("datetime") ?? "",
    body: body?.innerHTML ?? "",
    hiddenAs: text(minimized).replace(/\s+/g, " "),
    upvotes: upvotesIn(upvote?.getAttribute("aria-label") ?? ""),
    /*
     * Their own class for it, written on the one comment somebody marked. Read per comment
     * rather than off the answer link in the header, because the header's link is an anchor to
     * a permalink and this has to hold for a page where GitHub changes what may be marked.
     */
    isAnswer: own.querySelector(".timeline-chosen-answer") !== null,
    reactions: reactionsIn(own),
    /*
     * What their page offered this reader, which is the presence of one of their own forms. Asked
     * of the whole page rather than of this container, because the finders take a document: they
     * are the same functions the gateway sends the press with, so what is drawn and what can be
     * sent cannot disagree.
     */
    mayMarkAnswer: named.isOpening ? false : markingAnswer(page, named.id) !== null,
    mayUpvote:
      upvoting(page, named.isOpening ? "Discussion" : "DiscussionComment", named.id) !== null
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
  return categoryAt(link, link)
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

  const post = saidIn(page, opening)
  if (post === null) return Option.none()

  /*
   * Read flat, then assembled. Their page nests a reply inside the block named after its
   * comment, so the nesting is the only statement of the relationship, and reading it as a pair
   * first means the comments are built once and never mutated afterwards.
   */
  const spoken = containers.flatMap((container) => {
    if (container === opening) return []

    const said = saidIn(page, container)
    return said === null ? [] : [{ said, under: under(container) }]
  })

  /*
   * Which of them stand on their own. Asked of this set rather than of the replies map, because
   * those are two different questions: a reply whose comment is on the page but could not be
   * read has an entry in the map and nothing to hang under, and filtering by the map would drop
   * it without a word.
   */
  const standing = new Set(spoken.filter((one) => one.under === null).map((one) => one.said.id))

  const repliesTo = new Map<string, Array<Reply>>()
  for (const one of spoken) {
    if (one.under === null || !standing.has(one.under)) continue
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
    .filter((one) => one.under === null || !standing.has(one.under))
    .map((one) => ({
      ...one.said,
      replies: repliesTo.get(one.said.id) ?? [],
      mayReply: replyingUnder(page, one.said.id) !== null
    }))

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
    reactions: post.reactions,
    comments,
    poll: pollOnPage(page),
    allowed: {
      say: sayingOn(page) !== null,
      upvote: post.mayUpvote
    }
  })
}

/**
 * Whether what came back out of the store is still the shape that went in.
 *
 * The same guard the lists keep, and for the same reason: an entry written before an update is
 * the one shape that would reach the screen and fail there. The comments are proved to be an
 * array and the title to be a string, because those two are what the screen draws before it
 * draws anything else.
 */
export const isKeptDiscussion = (value: unknown): value is DiscussionSnapshot => {
  if (typeof value !== "object" || value === null) return false

  const kept: Record<string, unknown> = { ...value }
  return (
    typeof kept.id === "string" &&
    typeof kept.title === "string" &&
    typeof kept.body === "string" &&
    typeof kept.answerable === "boolean" &&
    typeof kept.answered === "boolean" &&
    Array.isArray(kept.comments)
  )
}

/** Their percentage, off the number they printed rather than one worked out again. */
const SHARE = /(\d+)\s*%/

/**
 * Whether an element is one their page is showing.
 *
 * GitHub renders the "you voted for this" mark on every option and hides all but the one taken,
 * so its presence says nothing and only `hidden` does.
 */
const shown = (node: Element | null): boolean => node !== null && !node.hasAttribute("hidden")

/**
 * The Poll their body carries, or nothing where the discussion is not one.
 *
 * Read from the cell after the comment body, which is where their page puts it. Drawing the body
 * alone would drop it; drawing the cell as body would hand a reader a poll they cannot answer.
 *
 * The options come from their radio group and the shares from their result rows, matched by
 * position, because those are the same list drawn twice and only the first carries the ids.
 */
export const pollOnPage = (page: Document): Option.Option<Poll> => {
  const poll = page.querySelector(".js-discussion-poll-component")
  if (poll === null) return Option.none()

  const voteUrl = poll.getAttribute("data-vote-url") ?? ""
  const rows = [...poll.querySelectorAll('[id^="result-row-"]')]

  const options = [...poll.querySelectorAll(".js-discussion-poll-option[value]")].flatMap(
    (choice, at) => {
      const id = choice.getAttribute("value") ?? ""
      if (id === "") return []

      const label = poll.querySelector(`label[for="${choice.getAttribute("id") ?? ""}"]`)
      const row = rows[at]
      const share = Number(SHARE.exec(text(row))?.[1])

      return [
        {
          id,
          name: text(label),
          share: Number.isFinite(share) ? share : 0,
          /*
           * Their own words for it, and the mark has to be shown rather than merely there.
           * GitHub renders it on every option and hides all but the one taken, so reading its
           * presence made every option read as chosen on a page nobody had voted on.
           */
          chosen: shown(row?.querySelector('[aria-label="You voted for this option"]') ?? null)
        }
      ]
    }
  )

  const votes = Number((/([\d,]+)\s+votes?/.exec(text(poll)) ?? [])[1]?.replace(/,/g, ""))
  const first = options[0]

  return Option.some({
    question: text(poll.querySelector("#poll-question")),
    options,
    votes: Number.isFinite(votes) ? votes : 0,
    locked: poll.getAttribute("data-poll-locked") === "true",
    voteUrl,
    field: poll.querySelector(".js-discussion-poll-option")?.getAttribute("name") ?? "",
    mayVote: first !== undefined && votingIn(page, first.id) !== null
  })
}
