import { describe, expect, it } from "bun:test"
import { theirPage } from "./theirPage"

/**
 * Where a press on a link in this window is sent, which is the whole of what the
 * rule decides: the browser, the screen below, or nowhere.
 *
 * The interface above is written for a page of GitHub's and writes both kinds of
 * address, so this is read against both.
 */
describe("what a link in the window means", () => {
  it("sends a whole address to the browser, as it always did", () => {
    expect(theirPage("https://github.com/flazouh/gitquiet/commit/abc123")).toBe(
      "https://github.com/flazouh/gitquiet/commit/abc123"
    )
  })

  it("prefers the address the anchor resolved, so a relative one arrives whole", () => {
    expect(theirPage("https://github.com/x", "https://github.com/x?y=1")).toBe(
      "https://github.com/x?y=1"
    )
  })

  /*
   * The fault this rule was widened for. The bar writes paths, and the inbox in the
   * title row unloaded the app: one webview, no address bar, and GitHub's own
   * notifications page where the interface had been.
   */
  it("sends a bare path to GitHub in the browser, rather than into this webview", () => {
    expect(theirPage("/notifications")).toBe("https://github.com/notifications")
    expect(theirPage("/flazouh/gitquiet/pulls")).toBe("https://github.com/flazouh/gitquiet/pulls")
  })

  /*
   * Except a pull request, which is the one link this app is for: the list reads the
   * press on the way up and the window becomes that card. This rule stands down
   * rather than claiming it, because the list's handler stands down as soon as this
   * one has answered. See `following.ts`.
   */
  it("leaves a pull request to the screen, which turns it into the card", () => {
    expect(theirPage("/flazouh/gitquiet/pull/42")).toBeNull()
    expect(theirPage("/flazouh/gitquiet/pull/42/files")).toBeNull()
  })

  it("leaves alone what is not somewhere to go", () => {
    expect(theirPage("#top")).toBeNull()
    expect(theirPage("mailto:someone@example.com")).toBeNull()
    // Not an address on GitHub either: `//` is a scheme-relative host of its own.
    expect(theirPage("//evil.example.com/x")).toBeNull()
  })
})
