import { describe, expect, test } from "bun:test"

const sheet = await Bun.file(new URL("./motion.css", import.meta.url)).text()

/** The `prefers-reduced-motion: reduce` block, which is the only part of the sheet read here. */
const stillness = (() => {
  const opens = sheet.indexOf("@media (prefers-reduced-motion: reduce)")
  expect(opens).toBeGreaterThan(-1)
  return sheet.slice(opens)
})()

/**
 * What the sheet promises a reader who has asked their machine for less movement.
 *
 * Read as text rather than through a browser because there is no browser here, and because the
 * thing worth protecting is a decision rather than a computed style: the block says in its own
 * comments that colour stays and movement goes, and it is easy to write a rule that quietly
 * takes both. It had one — a catch-all that pinned every transition in the interface to a
 * hundredth of a millisecond, hover included, so a reduced-motion reader got a button that
 * changed colour by teleporting while the comment beside it said colour aids comprehension.
 */
describe("less movement, for a reader who asked for it", () => {
  test("keeps colour, which is feedback and not motion", () => {
    // Whatever shape the narrowing takes, the properties that carry colour have to survive it.
    expect(stillness).toMatch(/transition-property:[^;]*background-color/)
    expect(stillness).toMatch(/transition-property:[^;]*\bcolor\b/)
  })

  test("does not pin every transition in the interface to nothing", () => {
    // The old catch-all, by the property it set on `*`. Its replacement narrows what may move
    // rather than how long everything is allowed to take.
    expect(stillness).not.toMatch(/transition-duration:\s*0\.01ms/)
  })

  test("still takes away the travel: no width, no transform", () => {
    const allowed = stillness.match(/transition-property:([^;]*);/g)?.join(" ") ?? ""

    expect(allowed).not.toMatch(/transform/)
    expect(allowed).not.toMatch(/\bwidth\b/)
  })
})

/**
 * `will-change` promises the compositor a change that is coming.
 *
 * Kept out of this sheet entirely rather than balanced. Every declaration it had outlived the
 * animation it was for — a row keeps `t-row-in` until the list is rebuilt, so a hint for a 250ms
 * entrance sat on a hundred rows for as long as the page was open — and the promise is not free:
 * it lifts the element onto its own layer, holds the memory for it, and makes it a stacking
 * context for good. The comment above `t-panels` in this sheet is the record of that last part
 * costing an afternoon, when a filter menu ended up painting underneath the Courts below it.
 * Transform and opacity are composited without being asked.
 */
describe("promises to the compositor", () => {
  test("are not made in this sheet", () => {
    expect(sheet).not.toMatch(/will-change:/)
  })
})

/**
 * A button with more than one word in it, which is every button that asks GitHub for something.
 *
 * The cell is the whole of the promise: the words stand on top of each other rather than in place
 * of each other, so the box is as wide as the widest of them before a press and after one. Read as
 * text because the property that matters is a layout decision rather than a rendered pixel, and
 * because the way to break this is to move a word out of the cell rather than to restyle it.
 */
describe("what a button says while it waits", () => {
  test("keeps every word in one cell, so the box cannot change width", () => {
    expect(sheet).toMatch(/\.t-says \{[^}]*grid-template-areas: "word"/)
    expect(sheet).toMatch(/\.t-say \{[^}]*grid-area: word/)
  })

  test("stands the words nobody is being told about off the cell", () => {
    // `aria-hidden` is the mark, on purpose: a word nobody can see and a word nobody is told
    // about are the same word, and two marks for one fact is one of them going stale.
    expect(sheet).toMatch(/\.t-say\[aria-hidden\] \{[^}]*opacity: 0/)
    expect(sheet).toMatch(/\.t-say\[aria-hidden\]\[data-past\] \{[^}]*translateY/)
  })

  test("swaps them between two frames for a reader who asked for less movement", () => {
    expect(stillness).toMatch(/\.t-say \{[^}]*transition: none/)
  })
})

describe("a row's menu shut by a key", () => {
  test("has its closing keyframe dropped rather than shortened", () => {
    // Radix holds the content mounted until an animation it can see has finished, so `none` is
    // both no animation and no wait. See `data-snap` in `Doings.tsx` for who sets the mark.
    expect(sheet).toMatch(/\.t-dropdown\[data-snap\]\s*{\s*animation: none;/)
  })
})

/**
 * The sheet as the one place a duration or a curve is chosen.
 *
 * Two copies of a number are two chances to be inconsistent, and this sheet's whole argument is
 * that features written a day apart should look related. These are cheap to check as text, and
 * the alternative is noticing by eye that one card opens differently from its neighbour.
 */
describe("durations and curves", () => {
  test("are named, never written out", () => {
    // Milliseconds and bare cubic-beziers, outside the block that defines the tokens.
    const past = sheet.slice(sheet.indexOf("--panel-in-blur"))

    expect(past).not.toMatch(/animation:[^;]*\d+ms/)
    expect(past).not.toMatch(/animation:[^;]*cubic-bezier/)
  })

  test("do not include one the sheet no longer believes in", () => {
    // 400ms was over this scale's own budget for anything a reader waits on, and nothing used it.
    expect(sheet).not.toMatch(/--duration-very-slow/)
  })

  test("shows the finished check rather than a half-drawn one", () => {
    /*
     * The drawn check answers a spinner, so the mark itself is the information and the drawing
     * is the part a reader asked to be spared. A rule that only stopped the animation would
     * leave a ring with no tick in it, which says nothing at all.
     */
    expect(stillness).toMatch(/\.t-drawn > path \{[^}]*animation: none/)
    expect(stillness).toMatch(/\.t-drawn > path \{[^}]*stroke-dashoffset: 0/)
  })
})
