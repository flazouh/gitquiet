import { describe, expect, it } from "bun:test"
import { pressed, pullRequestAt } from "./following"

/**
 * A press, as the two things the answer depends on: what is under the pointer and
 * which keys were down.
 */
const on = (html: string, how: Partial<Parameters<typeof pressed>[1]> = {}) => {
  document.body.innerHTML = html
  const target = document.querySelector("[data-hit]")
  return pressed(target, {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...how
  })
}

describe("the pull request an address names", () => {
  it("reads owner, repository and number", () => {
    expect(pullRequestAt("https://github.com/citrolabs/ego-lite/pull/193")).toEqual({
      owner: "citrolabs",
      repo: "ego-lite",
      number: 193
    })
  })

  it("reads one from a path, which is how our own rows write it", () => {
    expect(pullRequestAt("/citrolabs/ego-lite/pull/191")).toEqual({
      owner: "citrolabs",
      repo: "ego-lite",
      number: 191
    })
  })

  it("keeps the pull request when the link points inside it", () => {
    for (const deeper of [
      "/citrolabs/ego-lite/pull/193/files",
      "/citrolabs/ego-lite/pull/193#issuecomment-1",
      "/citrolabs/ego-lite/pull/193?w=1"
    ]) {
      expect(pullRequestAt(deeper)?.number).toBe(193)
    }
  })

  it("says nothing about anything that is not a pull request", () => {
    for (const other of [
      "/citrolabs/ego-lite",
      "/citrolabs/ego-lite/issues/193",
      "/citrolabs/ego-lite/pull/notanumber",
      "https://example.com/citrolabs/ego-lite/pull/193",
      "not a url at all"
    ]) {
      expect(pullRequestAt(other)).toBeNull()
    }
  })
})

describe("what a press means", () => {
  it("opens the card for a row", () => {
    expect(on('<a data-hit href="/citrolabs/ego-lite/pull/193">A row</a>')).toEqual({
      at: "card",
      reference: { owner: "citrolabs", repo: "ego-lite", number: 193 }
    })
  })

  it("finds the row from whatever inside it was pressed", () => {
    expect(
      on('<a href="/citrolabs/ego-lite/pull/193"><span data-hit>The title</span></a>')
    ).toEqual({
      at: "card",
      reference: { owner: "citrolabs", repo: "ego-lite", number: 193 }
    })
  })

  it("leaves a press on nothing alone", () => {
    expect(on('<div data-hit>between the rows</div>').at).toBe("nothing")
  })

  it("sends a held command to the browser, which is what the reader asked for", () => {
    for (const how of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      expect(on('<a data-hit href="/citrolabs/ego-lite/pull/193">A row</a>', how).at).toBe("browser")
    }
  })

  it("sends a link that is not a pull request to the browser", () => {
    expect(on('<a data-hit href="https://github.com/citrolabs/ego-lite">The repository</a>')).toEqual({
      at: "browser",
      href: "https://github.com/citrolabs/ego-lite"
    })
  })

  it("ignores the right button, which belongs to the platform", () => {
    expect(on('<a data-hit href="/citrolabs/ego-lite/pull/193">A row</a>', { button: 2 }).at).toBe(
      "nothing"
    )
  })
})
