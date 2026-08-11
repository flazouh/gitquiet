import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { OUTSIDE, outsideHost, ourOutsides } from "./outside"

const page = (): Document => document.implementation.createHTMLDocument("t")

const primer = () => readFileSync("src/ui/primer.css", "utf8")

describe("standing outside the root", () => {
  test("makes a host at the end of the page, marked as ours", () => {
    const it = page()
    const host = outsideHost(it, "gitquiet-over")

    expect(host.id).toBe("gitquiet-over")
    expect(host.hasAttribute(OUTSIDE)).toBe(true)
    expect(it.body.lastElementChild).toBe(host)
  })

  test("answers with the same host twice, rather than stacking them up", () => {
    const it = page()

    expect(outsideHost(it, "gitquiet-over")).toBe(outsideHost(it, "gitquiet-over"))
    expect(it.querySelectorAll("#gitquiet-over").length).toBe(1)
  })

  test("lists every host of ours, which is what the theme paints", () => {
    const it = page()
    outsideHost(it, "gitquiet-bar")
    outsideHost(it, "gitquiet-over")
    // Theirs, which must not be painted with our tokens.
    it.body.appendChild(it.createElement("div"))

    expect(ourOutsides(it).map((one) => one.id)).toEqual(["gitquiet-bar", "gitquiet-over"])
  })
})

/**
 * The arguments this interface has to win twice.
 *
 * Primer declares its utilities `!important` — `.border` is
 * `1px solid var(--borderColor-default) !important`, `.rounded-lg` is six pixels the same way —
 * and they are on the page before our stylesheet is. Every one of those arguments is answered in
 * `primer.css`, and every answer was scoped to `#gitquiet-root`, which is where this interface
 * was when they were written.
 *
 * It is not all there any more. The settings sheet, the toaster and the hover cards hang in
 * `document.body`, because a modal cannot live in a pane that carries `backdrop-filter` and a
 * hover card cannot live in something that clips it. Out there the answers do not reach, so the
 * sheet took GitHub's border colour — a light line around a dark card, in every dark pack — and
 * GitHub's six pixel corner while the cards beside it kept our twelve.
 */
describe("the arguments with GitHub, out where our root is not", () => {
  for (const utility of [
    ".border-line",
    ".border-line-muted",
    ".border-fail",
    ".border-busy",
    ".border-done"
  ]) {
    test(`${utility} carries our colour out there too, not GitHub's`, () => {
      const rule = primer()
        .split("}")
        .find((one) => one.includes(`${utility} {`))

      expect(rule).toBeDefined()
      expect(rule).toContain(`[${OUTSIDE}] ${utility}`)
    })
  }

  test("a corner of ours is ours out there too, which is what a sheet beside a card needs", () => {
    // Their `.rounded-lg` is six pixels and `!important`, so the sheet has to say twelve as
    // loudly. The token rather than the number, so a pack that retunes its corners retunes this.
    const rule = primer()
      .split("}")
      .find((one) => one.includes(`[${OUTSIDE}] .rounded-lg`))

    expect(rule).toBeDefined()
    expect(rule).toContain("var(--radius-lg) !important")
  })
})
