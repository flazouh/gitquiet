import { describe, expect, it } from "bun:test"
import { BROWSER, pullRequestAt, where } from "./where"

/**
 * A press, as the three things the answer depends on: what is under the pointer, what
 * that thing is a link to, and which keys were down.
 */
const on = (html: string, how: Partial<Parameters<typeof where>[1]> = {}) => {
  document.body.innerHTML = html
  const target = document.querySelector("[data-hit]")
  return where(target, {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...how
  })
}

const A_ROW = '<a data-hit href="/citrolabs/ego-lite/pull/193">A row</a>'

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

describe("a press this window has no business in", () => {
  it("is one on no link at all", () => {
    expect(on("<div data-hit>between the rows</div>").at).toBe("nothing")
  })

  it("is one of the right button, which draws the platform's own menu", () => {
    expect(on(A_ROW, { button: 2 }).at).toBe("nothing")
  })

  it("is a jump inside the page, or a mail client, or a phone", () => {
    for (const href of ["#top", "mailto:nobody@example.com", "tel:+33123456789", "javascript:void 0"]) {
      expect(on(`<a data-hit href="${href}">Somewhere else entirely</a>`).at).toBe("nothing")
    }
  })
})

describe("a press this window answers itself", () => {
  it("opens the card for a row", () => {
    expect(on(A_ROW)).toEqual({
      at: "card",
      reference: { owner: "citrolabs", repo: "ego-lite", number: 193 }
    })
  })

  it("finds the row from whatever inside it was pressed", () => {
    expect(on('<a href="/citrolabs/ego-lite/pull/193"><span data-hit>The title</span></a>')).toEqual({
      at: "card",
      reference: { owner: "citrolabs", repo: "ego-lite", number: 193 }
    })
  })

  it("opens the card for a pull request written out in full, which is how a comment writes one", () => {
    expect(on('<a data-hit href="https://github.com/citrolabs/ego-lite/pull/12">#12</a>')).toEqual({
      at: "card",
      reference: { owner: "citrolabs", repo: "ego-lite", number: 12 }
    })
  })
})

describe("a press some screen in here is about to answer", () => {
  it("is a commit, which the card draws in a panel of its own", () => {
    expect(
      on('<a data-hit href="https://github.com/citrolabs/ego-lite/commit/3d3c42e">A commit</a>').at
    ).toBe("stopped")
  })

  /*
   * The invariant this file exists for. There is no address bar and no back button in
   * here, so a link the webview follows does not open a page — it replaces the app
   * with one, and the only way back is to quit.
   */
  it("is anything else that cannot be placed, because following one ends the app", () => {
    for (const href of ["//example.com/elsewhere", "./relative", "sftp://box/thing"]) {
      expect(on(`<a data-hit href="${href}">Nowhere this knows</a>`).at).toBe("stopped")
    }
  })
})

describe("a press the reader's browser answers", () => {
  it("is a page of GitHub's this window does not draw", () => {
    expect(on('<a data-hit href="https://github.com/citrolabs/ego-lite">The repository</a>')).toEqual({
      at: "outside",
      url: "https://github.com/citrolabs/ego-lite"
    })
  })

  it("is a path of GitHub's, resolved against theirs rather than this build folder", () => {
    expect(on('<a data-hit href="/notifications">The inbox</a>')).toEqual({
      at: "outside",
      url: "https://github.com/notifications"
    })
  })

  it("is somebody's own link, written in a description", () => {
    expect(on('<a data-hit href="https://example.com/why">Why</a>')).toEqual({
      at: "outside",
      url: "https://example.com/why"
    })
  })

  it("is a held key or the middle button, that being the reader asking for elsewhere", () => {
    for (const how of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(on(A_ROW, how)).toEqual({
        at: "outside",
        url: "https://github.com/citrolabs/ego-lite/pull/193"
      })
    }
  })

  /*
   * The card's own way out, which is the whole reason this beats the card rule rather
   * than losing to it: it points at the pull request already on the screen, so every
   * other rule in here would answer a press on it by drawing that screen again. It
   * said "Open on GitHub" and did nothing at all.
   */
  it("is a link that says on itself that it means the browser", () => {
    expect(
      on(
        `<a data-hit ${BROWSER} href="https://github.com/citrolabs/ego-lite/pull/193">Open on GitHub</a>`
      )
    ).toEqual({ at: "outside", url: "https://github.com/citrolabs/ego-lite/pull/193" })
  })
})
