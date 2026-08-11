import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { forget, held, hold, holding } from "./held"

/**
 * Words that were typed and not yet sent, kept where a reload cannot take them.
 *
 * The one thing on any of these screens that GitHub does not have a copy of. A read can
 * always be made again; a paragraph somebody wrote and lost is gone, and losing one is the
 * complaint people have about every comment box on the web, GitHub's own included.
 */

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const issue = "issue:flazouh/stack-probe#77"

describe("keeping what was written but not sent", () => {
  test("gives back nothing where nothing was written", () => {
    expect(held(issue)).toBe("")
  })

  test("gives back what was written, after the page has gone and come again", () => {
    hold(issue, "Half a thought about this")

    expect(held(issue)).toBe("Half a thought about this")
  })

  test("keeps one subject's words out of another's", () => {
    hold(issue, "on the issue")
    hold("pull:flazouh/stack-probe#12", "on the pull request")

    expect(held(issue)).toBe("on the issue")
  })

  /*
   * Sent is gone. A draft that outlived its own posting would greet the reader with the
   * comment they just made, in a box, as though it had failed.
   */
  test("forgets a subject once its words have gone to GitHub", () => {
    hold(issue, "Half a thought")
    forget(issue)

    expect(held(issue)).toBe("")
  })

  test("forgets a subject when the box is emptied by hand", () => {
    hold(issue, "Half a thought")
    hold(issue, "   ")

    expect(held(issue)).toBe("")
    expect(holding()).toEqual([])
  })

  test("names every subject with words waiting, which is what a reader is owed", () => {
    hold(issue, "on the issue")
    hold("pull:flazouh/stack-probe#12", "on the pull request")

    expect(holding().toSorted()).toEqual([issue, "pull:flazouh/stack-probe#12"])
  })
})
