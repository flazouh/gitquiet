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

/**
 * A `<diffs-container>` holding a shadow root, however it came by one.
 *
 * Which of the two it is depends on whether anything has registered the element
 * — and in a suite, that is decided by whichever file ran first. Alone, nothing
 * has, so the element is inert and has to be given a root. After any file that
 * pulls in Pierre's bundle, the registry is real, the element upgrades the
 * instant it is created and has attached one already, and asking again throws
 * `NotSupportedError`. These tests attached unconditionally and so passed alone
 * and failed in the suite, which is the least useful way for a test to fail.
 *
 * Taking whichever root is there is not a workaround: it is what `shadowFor`
 * does in the engine, for the same reason, and it makes the test true on both
 * platforms rather than on whichever one happened to run.
 */
const container = (): { readonly host: Element; readonly shadow: ShadowRoot } => {
  const host = document.createElement("diffs-container")
  return { host, shadow: host.shadowRoot ?? host.attachShadow({ mode: "open" }) }
}

describe("the root the renderer actually drew into", () => {
  test("is the shadow root of the container it made, not of the element it was given", () => {
    // `renderDiff` makes a `<diffs-container>`, attaches the shadow root to it,
    // and puts it inside what it was handed. A pane holding a ref to the outer
    // element has no shadow root at all — which is what every caller reached
    // for, and why a press on a name scrolled nowhere.
    const pane = document.createElement("div")
    const { host, shadow } = container()
    pane.append(host)

    expect(pane.shadowRoot).toBeNull()
    expect(drawnIn(pane)).toBe(shadow)
  })

  test("finds a line through it", () => {
    const pane = document.createElement("div")
    const { host, shadow } = container()
    const row = document.createElement("div")
    row.setAttribute("data-line", "42")
    shadow.append(row)
    pane.append(host)

    expect(showLine(pane, 42)).toBe(true)
    expect(showLine(pane, 43)).toBe(false)
  })

  test("takes an element that owns its own shadow root as it is", () => {
    const { host, shadow } = container()

    expect(drawnIn(host)).toBe(shadow)
  })

  test("answers nothing for nothing, which is a pane that has not drawn yet", () => {
    expect(drawnIn(null)).toBeNull()
    expect(showLine(null, 1)).toBe(false)
  })
})

describe("how it arrives", () => {
  test("says instant rather than inheriting the page's smooth", () => {
    const pane = document.createElement("div")
    const { host, shadow } = container()
    const row = document.createElement("div")
    row.setAttribute("data-line", "7")

    const asked: Array<unknown> = []
    row.scrollIntoView = (how?: unknown) => {
      asked.push(how)
    }
    shadow.append(row)
    pane.append(host)

    showLine(pane, 7)

    // GitHub sets `scroll-behavior: smooth`, and an animation that never runs
    // is a scroll that never lands: the same call arrives at 2041 as instant
    // and at 0 without it, measured on a live page.
    expect(asked).toEqual([{ block: "center", behavior: "instant" }])
  })
})
