import { describe, expect, test } from "bun:test"
import { oursToOpen } from "./pressing"
import { WANTED } from "./screens"

/**
 * Which presses this extension answers, and the one it deliberately does not.
 *
 * The rule is short and the reason it is worth a test is what happens when a page is left
 * out: the press falls through to GitHub's own router, which on a measured press of a
 * commit row moved the address three point eight seconds after the reader let go. Nothing
 * of ours is slow on that path — the commit was in the store and the screen took the page
 * in the same frame the address moved — so the whole of the wait was theirs.
 */

describe("a press this extension answers itself", () => {
  test("is any link to a page it draws", () => {
    const left = WANTED.filter((page) => !oursToOpen(page, "commits"))

    // Every screen except the form, which is reached by pressing New issue and is the one
    // page here with nothing to read: no memory to open from and nothing to be quick about.
    expect(left).toEqual(["raise"])
  })

  test("is not a link to a page of GitHub's that no screen of ours draws", () => {
    expect(oursToOpen(null, "commits")).toBe(false)
  })

  /*
   * A commit inside a pull request is a panel rather than a page: our own screen puts it
   * where the branch's files were, so the conversation, the checks and the review are still
   * beside it. Answering that press would take the reader off the pull request instead.
   */
  test("is a commit anywhere except on a pull request, where it opens in place", () => {
    expect(oursToOpen("commit", "commits")).toBe(true)
    expect(oursToOpen("commit", "commit")).toBe(true)
    expect(oursToOpen("commit", "repo-home")).toBe(true)
    expect(oursToOpen("commit", "pull-request")).toBe(false)
  })

  test("is an issue, which was left out and had the same three seconds of theirs", () => {
    expect(oursToOpen("issue", "repo-issues")).toBe(true)
    expect(oursToOpen("issue", "pull-request")).toBe(true)
  })
})
