import { describe, expect, test } from "bun:test"
import { asForm, signingIn } from "./saying"

const pageWith = (markup: string): Document =>
  new DOMParser().parseFromString(`<!doctype html><body>${markup}</body>`, "text/html")

const FORM = `
  <form action="/owner/repo/pull/21/comment?sticky=true" method="post">
    <input type="hidden" name="authenticity_token" value="signed-for-this-render">
    <input type="hidden" name="timestamp" value="1753970000000">
    <input type="hidden" name="timestamp_secret" value="secret-for-this-render">
    <input type="hidden" name="issue" value="21">
    <input type="hidden" name="" value="ignored-blank-name">
    <input type="hidden" name="path" value="">
    <textarea id="new_comment_field" name="comment[body]"></textarea>
  </form>
`

describe("the form GitHub's conversation box posts", () => {
  test("is read off the page, action and signed fields together", () => {
    const signing = signingIn(pageWith(FORM))

    expect(signing?.action).toBe("/owner/repo/pull/21/comment?sticky=true")
    expect(signing?.fields).toEqual({
      authenticity_token: "signed-for-this-render",
      timestamp: "1753970000000",
      timestamp_secret: "secret-for-this-render",
      issue: "21"
    })
  })

  test("is absent on a tab that has no comment box, which is not a fault", () => {
    expect(signingIn(pageWith("<div>the files tab</div>"))).toBeNull()
  })

  /*
   * A token that arrived empty is a form that will be refused, and GitHub answer
   * that refusal with their whole page rather than with a sentence. Better to stop
   * here, where what went wrong can still be said.
   */
  test("is absent when a signed field is empty rather than posted half-signed", () => {
    const half = FORM.replace('name="timestamp_secret" value="secret-for-this-render"', 'name="timestamp_secret" value=""')

    expect(signingIn(pageWith(half))).toBeNull()
  })

  test("sends the body beside the signed fields, urlencoded as their form does", () => {
    const signing = signingIn(pageWith(FORM))
    const sent = new URLSearchParams(asForm(signing!, "one & two"))

    expect(sent.get("comment[body]")).toBe("one & two")
    expect(sent.get("authenticity_token")).toBe("signed-for-this-render")
    expect(sent.get("issue")).toBe("21")
  })
})
