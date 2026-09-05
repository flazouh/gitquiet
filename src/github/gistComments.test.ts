import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { commentsOn, earlierCommentsIn, sayingOn } from "./gistComments"

const html = readFileSync("tests/fixtures/gistComments.html", "utf8")
const pageOf = (source: string): Document =>
  new DOMParser().parseFromString(source, "text/html")

describe("what was said under a gist", () => {
  test("reads every comment, oldest first, by who said it and when", () => {
    const said = commentsOn(pageOf(html))

    expect(said.map((one) => one.id)).toEqual(["4425115", "4455779"])
    expect(said[0]).toMatchObject({
      author: {
        login: "AbdoulkadriBoureima",
        faceUrl: "https://avatars.githubusercontent.com/u/112864840?s=80&v=4"
      },
      createdAt: "2023-01-05T10:19:52Z"
    })
  })

  test("keeps the markdown as written, and what GitHub rendered it as", () => {
    // Their menu carries the source for copying; the body is the rendering. The text of
    // the rendering is the source with every fence and link flattened, which is what a
    // reader would have got otherwise.
    const [, second] = commentsOn(pageOf(html))

    expect(second?.body).toBe("**Thanks a bunch** ! This is exactly what i was looking for.")
    expect(second?.html).toContain("<strong>Thanks a bunch</strong>")
  })

  test("does not read the box at the foot as a comment by nobody", () => {
    // The box for writing one sits in a comment container of its own.
    expect(commentsOn(pageOf(html)).length).toBe(2)
  })

  test("reads a comment that has lost its menu, off the rendering alone", () => {
    const bare = html.replace(/<details-menu[\s\S]*?<\/details-menu>/g, "")

    expect(commentsOn(pageOf(bare))[0]?.body).toBe("thanks !")
  })

  test("reads where the comments their page held back can be read from", () => {
    // Their pager is a GET form naming the oldest comment on the page.
    expect(earlierCommentsIn(pageOf(html))).toBe(
      "/octocat/aaa111/load_comments?partial=gists%2Ftimeline_marker&before_comment_id=4425115&mark_as_unread=0"
    )
  })

  test("reads no pager where their page holds every comment", () => {
    const whole = html.replace(/<form class="ajax-pagination-form[\s\S]*?<\/form>/, "")

    expect(earlierCommentsIn(pageOf(whole))).toBeNull()
  })

  test("reads the box at the foot, with their token and their name for the words", () => {
    const posting = sayingOn(pageOf(html))

    expect(posting?.action).toBe("/octocat/aaa111/comments")
    expect(posting?.fields).toMatchObject({ authenticity_token: "a-comment-token" })
    expect(posting?.bodyField).toBe("comment[body]")
  })

  test("offers no box where GitHub drew none", () => {
    // A reader who is not signed in gets "Sign in to comment" and no form.
    const signedOut = html.replace(/<form class="js-new-comment-form[\s\S]*?<\/form>/, "")

    expect(sayingOn(pageOf(signedOut))).toBeNull()
  })
})
