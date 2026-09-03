import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { BAR_AT } from "./barSlot"
import { CARD } from "./dress"
import { REFRACTION_ID } from "./refraction"

const glass = () => readFileSync("src/ui/glass.css", "utf8")

/** The declarations of one rule, by the selector that opens it. */
const ruleFor = (selector: string): string => {
  const sheet = glass()
  const at = sheet.indexOf(`${selector} {`)
  return at === -1 ? "" : sheet.slice(at, sheet.indexOf("}", at))
}

const paneRule = () => ruleFor(`${BAR_AT} > header`)

/** The layer the backdrop is read through: a pseudo-element, so the pane holds nothing filtered. */
const lensRule = () => ruleFor(`${BAR_AT} > header::before`)

const schemeRule = (way: "dark" | "light") =>
  ruleFor(
    way === "dark" ? `${BAR_AT}.dark > header::before` : `${BAR_AT}:not(.dark) > header::before`
  )

/** The terms of a `box-shadow`, which this file writes with the space syntax and no commas in it. */
const shadowsOf = (rule: string): ReadonlyArray<string> => {
  const at = rule.indexOf("box-shadow:")
  if (at === -1) return []
  return rule
    .slice(at + "box-shadow:".length, rule.indexOf(";", at))
    .split(",")
    .map((one) => one.trim())
}

/**
 * The bar's shape, which is the one thing about it that only makes sense over a page.
 *
 * A stylesheet rather than the component, so these are the rules a reader of `Bar.tsx`
 * would not find: that it floats, what it is made of, and the one thing it must never
 * do to the layer above it.
 */
