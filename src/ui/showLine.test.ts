import { describe, expect, test } from "bun:test"
import { showLine } from "./showLine"

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
