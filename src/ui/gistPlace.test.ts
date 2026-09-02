import { describe, expect, test } from "bun:test"
import { GIST_LIST, GIST_VIEW, gistPlaceOwning } from "./gistPlace"

/**
 * The addresses, as `Place.owns` is asked about them: a path and a search, with the host
 * put back by the Place itself.
 */
describe("which gist screen owns an address", () => {
  test("a reader's own list is the list's", () => {
    expect(GIST_LIST.owns("/flazouh", "")).toBe(true)
    expect(GIST_LIST.owns("/flazouh", "?page=3")).toBe(true)
    expect(gistPlaceOwning("/flazouh", "")?.name).toBe("gist-list")
  })

  test("one gist is the gist's", () => {
    expect(GIST_VIEW.owns("/flazouh/4a3b4aaa20dcda98e882267f58198d92", "")).toBe(true)
    expect(gistPlaceOwning("/flazouh/4a3b4aaa20dcda98e882267f58198d92", "")?.name).toBe(
      "gist-view"
    )
  })

  test("neither claims the other's shape", () => {
    expect(GIST_VIEW.owns("/flazouh", "")).toBe(false)
    expect(GIST_LIST.owns("/flazouh/4a3b4aaa20dcda98e882267f58198d92", "")).toBe(false)
  })

  test("a gist's own sub-pages stay GitHub's", () => {
    // Forks and revisions are their pages and this extension draws neither, so a reader
    // pressing one must not be left looking at a screen that has hidden the body for a
    // page it has nothing to put there.
    expect(gistPlaceOwning("/flazouh/4a3b4aaa20dcda98e882267f58198d92/forks", "")).toBeNull()
    expect(
      gistPlaceOwning("/flazouh/4a3b4aaa20dcda98e882267f58198d92/revisions", "")
    ).toBeNull()
  })

  test("the site's own words are not an owner", () => {
    // `/search`, `/discover`, `/mine`. A parser that did not know them would read the
    // whole site as somebody's gist list and blank it.
    expect(gistPlaceOwning("/search", "?q=thing")).toBeNull()
    expect(gistPlaceOwning("/discover", "")).toBeNull()
    expect(gistPlaceOwning("/mine", "")).toBeNull()
  })

  test("starred is its own screen, and never a list belonging to nobody", () => {
    // `NOT_AN_OWNER` still holds the word, which is what keeps `gistListIn` from
    // reading `/starred` as a list belonging to somebody called "starred".
    expect(gistPlaceOwning("/starred", "")?.name).toBe("gist-starred")
    expect(GIST_LIST.owns("/starred", "")).toBe(false)
  })

  test("nothing at the root", () => {
    expect(gistPlaceOwning("/", "")).toBeNull()
  })

  /**
   * Both stand on the body, which is what makes them the kind of screen `plans/006`
   * calls full-replacement. Asserted rather than assumed: naming one of GitHub's regions
   * here would leave their header above ours, which is the other kind of screen and not
   * what a page of the reader's own things is.
   */
  test("both take the whole page rather than a region of GitHub's", () => {
    for (const place of [GIST_LIST, GIST_VIEW]) {
      expect(place.regions).toEqual([])
      expect(place.fallback).toBe("body")
    }
  })
})
