import { describe, expect, test } from "bun:test"
import {
  doingNamed,
  doingsIn,
  markingAnswer,
  menuRouteIn,
  postingOf,
  reactingTo,
  reactionsWithin,
  replyingUnder,
  sayingOn,
  sendingOf,
  upvoting
} from "./discussionForms"

const parse = (html: string): Document =>
  new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html")

/*
 * The one form GitHub renders on a discussion to a reader who is not signed in, copied from
 * `vercel/next.js/discussions/70178` as served on 2026-09-03. Every form below is built to this
 * shape, because it is the only recording there is of the shape: a path per operation,
 * `variables[…]` fields, a CSRF token, and `method="post"`.
 */
const theirs = (action: string, extra = "") => `
  <form data-turbo="false" action="${action}" accept-charset="UTF-8" data-remote="true"
        method="post">
    <input type="hidden" data-csrf="true" name="authenticity_token" value="a-token">
    <input type="hidden" name="variables[subjectId]" value="D_kwDOBC3Cis4AbdMx">
    <input type="hidden" name="">
    ${extra}
  </form>`

describe("reading one of their forms", () => {
  test("keeps every field it carries, under their own names", () => {
    const posting = postingOf(parse(theirs("/_graphql/AddDiscussionComment")).querySelector("form"))

    expect(posting?.action).toBe("/_graphql/AddDiscussionComment")
    expect(posting?.fields).toEqual({
      authenticity_token: "a-token",
      "variables[subjectId]": "D_kwDOBC3Cis4AbdMx"
    })
  })

  /* Their markup carries blank-named hidden inputs beside the real ones. A name is what makes a
     field a field, and sending one called "" is sending a field GitHub never asked for. */
  test("leaves a field with no name where it found it", () => {
    const posting = postingOf(parse(theirs("/x")).querySelector("form"))

    expect(Object.keys(posting?.fields ?? {})).toHaveLength(2)
    expect(posting?.fields).not.toHaveProperty("")
  })

  test("reads the name of the field the words go in, rather than assuming one", () => {
    const withBox = theirs("/x", '<textarea name="variables[body]"></textarea>')

    expect(postingOf(parse(withBox).querySelector("form"))?.bodyField).toBe("variables[body]")
    expect(postingOf(parse(theirs("/x")).querySelector("form"))?.bodyField).toBeNull()
  })

  /*
   * A form that GETs is a search box. Sending one as a write is a request that changes nothing
   * and reports success, which is the worst answer of the three available.
   */
  test("refuses a form that is not a write", () => {
    expect(postingOf(parse('<form action="/s" method="get"></form>').querySelector("form"))).toBeNull()
    expect(postingOf(parse('<form method="post"></form>').querySelector("form"))).toBeNull()
    expect(postingOf(null)).toBeNull()
  })
})

describe("the box at the foot of the page", () => {
  const page = parse(`
    <div class="js-comment-container">
      <div id="discussioncomment-11">${theirs("/reply", '<textarea name="variables[body]"></textarea>')}</div>
    </div>
    ${theirs("/say", '<textarea name="variables[body]"></textarea>')}`)

  test("is the page's own box and never a reply box inside a comment", () => {
    expect(sayingOn(page)?.action).toBe("/say")
  })

  test("is nothing where GitHub rendered none, which is every signed-out page", () => {
    expect(sayingOn(parse("<p>nothing</p>"))).toBeNull()
  })
})

describe("the box under one comment", () => {
  const page = parse(`
    <div class="js-comment-container">
      <div id="discussioncomment-11"></div>
      ${theirs("/reply-to-11", '<textarea name="variables[body]"></textarea>')}
    </div>
    <div class="js-comment-container"><div id="discussioncomment-22"></div></div>`)

  test("is the one inside that comment", () => {
    expect(replyingUnder(page, "11")?.action).toBe("/reply-to-11")
  })

  test("is nothing for a comment that has none, and for a comment that is not there", () => {
    expect(replyingUnder(page, "22")).toBeNull()
    expect(replyingUnder(page, "999")).toBeNull()
  })
})

