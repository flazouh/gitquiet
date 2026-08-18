import { describe, expect, it } from "bun:test"
import { theirPage } from "./theirPage"

/**
 * Where a press on a link in this window is sent, which is the whole of what the
 * rule decides: the browser, a screen in here, or nowhere at all.
 *
 * The interface above is written for a page of GitHub's and writes both kinds of
 * address, so this is read against both. The third answer is the one worth the
 * file: only "nowhere" lets a press reach the webview, so anything that would move
 * the webview and is not read as a place is the app replaced by a page.
 */
describe("what a link in the window means", () => {
  it("sends a whole address to the browser, as it always did", () => {
    expect(theirPage("https://github.com/flazouh/gitquiet/commit/abc123")).toEqual({
      at: "outside",
      url: "https://github.com/flazouh/gitquiet/commit/abc123"
    })
  })

  /*
   * Somebody's own link in a description is not GitHub's and is still a page, so it
   * goes to the browser like the rest of them.
   */
  it("sends an address that is nobody's to the browser as well", () => {
    expect(theirPage("https://effect.website/docs")).toEqual({
      at: "outside",
      url: "https://effect.website/docs"
    })
  })

  /*
   * The anchor's own resolution, which is what a browser would follow: an uppercase
   * scheme, a bare host, a `..` in the path all come back normalised. Only for an
   * address that is already whole — a path is resolved against GitHub instead, since
   * the anchor resolves against a build directory.
   */
  it("takes the address the anchor resolved, which is the one a browser would use", () => {
    expect(theirPage("HTTPS://GitHub.com/x/../y", "https://github.com/y")).toEqual({
      at: "outside",
      url: "https://github.com/y"
    })
  })

  /*
   * The fault this rule was widened for. The bar writes paths, and the inbox in the
   * title row unloaded the app: one webview, no address bar, and GitHub's own
   * notifications page where the interface had been.
   */
  it("sends a bare path to GitHub in the browser, rather than into this webview", () => {
    expect(theirPage("/notifications")).toEqual({
      at: "outside",
      url: "https://github.com/notifications"
    })
    expect(theirPage("/flazouh/gitquiet/pulls")).toEqual({
      at: "outside",
      url: "https://github.com/flazouh/gitquiet/pulls"
    })
  })

  /*
   * Except a pull request, which is the one link this app is for: the press is
   * stopped here and the list turns it into the card on the way up.
   *
   * Both spellings, because the interface writes both and one link cannot mean two
   * things. Read off the path alone, an absolute pull request went to the browser
   * while the same one written as a path opened the card.
   */
  it("keeps a pull request inside, whichever way it is written", () => {
    expect(theirPage("/flazouh/gitquiet/pull/42")).toEqual({ at: "inside" })
    expect(theirPage("/flazouh/gitquiet/pull/42/files")).toEqual({ at: "inside" })
    expect(theirPage("https://github.com/flazouh/gitquiet/pull/42")).toEqual({ at: "inside" })
    expect(
      theirPage("https://github.com/flazouh/gitquiet/pull/42", "https://github.com/flazouh/gitquiet/pull/42")
    ).toEqual({ at: "inside" })
  })

  /*
   * And a link nobody can place is kept inside too, which is the difference between
   * this rule and the one it replaced.
   *
   * `//host/x` is a host of its own, `docs/x` and `?tab=` are relative to a build
   * directory, and each of them used to fall through to the webview: the app
   * replaced by a page, in a window with no address bar and no way back. There is
   * nowhere to send them, so they are stopped and nothing is opened.
   */
  it("stops a link it cannot place, rather than letting the webview follow it", () => {
    expect(theirPage("//evil.example.com/x")).toEqual({ at: "inside" })
    expect(theirPage("docs/writing.md")).toEqual({ at: "inside" })
    expect(theirPage("?tab=readme")).toEqual({ at: "inside" })
    expect(theirPage("../up")).toEqual({ at: "inside" })
  })

  it("leaves alone what is not somewhere to go", () => {
    expect(theirPage("#top")).toEqual({ at: "nowhere" })
    expect(theirPage("mailto:someone@example.com")).toEqual({ at: "nowhere" })
    expect(theirPage("tel:+33123456789")).toEqual({ at: "nowhere" })
    expect(theirPage("")).toEqual({ at: "nowhere" })
  })
})
