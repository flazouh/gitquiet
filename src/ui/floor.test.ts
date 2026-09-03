import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, test } from "bun:test"
import { FLOOR, paintFloor } from "./applyTheme"
import { tokensOf } from "../domain/theme"

/*
 * The document is shared with every other file in the run, and a desktop test
 * that painted `scope="document"` leaves the whole token set on it. "And
 * nothing else" below is a claim about what `paintFloor` writes, not about what
 * the run so far has left behind — so the ground is cleared first. This was the
 * one test in the suite that failed only under a full parallel run.
 */
beforeEach(() => {
  document.documentElement.removeAttribute("style")
})

const quiet = () => readFileSync("src/ui/quiet.css", "utf8")

/**
 * The colour behind our column, which used to be GitHub's.
 *
 * Two halves that have to agree: a value written onto the document by `Theme.tsx`,
 * and a rule in `quiet.css` that reads it. Either one alone is a page painted in
 * whatever the other assumed.
 */
describe("our floor under their page", () => {
  test("writes the pack's canvas onto the document, and nothing else", () => {
    /*
     * The whole token set cannot go here. GitHub's chrome reads Primer's names and
     * `domain/theme.ts` writes ours as aliases of them, so a document painted with
     * the set restyles their header, their footer and every page we do not draw.
     * One name of our own reaches only the rules we wrote for it.
     */
    paintFloor(document, tokensOf("gitquiet", "dark"))

    const painted = document.documentElement.style
    expect(painted.getPropertyValue(FLOOR)).toBe("#171717")
    expect(painted.getPropertyValue("--color-canvas")).toBe("")
    expect(painted.getPropertyValue("--bgColor-default")).toBe("")
  })

  test("follows the pack, so the floor is the same colour as the cards standing on it", () => {
    paintFloor(document, tokensOf("nord", "dark"))
    const nord = document.documentElement.style.getPropertyValue(FLOOR)

    paintFloor(document, tokensOf("dracula", "dark"))

    expect(document.documentElement.style.getPropertyValue(FLOOR)).not.toBe(nord)
  })

  test("is painted only where one of our screens has this page", () => {
    /*
     * Without a flag in the selector, a soft navigation off a page we draw would
     * leave our colour on GitHub's own, which is a broken site rather than a
     * theme. Two flags rather than one: `taken` is a screen that is up, `gating`
     * is a screen on its way, and both are pages of ours.
     */
    for (const rule of quiet().split("}")) {
      if (!rule.includes(FLOOR)) continue
      expect(
        rule.includes("[data-gitquiet-taken]") || rule.includes("[data-gitquiet-gating]")
      ).toBe(true)
    }
  })

  test("stays painted while one screen leaves and the next arrives", () => {
    /*
     * The gap between two of these screens is a page with nothing on it. `taken`
     * comes off the instant the first leaves and goes back on when the second is
     * up, and for the second in between the floor was GitHub's default — which
     * on the recording that found this was a white flash between two dark pages.
     *
     * `gating` is exactly that gap: set by the shell on the press, lifted when
     * the arriving screen is in place or gives up.
     */
    const body = quiet()
      .split("}")
      .find((rule) => rule.includes(FLOOR) && rule.includes("body"))

    expect(body).toContain("html[data-gitquiet-gating] body")
  })

  test("falls back to their colour for the moment before ours is known", () => {
    // Settings are read from storage, so the first paint is a tick late. An unset
    // variable makes the declaration invalid and the floor transparent, which is a
    // white flash on a dark page.
    expect(quiet()).toContain(`var(${FLOOR}, var(--bgColor-default))`)
  })

  test("takes their footer off a page that is ours, so the page cannot scroll past the card", () => {
    /*
     * The code column is pinned with `sticky`, and a sticky element can only
     * travel as far as its row is tall. GitHub's footer under our takeover gave
     * the page 114 more pixels of scroll than the row could absorb, so
     * scrolling the outer page dragged the card's header off the top — the
     * height above the row cancels out of that ledger; anything below it does
     * not. Gated on both flags for the same reason the floor is.
     */
    const footer = quiet()
      .split("}")
      .find((rule) => rule.includes("footer"))

    expect(footer).toContain("html[data-gitquiet-taken] footer")
    expect(footer).toContain("html[data-gitquiet-gating] footer")
    expect(footer).toContain("display: none")
  })

  test("covers the two wrappers Home paints inside the body", () => {
    // Measured on the page: everything between the region and `body` is transparent
    // on a pull request, and Home nests its feed in two more filled layers.
    expect(quiet()).toContain("div.feed-background[data-gitquiet-within]")
    expect(quiet()).toContain("div.color-bg-default[data-gitquiet-within]")
  })
})