describe("marking one comment as the answer", () => {
  /*
   * Their disabled badge, copied from the answered discussion recorded here. Disabled is exactly
   * the case that must not be offered: it is what a reader who may not press it is shown.
   */
  const marked = `
    <div class="js-comment-container">
      <div id="discussioncomment-33"></div>
      <button aria-label="Marked as answer" type="button" disabled="disabled"
              class="social-mark-answer">Marked as answer</button>
    </div>`

  const offered = parse(`
    <div class="js-comment-container">
      <div id="discussioncomment-44"></div>
      ${theirs("/mark-44", '<button class="social-mark-answer">Mark as answer</button>')}
    </div>`)

  test("is offered where their own button is one a reader may press", () => {
    expect(markingAnswer(offered, "44")?.action).toBe("/mark-44")
  })

  test("is not offered where their button is disabled", () => {
    expect(markingAnswer(parse(marked), "33")).toBeNull()
  })

  test("is not offered where there is no button at all", () => {
    const bare = parse('<div class="js-comment-container"><div id="discussioncomment-55"></div></div>')

    expect(markingAnswer(bare, "55")).toBeNull()
  })
})

describe("upvoting", () => {
  /*
   * Their id is the one hook on this page that names both what is voted on and which of the two
   * kinds it is. Signed out it is a disabled button with a tooltip reading "You must be logged in
   * to vote", which is the case this has to refuse.
   */
  const page = parse(`
    ${theirs("/vote-discussion", '<button id="discussion-upvote-button-Discussion-7197489">9</button>')}
    ${theirs("/vote-comment", '<button id="discussion-upvote-button-DiscussionComment-11004713">1</button>')}
    <button id="discussion-upvote-button-DiscussionComment-99" disabled="disabled">2</button>`)

  test("tells the question from something said about it", () => {
    expect(upvoting(page, "Discussion", "7197489")?.action).toBe("/vote-discussion")
    expect(upvoting(page, "DiscussionComment", "11004713")?.action).toBe("/vote-comment")
  })

  test("is not offered to a reader who may not vote", () => {
    expect(upvoting(page, "DiscussionComment", "99")).toBeNull()
    expect(upvoting(page, "Discussion", "nothing")).toBeNull()
  })
})

describe("sending one back", () => {
  const posting = postingOf(
    parse(theirs("/x", '<textarea name="variables[body]"></textarea>')).querySelector("form")
  )!

  test("sends their fields under their names, with the words in the field they named", () => {
    const body = new URLSearchParams(sendingOf(posting, "well said"))

    expect(body.get("authenticity_token")).toBe("a-token")
    expect(body.get("variables[subjectId]")).toBe("D_kwDOBC3Cis4AbdMx")
    expect(body.get("variables[body]")).toBe("well said")
  })

  test("a press that carries no words sends none", () => {
    const body = new URLSearchParams(sendingOf(posting))

    expect(body.has("variables[body]")).toBe(false)
  })
})

describe("putting one of the eight faces on something", () => {
  /*
   * Their own button, copied from `vercel/next.js#70178`. It is a `type="submit"` whose `name`
   * and `value` are part of what the form sends, which is why both are added to the fields here
   * exactly as a browser would.
   */
  const button = (content: string, extra = "") =>
    `<button name="input[content]" value="THUMBS_UP react" data-reaction-label="${content}"
             data-reaction-content="${content}" aria-pressed="false" type="submit" ${extra}
             class="social-reaction-summary-item js-reaction-group-button">
       <g-emoji alias="${content}">👍</g-emoji><span>1</span></button>`

  const page = parse(`
    <div class="js-comment-container" id="holder">
      <div id="discussioncomment-11"></div>
      ${theirs("/react-11", button("+1"))}
    </div>`)

  const within = page.getElementById("holder")

  test("sends the button's own name and value beside the form's fields", () => {
    const posting = reactingTo(within, "+1")

    expect(posting?.action).toBe("/react-11")
    expect(posting?.fields["input[content]"]).toBe("THUMBS_UP react")
    expect(posting?.fields["authenticity_token"]).toBe("a-token")
  })

  test("is found by the name GitHub gives the face, not by the character", () => {
    expect(reactingTo(within, "heart")).toBeNull()
  })

  test("is not offered to a reader who may not press it", () => {
    const shut = parse(`
      <div class="js-comment-container" id="holder">
        ${theirs("/react", button("+1", 'disabled="disabled"'))}
      </div>`)

    expect(reactingTo(shut.getElementById("holder"), "+1")).toBeNull()
  })

  /* The opening post and a comment are both comment containers; the id says which. */
  test("finds the faces on the question and on one comment alike", () => {
    const both = parse(`
      <div class="js-comment-container"><div id="discussion-7"></div></div>
      <div class="js-comment-container"><div id="discussioncomment-11"></div></div>`)

    expect(reactionsWithin(both, "Discussion", "7")).not.toBeNull()
    expect(reactionsWithin(both, "DiscussionComment", "11")).not.toBeNull()
    expect(reactionsWithin(both, "DiscussionComment", "7")).toBeNull()
  })
})

