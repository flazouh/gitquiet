import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
  answerOf,
  answeringOf,
  courtOf,
  spokenOn,
  weighingOf,
  type DiscussionSnapshot
} from "../domain/discussions"
import { discussionOnPage } from "./discussionView"

/*
 * Three discussions of `vercel/next.js` as GitHub served them on 2026-09-03, signed out. The
 * scripts, the stylesheets, the icon geometry, the tooltips, the marketing header and footer and
 * every analytics attribute are stripped; every element and attribute a parser touches is theirs,
 * unedited.
 *
 * One answered, one with nine comments and nothing marked, and one closed and locked at once.
 * The third is here because closing, locking and being unanswered are three separate pills in
 * their header and that page is the only one that carries all three.
 */
const answered = await Bun.file("tests/fixtures/discussionAnswered.html").text()
const stale = await Bun.file("tests/fixtures/discussionView.html").text()
const shut = await Bun.file("tests/fixtures/discussionClosed.html").text()

const at = (number: number) => ({ owner: "vercel", repo: "next.js", number })

const read = (number: number, html: string): DiscussionSnapshot =>
  Option.getOrThrow(discussionOnPage(at(number), html))

const one = read(98177, answered)
const nine = read(70178, stale)
const ended = read(97925, shut)

describe("reading one discussion off their own page", () => {
  test("reads what was asked, by whom, and where", () => {
    expect(one.reference).toEqual(at(98177))
    expect(one.id).toBe("10735041")
    expect(one.title).toBe("ISR with cacheComponents but without partialPrefetching")
    expect(one.author).toBe("mdj-uk")
    expect(one.askedAt).toBe("2026-09-02T13:50:58Z")
    expect(one.category).toEqual({
      name: "App Router",
      slug: "app-router",
      emoji: { kind: "none" }
    })
  })

  /*
   * Their rendered markdown taken whole rather than re-rendered from source. GitHub already did
   * the work and a second engine would have to agree with theirs about task lists, mentions and
   * every alert box they have ever shipped.
   */
  test("keeps the body as the markup GitHub rendered", () => {
    expect(one.body).toContain("partialPrefetching")
    expect(one.body.length).toBeGreaterThan(1000)
  })

  test("names the discussion by GitHub's own id, which is what a write takes", () => {
    expect(one.id).toBe("10735041")
    expect(nine.id).toBe("7197489")
  })
})

describe("what everybody said", () => {
  test("finds the two comments on the answered one, and no reply under either", () => {
    expect(one.comments.map((said) => said.id)).toEqual(["18252316", "18252935"])
    expect(one.comments.every((said) => said.replies.length === 0)).toBe(true)
  })

  /*
   * Their header says "6 comments · 3 replies" and their list row says 9. Both are true of the
   * same thread, which is why nothing here reads a printed number.
   */
  test("files the three replies under the comment they hang from", () => {
    expect(nine.comments).toHaveLength(6)
    expect(spokenOn(nine)).toBe(9)

    const first = nine.comments[0]
    expect(first?.id).toBe("10935238")
    expect(first?.replies.map((said) => said.id)).toEqual(["11004713", "11150494", "11151219"])
  })

  test("reads a comment's author, moment and upvotes", () => {
    const answer = one.comments[0]

    expect(answer?.author).toBe("icyJoseph")
    expect(answer?.at).toBe("2026-09-02T15:28:33Z")
    expect(answer?.upvotes).toBe(1)
    expect(answer?.body).toContain("cacheComponents")
  })

  /*
   * Their page nests a reply's whole container inside its parent's, so every read on a comment
   * can reach into the replies underneath it. This one is the case that caught it: the comment
   * is by `raju-sirigineedi`, whose own name link carries no `author` class, and the three
   * replies below it have one each. Reading `a.author` off the container signed the comment with
   * the first reply's author.
   */
  test("a comment is read without the replies nested inside it", () => {
    const first = nine.comments[0]

    expect(first?.author).toBe("raju-sirigineedi")
    expect(first?.at).toBe("2024-10-14T11:00:13Z")
    expect(first?.body).toContain("@ShivamArora")
    expect(first?.replies.map((said) => said.author)).toEqual([
      "ShivamArora",
      "raju-sirigineedi",
      "ShivamArora"
    ])
  })

  test("a reply carries the same facts as a comment", () => {
    const reply = nine.comments[0]?.replies[0]

    expect(reply?.id).toBe("11004713")
    expect(reply?.author).not.toBe("")
    expect(reply?.at).not.toBe("")
  })
})

