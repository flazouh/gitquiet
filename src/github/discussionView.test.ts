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
