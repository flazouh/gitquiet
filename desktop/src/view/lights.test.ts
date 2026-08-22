import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"

/**
 * The traffic lights and the row they sit in, which are set in two different
 * processes and have to agree.
 *
 * Their offset is a window property: it is given to `BrowserWindow` in the main
 * process, before a stylesheet exists. The row is `--chrome` in the view's own
 * stylesheet. Nothing in either file can see the other, so the agreement was a
 * paragraph of arithmetic in a comment — and a comment is exactly what does not
 * fail when somebody changes the row from thirty-eight to fifty-six.
 *
 * Read as text, which is how `glass.test.ts` reads the same stylesheet and for the
 * same reason: the numbers are the interface, and a test that cannot see them is a
 * test of something else.
 */

const sheet = () => readFileSync("desktop/src/view/style.css", "utf8")
const window = () => readFileSync("desktop/src/bun/index.ts", "utf8")

/** A pixel figure a custom property is set to. */
const token = (name: string): number => {
  const found = new RegExp(`${name}: (\\d+)px`).exec(sheet())
  return Number(found?.[1])
}

const offset = (): { readonly x: number; readonly y: number } => {
  const found = /trafficLightOffset: \{ x: (\d+), y: (\d+) \}/.exec(window())
  return { x: Number(found?.[1]), y: Number(found?.[2]) }
}

/*
 * macOS's own three, measured rather than assumed: each button is twelve pixels
 * across and their centres are twenty apart, so the set is sixty-four wide from
 * the offset it starts at.
 */
const LIGHT = 12
const APART = 20

describe("the traffic lights, against the row they were put in", () => {
  test("sit on the line the bar's pane is centred on", () => {
    /*
     * They were at ten, the middle of a strip of thirty-eight that held nothing
     * else. The strip holds the bar now, so the middle moved — and three system
     * buttons eleven pixels above everything drawn beside them read as a row that
     * had come apart.
     */
    const { y } = offset()

    expect(y + LIGHT / 2).toBe(token("--chrome") / 2)
  })

  test("end before anything of ours begins, which is what the left padding is for", () => {
    /*
     * `--lights` is the one measurement in this window that is somebody else's. It
     * has to clear the whole set and leave air, or the bar's own Home sits in a line
     * with the green one at the same size — which is a fourth light nobody can press.
     */
    const { x } = offset()
    const ends = x + 2 * APART + LIGHT

    expect(token("--lights")).toBeGreaterThan(ends)
  })

  test("keep the row they sit in out of a stacking context, or nobody can move the window", () => {
    /*
     * The drag region is this row. macOS reads it off the webview, and a strip inside a
     * stacking context is a strip it does not read: the window then has no title bar to
     * hold, which is a window that cannot be moved at all. It has happened twice.
     *
     * Nothing in here needs one. The list starts below the row rather than under it, so
     * the pane's cast falls on the window's own fill.
     */
    const row = sheet().slice(sheet().indexOf(".chrome {"))
    // The declarations rather than the rule, because half of that rule is the paragraph
    // saying why these two are not in it.
    const said = row.slice(0, row.indexOf("}")).replaceAll(/\/\*[\s\S]*?\*\//g, "")

    expect(said).toContain("-webkit-app-region: drag")
    expect(said).not.toContain("position:")
    expect(said).not.toContain("z-index")
  })

  test("are cleared by the row itself, and not by the pane inside it", () => {
    /*
     * The row holds the room and the slot inside it adds the gutter `glass.css`
     * floats the pane on, so the two together are where the lights end. Stated here
     * because the subtraction is the thing that keeps them from being added twice.
     */
    expect(sheet()).toContain("padding-left: calc(var(--lights) - var(--gitquiet-gutter))")
  })
})