describe("the one fact their list draws as a fill on a check", () => {
  test("marks the answer, and finds it wherever in the thread it is", () => {
    expect(one.answered).toBe(true)
    expect(one.comments.filter((said) => said.isAnswer)).toHaveLength(1)
    expect(Option.getOrThrow(answerOf(one)).id).toBe("18252316")
  })

  test("nine comments and nothing marked is Stale, which is what the whole screen is for", () => {
    expect(nine.answerable).toBe(true)
    expect(nine.answered).toBe(false)
    expect(answerOf(nine)).toEqual(Option.none())
    expect(answeringOf(weighingOf(nine))).toBe("stale")
    expect(courtOf(weighingOf(nine))).toBe("needs-you")
  })

  /*
   * The page and the row weighed by one rule. A discussion drawn as Stale on the list and as
   * something else on its own page would be two answers to one question.
   */
  test("an answered discussion is Settled on its own page as it is on the list", () => {
    expect(answeringOf(weighingOf(one))).toBe("answered")
    expect(courtOf(weighingOf(one))).toBe("settled")
  })
})

describe("the three pills a header can carry at once", () => {
  test("reads closed and locked off their own titles, not off the words in them", () => {
    expect(ended.closed).toBe(true)
    expect(ended.locked).toBe(true)
  })

  /*
   * Closing does not answer. Their header carries "Status: Closed as resolved", "Locked" and
   * "Unanswered" together, so the Answering is unchanged and only the Court moves.
   */
  test("a closed question is still a question nobody answered", () => {
    expect(ended.answerable).toBe(true)
    expect(ended.answered).toBe(false)
    expect(answeringOf(weighingOf(ended))).toBe("stale")
    expect(courtOf(weighingOf(ended))).toBe("settled")
  })

  test("an open discussion carries neither pill", () => {
    expect(nine.closed).toBe(false)
    expect(nine.locked).toBe(false)
  })
})

describe("coming back with nothing rather than with something wrong", () => {
  test("a page that is not a discussion is not read as an empty one", () => {
    expect(discussionOnPage(at(1), "<html><body><p>nothing</p></body></html>")).toEqual(
      Option.none()
    )
  })

  /*
   * A title and no opening post is a page this parser half-recognises, and half-recognising is
   * how a screen ends up drawn over a document GitHub sent for something else.
   */
  test("a title with no opening post is refused", () => {
    const half = '<h1><span class="js-issue-title">A name</span></h1>'

    expect(discussionOnPage(at(1), `<html><body>${half}</body></html>`)).toEqual(Option.none())
  })

  /*
   * Every vote button on the page is named `discussion-upvote-button-DiscussionComment-…`, so a
   * read that matched ids by prefix found one in every comment and took the first comment for the
   * opening post.
   */
  test("a vote button is not mistaken for the opening post", () => {
    expect(nine.author).toBe("ShivamArora")
    expect(nine.comments.some((said) => said.id === "7197489")).toBe(false)
  })
})

