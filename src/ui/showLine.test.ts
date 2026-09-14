import { describe, expect, test } from "bun:test"
import { showLine, drawnIn } from "./showLine"

/**
 * A diff as the renderer leaves it: rows in a shadow root, each carrying the
 * line number it draws.
 *
 * The renderer is a built artefact no test here has, so what is checked is our
 * half — that a row is found by the attribute it writes, that a miss is an
 * answer, and that a root that never arrived is one too. The attribute itself is
 * the assumption, and it is named in one place for exactly that reason.
 */
const drawn = (lines: ReadonlyArray<number>): ShadowRoot => {
  const host = document.createElement("div")
  const shadow = host.attachShadow({ mode: "open" })
  for (const line of lines) {
    const row = document.createElement("div")
    row.setAttribute("data-line", String(line))
    row.scrollIntoView = () => {
      row.setAttribute("data-shown", "")
    }
    shadow.append(row)
  }
  return shadow
}

describe("putting a line of a diff on the screen", () => {
  test("finds the row the renderer drew for it", () => {
    const shadow = drawn([40, 41, 42])

    expect(showLine(shadow, 42)).toBe(true)
    expect(shadow.querySelector('[data-line="42"]')?.hasAttribute("data-shown")).toBe(true)
  })

  test("says so rather than throwing when the line is not drawn", () => {
    // Past the end of a file that has changed since, or inside a hunk this diff
    // does not show. Neither is a reason to do anything but leave the reader at
    // the top of the file they asked for.
    expect(showLine(drawn([1, 2]), 900)).toBe(false)
  })

  test("says so where nothing has been drawn at all", () => {
    expect(showLine(null, 42)).toBe(false)
  })
})

describe("the root the renderer actually drew into", () => {
  test("is the shadow root of the container it made, not of the element it was given", () => {
    // `renderDiff` makes a `<diffs-container>`, attaches the shadow root to it,
    // and puts it inside what it was handed. A pane holding a ref to the outer
    // element has no shadow root at all — which is what every caller reached
    // for, and why a press on a name scrolled nowhere.
    const pane = document.createElement("div")
    const drawn = document.createElement("diffs-container")
    const shadow = drawn.attachShadow({ mode: "open" })
    pane.append(drawn)

    expect(pane.shadowRoot).toBeNull()
    expect(drawnIn(pane)).toBe(shadow)
  })

  test("finds a line through it", () => {
    const pane = document.createElement("div")
    const drawn = document.createElement("diffs-container")
    const shadow = drawn.attachShadow({ mode: "open" })
    const row = document.createElement("div")
    row.setAttribute("data-line", "42")
    shadow.append(row)
    pane.append(drawn)

    expect(showLine(pane, 42)).toBe(true)
    expect(showLine(pane, 43)).toBe(false)
  })

  test("takes an element that owns its own shadow root as it is", () => {
    const drawn = document.createElement("diffs-container")
    const shadow = drawn.attachShadow({ mode: "open" })

    expect(drawnIn(drawn)).toBe(shadow)
  })

  test("answers nothing for nothing, which is a pane that has not drawn yet", () => {
    expect(drawnIn(null)).toBeNull()
    expect(showLine(null, 1)).toBe(false)
  })
})

describe("how it arrives", () => {
  test("says instant rather than inheriting the page's smooth", () => {
    const pane = document.createElement("div")
    const drawn = document.createElement("diffs-container")
    const shadow = drawn.attachShadow({ mode: "open" })
    const row = document.createElement("div")
    row.setAttribute("data-line", "7")

    const asked: Array<unknown> = []
    row.scrollIntoView = (how?: unknown) => {
      asked.push(how)
    }
    shadow.append(row)
    pane.append(drawn)

    showLine(pane, 7)

    // GitHub sets `scroll-behavior: smooth`, and an animation that never runs
    // is a scroll that never lands: the same call arrives at 2041 as instant
    // and at 0 without it, measured on a live page.
    expect(asked).toEqual([{ block: "center", behavior: "instant" }])
  })
})
