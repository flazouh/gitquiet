import { afterEach, describe, expect, test } from "bun:test"
import { hintRead, type Hint, showLingering } from "./lingeringHint"
import { RIPE } from "./lingering"

/**
 * The panel is a development tool, and the thing worth testing about it is that it says
 * what the loop actually decided rather than something close to it. A hint that rounds a
 * rate the wrong way sends somebody looking for a bug in the accumulator.
 */

const STILL = { x: 0, y: 0 }

const hint = (over: Partial<Hint> = {}): Hint => ({
  travel: STILL,
  lingering: new Map(),
  seen: null,
  read: 0,
  atMost: 12,
  sparing: false,
  ...over
})

/** A document of its own per test, so no test can read what another one drew. */
const aPage = () => new DOMParser().parseFromString("<!doctype html><body>", "text/html")

const shown = (page: Document) => page.getElementById("gitquiet-lingering-hint")?.textContent ?? ""

afterEach(() => {
  // The last page read is remembered across frames on purpose, so it is cleared by hand.
  hintRead("")
})

describe("the read-ahead hint", () => {
  test("says nothing is near when nothing is", () => {
    const page = aPage()
    showLingering(hint(), page)

    expect(shown(page)).toContain("nothing near")
  })

  test("draws what a link has earned, out of what it needs", () => {
    const page = aPage()
    showLingering(
      hint({
        lingering: new Map([["oven-sh/bun/1", RIPE / 2]]),
        seen: { key: "oven-sh/bun/1", reach: 0, forward: 1 }
      }),
      page
    )

    expect(shown(page)).toContain("oven-sh/bun/1")
    expect(shown(page)).toContain(`${RIPE / 2}/${RIPE}`)
    // Half the bar filled, because it is half way there.
    expect(shown(page)).toContain("███████░░░░░░░")
  })

  test("shows the rate a link is earning at, and why", () => {
    const page = aPage()
    showLingering(
      hint({
        lingering: new Map([["one", 20]]),
        seen: { key: "one", reach: 96, forward: 0.5 }
      }),
      page
    )

    // Arm's length and half aimed: a third of the distance rate, halved again by heading.
    expect(shown(page)).toContain("96px  aim 0.50  ×0.15")
  })

  test("marks the link that is earning apart from the ones going cold", () => {
    const page = aPage()
    showLingering(
      hint({
        lingering: new Map([
          ["earning", 90],
          ["leaving", 40]
        ]),
        seen: { key: "earning", reach: 0, forward: 1 }
      }),
      page
    )

    expect(shown(page)).toContain("▸ earning")
    expect(shown(page)).toContain("  leaving")
    expect(shown(page)).toContain("gone cold")
  })

  test("puts the link with the most behind it at the top", () => {
    const page = aPage()
    showLingering(hint({ lingering: new Map([["behind", 10], ["ahead", 120]]) }), page)

    expect(shown(page).indexOf("ahead")).toBeLessThan(shown(page).indexOf("behind"))
  })

  test("says when data saver has the whole thing switched off", () => {
    const page = aPage()
    showLingering(hint({ sparing: true }), page)

    expect(shown(page)).toContain("sparing data")
    expect(shown(page)).not.toContain("read 0/12")
  })

  test("names the page a ripe link sent for", () => {
    const page = aPage()
    hintRead("oven-sh/bun/1")
    showLingering(hint(), page)

    expect(shown(page)).toContain("read ▸ oven-sh/bun/1")
  })

  /*
   * The panel is drawn in front of a moving pointer, so a frame that changed nothing must
   * cost nothing. Without this it rewrites sixty times a second while a hand rests.
   */
  test("leaves the panel alone on a frame that says the same thing", () => {
    const page = aPage()
    const same = hint({ lingering: new Map([["one", 40]]) })

    showLingering(same, page)

    const panel = page.getElementById("gitquiet-lingering-hint")
    const writes = new MutationObserver(() => {})
    writes.observe(panel as Node, { childList: true, characterData: true, subtree: true })

    showLingering(same, page)
    expect(writes.takeRecords()).toHaveLength(0)

    showLingering(hint({ lingering: new Map([["one", 90]]) }), page)
    expect(writes.takeRecords().length).toBeGreaterThan(0)

    writes.disconnect()
  })

  test("draws itself again where the page it was on took it away", () => {
    const page = aPage()
    showLingering(hint({ lingering: new Map([["one", 40]]) }), page)
    page.getElementById("gitquiet-lingering-hint")?.remove()

    showLingering(hint({ lingering: new Map([["one", 40]]) }), page)

    expect(shown(page)).toContain("one")
  })
})