describe("a thread their pager served in pieces", () => {
  /*
   * A reply whose comment is not on the page. Their pager can serve one, and a reply with
   * nothing to hang under is still something somebody wrote, so it stands on its own rather than
   * being dropped for having no parent.
   */
  const orphaned = [
    '<h1><span class="js-issue-title">A question</span></h1>',
    '<div class="js-comment-container">',
    '  <div class="discussions-timeline-scroll-target" id="discussion-1"></div>',
    '  <div class="js-comment-body">the question</div>',
    "</div>",
    // Their nesting, the way round their page has it: the block holds the reply, never the
    // other way about.
    '<div id="child-comments-discussioncomment-999">',
    '  <div class="js-comment-container js-nested-comment-container">',
    '    <div class="discussions-timeline-scroll-target" id="discussioncomment-2"></div>',
    '    <div class="js-comment-body">a reply to a comment nobody sent</div>',
    "  </div>",
    "</div>"
  ].join("")

  test("keeps a reply whose comment never arrived", () => {
    const found = Option.getOrThrow(discussionOnPage(at(1), `<html><body>${orphaned}</body></html>`))

    expect(found.comments).toHaveLength(1)
    expect(found.comments[0]?.id).toBe("2")
    expect(found.comments[0]?.body).toContain("nobody sent")
  })
})

describe("what their page offered this reader", () => {
  /*
   * Signed out, GitHub renders no box, no vote form and no mark-as-answer form on any of these
   * three pages. So every control is refused, which is the same answer a locked discussion and
   * an archived repository give, and the screen offers nothing it cannot send.
   */
  test("a signed-out page offers nothing, which is what these recordings are", () => {
    for (const found of [one, nine, ended]) {
      expect(found.allowed).toEqual({ say: false, upvote: false })
      expect(found.comments.every((said) => !said.mayMarkAnswer && !said.mayUpvote)).toBe(true)
      expect(found.comments.every((said) => !said.mayReply)).toBe(true)
    }
  })

  /*
   * Their disabled badge on the answered one reads "Marked as answer". Disabled is precisely the
   * reader who may not press it, so it is not offered as a press.
   */
  test("their disabled badge is not a press", () => {
    expect(one.comments.find((said) => said.isAnswer)?.mayMarkAnswer).toBe(false)
  })

  test("the opening post is never something to mark as the answer", () => {
    expect(nine.comments.some((said) => said.id === nine.id)).toBe(false)
  })
})

/*
 * `vercel/next.js#91275`, a poll with two options and two votes, served on 2026-09-04. Their
 * page puts a poll in a table cell after the comment body, so a read of the body alone drops it
 * and a read of the cell as body hands a reader a poll they cannot answer.
 */
const votingHtml = await Bun.file("tests/fixtures/discussionPoll.html").text()
const asked = read(91275, votingHtml)

describe("a discussion that is a poll", () => {
  test("reads the question and both ways of answering it", () => {
    const poll = Option.getOrThrow(asked.poll)

    expect(poll.question).toBe(
      "was non-standard characters [,(,),] in filenames one of the worst decisions ever?"
    )
    expect(poll.options.map((one) => one.name)).toEqual(["yes", "no"])
    expect(poll.options.map((one) => one.id)).toEqual(["78929", "78930"])
  })

  /* Their number and not one worked out again: they round it, and they round it their way. */
  test("takes the share their own page printed", () => {
    const poll = Option.getOrThrow(asked.poll)

    expect(poll.options.map((one) => one.share)).toEqual([100, 0])
    expect(poll.votes).toBe(2)
  })

  /*
   * Their markup names the route, the field and the value, so this is the one write on this
   * screen that guesses at nothing. What it still needs is their vote button, which is hidden
   * from everybody who is not signed in.
   */
  test("keeps the route their markup names, and refuses the vote nobody may take", () => {
    const poll = Option.getOrThrow(asked.poll)

    expect(poll.voteUrl).toBe("/vercel/next.js/discussions/91275/poll/votes")
    expect(poll.field).toBe("24993")
    expect(poll.locked).toBe(false)
    expect(poll.mayVote).toBe(false)
  })

  test("nobody has voted here, because their mark is hidden from a reader who is not signed in", () => {
    expect(Option.getOrThrow(asked.poll).options.every((one) => !one.chosen)).toBe(true)
  })

  test("a discussion that is not a poll carries none", () => {
    expect(nine.poll).toEqual(Option.none())
    expect(one.poll).toEqual(Option.none())
  })

  /* The body is still the body. A poll sits beside what was written, never instead of it. */
  test("the question that carries the poll still carries its own words", () => {
    expect(asked.body).toContain("dumbest decisions")
  })
})