/*
 * Their own menu, which is where close, lock, edit, delete and report all live. None of it is in
 * the page: their markup carries an `include-fragment` per comment whose `src` is the route that
 * serves it, and this codebase never writes that route.
 *
 * The fragment below is built to the shape their forms have, because their menu answers 404 to a
 * reader who is not signed in and there is no recording of one. What is verified is the route,
 * which is in every recording here, and the reading — which learns none of GitHub's names for
 * these actions and so cannot be wrong about one.
 */
describe("everything else their menu offers", () => {
  const page = parse(`
    <div class="js-comment-container">
      <div id="discussioncomment-11"></div>
      <include-fragment src="/o/r/discussions/7/comments/11/comment_actions_menu?form_path=x">
      </include-fragment>
    </div>
    <div class="js-comment-container">
      <div id="discussion-7"></div>
      <include-fragment src="/o/r/discussions/7/actions_menu?form_path=y"></include-fragment>
    </div>`)

  const menu = `
    ${theirs("/close", '<button name="input[state]" value="CLOSED">Close discussion</button>')}
    ${theirs("/lock", "<button>Lock conversation</button>")}
    ${theirs("/delete", '<button class="color-fg-danger">Delete</button>')}
    ${theirs("/nameless", "<button></button>")}`

  test("reads the route off their own markup rather than writing one", () => {
    expect(menuRouteIn(page, "DiscussionComment", "11")).toBe(
      "/o/r/discussions/7/comments/11/comment_actions_menu?form_path=x"
    )
    expect(menuRouteIn(page, "Discussion", "7")).toBe("/o/r/discussions/7/actions_menu?form_path=y")
    expect(menuRouteIn(page, "DiscussionComment", "999")).toBeNull()
  })

  /*
   * Their words and their order, and this codebase knows none of them. That is the whole design:
   * a menu that gains an entry next week gains it here too, with no change.
   */
  test("lists what their menu says, in their words", () => {
    expect(doingsIn(menu).map((one) => one.said)).toEqual([
      "Close discussion",
      "Lock conversation",
      "Delete"
    ])
  })

  test("marks the destructive one where GitHub marked it", () => {
    const doings = doingsIn(menu)

    expect(doings.find((one) => one.said === "Delete")?.danger).toBe(true)
    expect(doings.find((one) => one.said === "Lock conversation")?.danger).toBe(false)
  })

  /* A press nobody can name is a press nobody can decide to make. */
  test("leaves out an entry with no words on it", () => {
    expect(doingsIn(menu).some((one) => one.said === "")).toBe(false)
  })

  test("sends the form behind the words that were pressed", () => {
    const posting = doingNamed(menu, "Close discussion")

    expect(posting?.action).toBe("/close")
    expect(posting?.fields["authenticity_token"]).toBe("a-token")
    // Their submit button says which of several things a shared form is doing.
    expect(posting?.fields["input[state]"]).toBe("CLOSED")
  })

  test("sends nothing for words their menu does not have", () => {
    expect(doingNamed(menu, "Delete the repository")).toBeNull()
    expect(doingNamed("", "Close discussion")).toBeNull()
  })
})
