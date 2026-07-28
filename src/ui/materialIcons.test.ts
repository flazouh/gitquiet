import { describe, expect, test } from "bun:test"
import { MATERIAL_BY_EXTENSION, MATERIAL_BY_FILE_NAME, MATERIAL_SPRITE } from "./materialIcons.generated"

const sheet = new DOMParser().parseFromString(MATERIAL_SPRITE, "image/svg+xml")

const symbols = [...sheet.querySelectorAll("symbol")]

const SHAPES = "path, rect, circle, ellipse, polygon, polyline"

/**
 * Whether a shape is left to paint in whatever colour it lands in.
 *
 * Material's icons say `fill="none"` on the `<svg>` they arrive in and rely on
 * it: several of them open with a full-box rectangle that exists only to hold
 * the icon's proportions. Lose that attribute on the way into a symbol and the
 * spacer becomes a solid block in the colour of the row behind it.
 */
const paintsInWhateverItInherits = (shape: Element, symbol: Element): boolean => {
  for (let at: Element | null = shape; at !== null; at = at.parentElement) {
    if (at.hasAttribute("fill")) return false
    if (at === symbol) return true
  }
  return true
}

describe("the Material icon sheet", () => {
  test("has every icon the two tables point at", () => {
    const named = [
      ...Object.values(MATERIAL_BY_EXTENSION),
      ...Object.values(MATERIAL_BY_FILE_NAME)
    ].map((icon) => icon.name)
    const missing = [...new Set(named)].filter((name) => sheet.getElementById(name) === null)

    expect(missing).toEqual([])
  })

  test("leaves no shape to be painted in the colour of whatever is behind it", () => {
    const guilty = symbols
      .filter((symbol) =>
        [...symbol.querySelectorAll(SHAPES)].some((shape) =>
          paintsInWhateverItInherits(shape, symbol)
        )
      )
      .map((symbol) => symbol.id)

    expect(guilty).toEqual([])
  })
})
