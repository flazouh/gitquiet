import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { HUGEICONS } from "./hugeicons"

/**
 * The three things about this adapter that are not obvious from reading it.
 *
 * Everything else is a table of imports, and a test that a name maps to the glyph
 * beside it in the same file would only be reading the file back. What is worth
 * holding is what the screens above expect of a glyph and Hugeicons does not give
 * on its own: a word for a size, a stroke drawn for a grid twice the size it is
 * asked for, and a spinner that has to be told to turn.
 *
 * This was the desktop workspace's own copy of the table and its own copy of this
 * test. There is one table now, so the test lives beside it.
 */

afterEach(cleanup)

const drawn = (Art: (typeof HUGEICONS)["comment"], props = {}) => {
  // Drawn as an element rather than called, because that is how a screen uses it.
  const { container } = render(<Art {...props} />)
  const svg = container.querySelector("svg")
  if (svg === null) throw new Error("nothing was drawn")
  return svg
}

describe("the glyphs this interface is drawn in", () => {
  test("take a word for a size as well as a number", () => {
    // Every call site in the screens passes a number, and `Art` allows the word,
    // so the one that does not would otherwise draw at `width="medium"`.
    expect(drawn(HUGEICONS.comment, { size: "medium" }).getAttribute("width")).toBe("24")
    expect(drawn(HUGEICONS.comment, { size: 12 }).getAttribute("width")).toBe("12")
  })

  test("hold their weight at the size a row draws them", () => {
    // Drawn for 24 pixels and asked for 12: at Hugeicons' own 1.5 the stroke
    // lands on three-quarters of a pixel, which is a grey suggestion of an icon
    // rather than an icon.
    const small = Number(drawn(HUGEICONS.comment, { size: 12 }).getAttribute("stroke-width"))
    const large = Number(drawn(HUGEICONS.comment, { size: 24 }).getAttribute("stroke-width"))

    expect(small).toBeGreaterThan(large)
    expect(small).toBeGreaterThanOrEqual(2)
  })

  test("turn, when what they mean is that something is running", () => {
    // By the extension's own class, which is where the promise to stop for a
    // reader who asked the operating system for less motion is kept.
    expect(drawn(HUGEICONS["check-running"]).getAttribute("class")).toContain("t-rotate")
  })

  test("keep the class a screen gave them as well as their own", () => {
    // The tone a row paints a check in arrives this way, and an icon that drops
    // it is an icon drawn in the wrong colour.
    const svg = drawn(HUGEICONS["check-running"], { className: "text-busy" })

    expect(svg.getAttribute("class")).toContain("text-busy")
    expect(svg.getAttribute("class")).toContain("t-rotate")
  })
})
