import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { keepRefraction, REFRACTION_ID } from "./refraction"

const page = (): Document => document.implementation.createHTMLDocument("t")

const glass = () => readFileSync("src/ui/glass.css", "utf8")

/**
 * The lens the bar looks through.
 *
 * A blur alone is frosted glass: the page behind it goes soft and stays where it was. What reads as
 * a pane of glass is the page bending as it passes the edge, and in a browser that means an SVG
 * displacement map — the way `lucasromerodb/liquid-glass-effect-macos`, `archisvaze/liquid-glass`
 * and `shuding/liquid-glass` all do it. A filter has to be in the document to be referenced, and
 * this document is GitHub's.
 */
describe("the refraction the glass is bent by", () => {
  test("puts a definition in the page, hidden, since it is not a picture", () => {
    const it = page()
    keepRefraction(it)

    const held = it.querySelector(`#${REFRACTION_ID}`)
    expect(held).not.toBeNull()
    expect(held?.tagName).toBe("filter")
    // Nought by nought rather than `display: none`: a filter in a hidden subtree is a filter some
    // engines decline to run.
    const host = it.querySelector("svg")
    expect(host?.getAttribute("width")).toBe("0")
    expect(host?.getAttribute("height")).toBe("0")
  })

  test("answers a second call with the same one, rather than stacking them up", () => {
    const it = page()
    keepRefraction(it)
    keepRefraction(it)

    expect(it.querySelectorAll(`#${REFRACTION_ID}`).length).toBe(1)
  })

  test("bends the backdrop with noise, which is what all three references do", () => {
    const it = page()
    keepRefraction(it)
    const filter = it.querySelector(`#${REFRACTION_ID}`)

    expect(filter?.querySelector("feTurbulence")).not.toBeNull()
    expect(filter?.querySelector("feDisplacementMap")).not.toBeNull()
  })

  test("bends it by a distance a forty pixel pane can carry", () => {
    /*
     * The reference displaces by 150, on a pane two hundred pixels tall. Ours is forty, and at
     * that scale every pixel of the backdrop lands outside the pane and the strip fills with the
     * clamped edge of the page instead of the page.
     */
    const it = page()
    keepRefraction(it)
    const scale = Number(it.querySelector("feDisplacementMap")?.getAttribute("scale"))

    expect(scale).toBeGreaterThan(0)
    expect(scale).toBeLessThan(40)
  })

  test("keeps its colour in sRGB, so the backdrop comes back the colour it went in", () => {
    // Filters interpolate in linear RGB by default, which lightens everything that passes through
    // one. The bar would hand the page back paler than it found it.
    const it = page()
    keepRefraction(it)

    expect(it.querySelector(`#${REFRACTION_ID}`)?.getAttribute("color-interpolation-filters")).toBe(
      "sRGB"
    )
  })

  test("is the filter the stylesheet asks for, by the same name", () => {
    // A stylesheet naming a filter that is not there is a bar with no backdrop at all: Chrome
    // drops the whole `backdrop-filter` declaration when a referenced filter cannot be found.
    expect(glass()).toContain(`url(#${REFRACTION_ID})`)
  })
})
