import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { CHIP, FIELD, HERE, INSIDE, PILL, PRESSABLE, TINT } from "./dress"

const EVERY_DRESS = { CHIP, FIELD, PILL, PRESSABLE }

describe("how a small control is dressed", () => {
  test("has no border in it, which is the point of the file", () => {
    // The guard, and the reason this is a module rather than a habit: a border
    // added here would be a border in every chip and field at once, and both
    // shells would go back to overriding it component by component.
    for (const [name, dress] of Object.entries(EVERY_DRESS)) {
      expect(dress, name).not.toContain("border")
    }
  })

  test("separates with a fill and a corner instead", () => {
    for (const [name, dress] of Object.entries(EVERY_DRESS)) {
      expect(dress, name).toContain(TINT)
      expect(dress, name).toContain("rounded")
    }
  })

  test("leaves the hover to the call site, since a disabled control has none", () => {
    // A disabled button that deepens under the pointer promises something it will
    // not do, and only the call site knows whether its control can be disabled.
    // The variant, not the token: the fill itself is `bg-hover`, which is the
    // resting state here rather than a reaction to a pointer.
    expect(PRESSABLE).not.toContain("hover:")
  })

  test("says nothing about size, which belongs to where the control stands", () => {
    // A field in the Rail is not the size of a field on Home. Metrics here would
    // be a fight at every call site instead of a decision at one.
    for (const [name, dress] of Object.entries(EVERY_DRESS)) {
      expect(dress, name).not.toMatch(/\b(h-|w-|min-w-|text-xs|text-sm|grow|flex-1)/)
    }
  })
})

/**
 * The accent, kept for what it means.
 *
 * Six places painted "you are here" in `bg-accent-muted` with `text-ink-accent` on it: the Rail's
 * destination, the bar's current tab, a filter that is on, the involvement tabs, the settings page
 * being read and a Following badge. A colour spent six times is a colour that says nothing, and a
 * bright blue tint under bright blue text is the cheapest thing an interface can do.
 */
describe("where the reader is", () => {
  test("is one step of the ladder, not the accent", () => {
    expect(HERE).toContain("bg-active")
    expect(HERE).not.toContain("accent")
  })

  test("is darker than a pointer ever makes a row, so the two cannot be confused", () => {
    // `bg-hover` and `bg-active` are the pack's own two steps: whatever a pack tunes them to,
    // the resting tint is the lighter one.
    expect(HERE).not.toContain(TINT)
  })

  test("takes the ink to full strength rather than colouring it", () => {
    expect(HERE).toContain("text-ink")
    expect(HERE).not.toContain("text-ink-accent")
  })

  test("is not what the section around the page wears, or the two say one thing", () => {
    // The fault this pair exists to fix: the bar's Pull requests tab wore `HERE` on
    // `/owner/repo/pull/542` as well as on the list, and a reader asked why the list looked
    // selected while they were reading one pull request.
    expect(INSIDE).not.toBe(HERE)
  })

  test("is the only way this interface paints a selection", () => {
    // Read off the sources, because the fault this replaces was six call sites agreeing with
    // each other rather than one decision. A seventh would have gone the same quiet way.
    const painted = readdirSync("src/ui")
      .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
      .filter((name) => readFileSync(`src/ui/${name}`, "utf8").includes("bg-accent-muted"))

    expect(painted).toEqual([])
  })
})

/**
 * The section holding the page, which is the state between being on a tab and not being in it.
 *
 * The bar had two states for three situations. Standing on `/owner/repo/pulls` and standing on
 * `/owner/repo/pull/542` were drawn and announced identically, so the fill that means "this is
 * the one" was on a link to a page nobody was on.
 */
describe("the section the reader is in", () => {
  test("fills nothing at all, both fills being spoken for", () => {
    // `TINT` is what anything takes under a pointer and `HERE` is the page being read. A third
    // fill would be a step of a ladder that has two.
    expect(INSIDE).not.toContain("bg-")
  })

  test("carries the ink instead, so it is not one of the sections the reader is not in", () => {
    expect(INSIDE).toContain("text-ink")
    expect(INSIDE).not.toContain("text-ink-muted")
    expect(INSIDE).not.toContain("accent")
  })

  test("draws no line, which is GitHub's own mark for this and not a material we have", () => {
    // Their underline under the containing tab reads as context and is the right idea. The top
    // of `dress.ts` exists to keep lines out, and a rule under one tab would be the only line
    // left in the strip.
    expect(INSIDE).not.toContain("border")
    expect(INSIDE).not.toContain("underline")
  })
})