describe("the bar as glass", () => {
  test("is reached by the id the slot actually has", () => {
    // The slot's id lives in `barSlot.ts`, and a stylesheet naming a different one is a
    // stylesheet that silently does nothing.
    expect(glass()).toContain(BAR_AT)
  })

  test("floats, with the gap on the slot rather than on the pane", () => {
    /*
     * Their header is hidden while ours is on the page and nothing else holds that band
     * open, so the sticky element has to keep its full height. Padding on the slot is the
     * gap; a margin on the pane would let the page slide up underneath it.
     */
    const rule = glass().slice(glass().indexOf(`${BAR_AT} {`))
    expect(rule).toContain("padding: 8px var(--gitquiet-gutter) 0")
  })

  test("takes the frame across and not above, height being the scarce one", () => {
    // The gutter is thirty-two on a wide window. At the sides that is the frame the page is
    // read in; above the bar it is thirty-two pixels of nothing pushing every card down.
    const rule = glass().slice(glass().indexOf(`${BAR_AT} {`))
    const [top] = /padding: (\S+)/.exec(rule)?.slice(1) ?? []

    expect(top).toBe("8px")
  })

  test("floats in the same frame the columns under it start on", () => {
    /*
     * One number in three places, which is the point of it: the bar's gutter, the gutter
     * their own feed band was adding on Home, and the inset both columns share. It was
     * twelve, twenty-four and sixteen, and a reader saw a bar at one left edge with a Rail
     * at another twenty-eight pixels in.
     *
     * The window wears this file and declares the number itself, which is the whole use of
     * a token: there are no columns in a window for the bar to start level with, so it
     * floats on the eight it always did, and the room the traffic lights take is the row's
     * to hold rather than the pane's.
     */
    expect(readFileSync("src/ui/widths.css", "utf8")).toContain("--gitquiet-gutter: 16px")
    expect(readFileSync("src/ui/widths.css", "utf8")).toContain("padding-inline: 0")
    expect(readFileSync("src/ui/widths.css", "utf8")).toContain(
      "padding-inline: var(--gitquiet-gutter)"
    )

    const window = readFileSync("desktop/src/view/style.css", "utf8")
    expect(window).toContain("--gitquiet-gutter: 8px")
    expect(window).toContain("padding-left: calc(var(--lights) - var(--gitquiet-gutter))")
  })

  test("is GitHub's own three numbers, so their body needs no rule of ours", () => {
    /*
     * Measured on a pull request at eleven widths, on the element that supplies the inset:
     * `#diff-comparison-viewer-container` is sixteen pixels below seven hundred and
     * sixty-eight, twenty-four to a thousand and eleven, and thirty-two from there up. That
     * inset wraps the region this extension draws into, so it is the one number on the page
     * we cannot restate — the frame follows it rather than fighting it.
     */
    const frame = readFileSync("src/ui/widths.css", "utf8")
    const steps = [...frame.matchAll(/--gitquiet-gutter: (\d+)px/g)].map(([, one]) => one)
    const breaks = [...frame.matchAll(/@media \(min-width: (\d+)px\)/g)].map(([, one]) => one)

    expect(steps).toEqual(["16", "24", "32"])
    expect(breaks).toEqual(["768", "1012"])
  })

  test("mixes its fill from the pack, so twenty-odd packs each get their own glass", () => {
    // A literal rgba here would be one pack's glass on every other pack's bar, which is
    // the fault `theme.ts` exists to prevent.
    expect(glass()).toContain("color-mix(in oklab, var(--color-surface) 55%, transparent)")
  })

  test("turns its corners exactly as the cards under it do", () => {
    /*
     * Not a number of its own. The pane floats over a column of cards, and a bar at one radius above
     * a card at another is two ideas of the same corner in one window.
     *
     * Read from `dress.ts`, which is what the cards actually wear. A first version of this test
     * matched the bar to the class on `Section.tsx` (`rounded-md`, six pixels) while two
     * stylesheets took the cards to twelve, and reported parity with a number nobody saw.
     */
    expect(CARD).toContain("rounded-lg")
    expect(paneRule()).toContain("border-radius: var(--radius-lg)")
  })

  test("is solid where a backdrop cannot be blurred", () => {
    // Translucent with nothing blurring behind it is not subtler, it is text over a diff.
    const fallback = glass().slice(glass().indexOf("@supports not"))
    expect(fallback).toContain("background-color: var(--color-surface)")
  })

  test("brightens or darkens the backdrop the way the pack needs", () => {
    // Measured: 5.0:1 for the muted ink with the term, 2.0:1 without it.
    expect(glass()).toContain(`${BAR_AT}.dark > header`)
    expect(glass()).toContain(`${BAR_AT}:not(.dark) > header`)
    expect(glass()).toContain("brightness(0.74)")
    expect(glass()).toContain("brightness(1.18)")
  })

  test("never filters the slot, because the palette is fixed inside it", () => {
    /*
     * `backdrop-filter` makes an element the containing block for `position: fixed` in it,
     * and the palette is rendered into this slot — see `TheBar.tsx`. Filter the slot and a
     * full-screen overlay starts covering the bar instead of the page.
     */
    const slot = glass().slice(glass().lastIndexOf(`${BAR_AT} {`))
    expect(slot).toContain("backdrop-filter: none")
  })

  test("is worn by both hosts, off one file rather than off a copy of it", () => {
    /*
     * The window floats its bar in the row the traffic lights sit in, and it was given the
     * corner and the cast by hand: two of these declarations retyped, and the lens left out
     * on the grounds that a window has nothing behind the pane to bend. It has. What it
     * reads is the window's own fill, which comes back a shade darker on a dark pack and
     * lighter on a light one, and the lit edge and the cast are what make the corner read.
     *
     * The list scrolling under the row was tried and taken out — the strip left of the pane
     * belongs to the traffic lights — so the two hosts give the lens different things to
     * read. They read it with the same four layers, because one pane drawn twice is one
     * pane that drifts.
     */
    expect(readFileSync("src/ui/styles.css", "utf8")).toContain('@import "./glass.css"')
    expect(readFileSync("desktop/src/view/style.css", "utf8")).toContain(
      '@import "../../../src/ui/glass.css"'
    )
  })

  /*
   * Four layers, in the order the references stack them.
   *
   * The first attempt at this was one layer doing everything: a twenty-eight pixel blur, a mixed
   * fill and a hairline of white. That is frosted glass. A frosted pane takes the page away and
   * hands back a soft grey; a glass pane hands the page back bent, which is why every
   * implementation of the effect uses a *small* blur — three pixels in
   * `lucasromerodb/liquid-glass-effect-macos` — and spends its budget on refraction instead.
   *
   * So, from the page upwards: the backdrop, bent by the lens and softened a little; the pack's
   * fill over it; the light on the inside of the edge; and the words. The bend and the fill are on
   * one layer, and it has to be that one, because a `backdrop-filter` samples everything painted
   * under it — a fill below the lens would be the thing that got bent, and the page behind it
   * would never show through at all.
   */
  test("bends the page rather than only softening it", () => {
    expect(lensRule()).toContain(`url(#${REFRACTION_ID})`)
  })

  test("blurs by a little, because the character is in the bend and not in the blur", () => {
    const blur = Number(/blur\((\d+(?:\.\d+)?)px\)/.exec(lensRule())?.[1])

    expect(blur).toBeGreaterThan(0)
    // Three in the reference. Past about eight the bend stops being legible under the softness.
    expect(blur).toBeLessThanOrEqual(8)
  })

  test("carries the pack's fill on the lens, above what the lens bent", () => {
    expect(lensRule()).toContain("color-mix(in oklab, var(--color-surface) 55%, transparent)")
  })

  test("leaves the pane itself unfiltered, so nothing in it loses the top layer", () => {
    /*
     * The other half of the constraint below. A `backdrop-filter` on the pane made it the
     * containing block for everything positioned inside it, top layer included — the settings
     * sheet opened as a dimmed page with nothing on it. On a pseudo-element it cannot: a
     * pseudo-element is not an ancestor of anything.
     */
    expect(paneRule()).not.toContain("backdrop-filter")
  })

  test("lights the inside of its edge with a glow, not with a line", () => {
    // A one pixel hairline is a border, and a border is what `dress.ts` spends a file avoiding.
    // The references glow inward with a spread, so the light has somewhere to fall off to.
    for (const rule of [schemeRule("dark"), schemeRule("light")]) {
      const inner = shadowsOf(rule).filter((one) => one.includes("inset"))

      expect(inner.length).toBeGreaterThan(0)
      expect(inner.some((one) => /inset 0 0 \d+px -\d+px/.test(one))).toBe(true)
    }
  })

  test("draws no ring around the top bar", () => {
    for (const rule of [schemeRule("dark"), schemeRule("light")]) {
      const ring = shadowsOf(rule).find((one) => /^inset 0 0 0 \d+px/.test(one))
      expect(ring).toBeUndefined()
    }
  })

  test("keeps that glow a rim, so the rest of the pane is one flat fill", () => {
    /*
     * The references pull the light in by twenty pixels, and on the cards they light that is a rim.
     * On a forty pixel strip it is a wash: sampled across the left edge it ramped from 38 to 23 over
     * thirteen pixels and never became a fill, and a fill with a gradient at its edge is read as a
     * thick grey border. So the blur stays under a quarter of the pane's height, and the pane is
     * flat everywhere the rim does not reach.
     */
    for (const rule of [schemeRule("dark"), schemeRule("light")]) {
      const spread = shadowsOf(rule)
        .filter((one) => /^inset 0 0 /.test(one))
        .map((one) => Number.parseFloat(one.split(/\s+/)[3] ?? "0"))

      expect(spread.length).toBeGreaterThan(0)
      for (const blur of spread) expect(blur).toBeLessThanOrEqual(8)
    }
  })

  test("casts one shadow outward, and it is separation rather than contact", () => {
    const cast = shadowsOf(paneRule()).filter((one) => !one.includes("inset"))

    expect(cast.length).toBe(1)
    expect(cast[0]).toMatch(/-?\d+px/)
  })

  test("insets a toast by the same gutter as the bar and the columns", () => {
    /*
     * The inset is stated here because it is a fact about the place — a page whose columns
     * end at eight pixels — and the component that raises toasts is in both shells.
     */
    const sheet = readFileSync("src/ui/glass.css", "utf8")

    expect(sheet).toContain("html[data-gitquiet-bar-standing] [data-sonner-toaster]")
    expect(sheet).toContain("--offset-right: var(--gitquiet-gutter) !important")
    expect(sheet).toContain("--offset-bottom: var(--gitquiet-gutter) !important")
    // The window keeps the twelve the component asks for: this file is only ever loaded
    // over a page of theirs.
    expect(readFileSync("desktop/src/view/style.css", "utf8")).not.toContain("--offset-")
  })
})
