import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DEFAULTS, type Settings } from "../domain/Settings"
import { ROOT_ID } from "./mount"
import { SettingsMenu } from "./SettingsMenu"

afterEach(cleanup)

/**
 * Everything this button opens has to open inside our own root.
 *
 * The colours are inline custom properties on `#gitquiet-root` and not on
 * `<html>`, because the rest of the document is GitHub's page and our names on
 * their root would repaint their chrome. So anything Radix portals to
 * `document.body` is drawn with the stylesheet's defaults, which are the light
 * pack — white panel, near-black text, on a dark page. `outside.ts` was written
 * for that failure, having been paid for once by the bar.
 */
describe("the panel of knobs", () => {
  const ourRoot = (): HTMLElement => {
    const root = document.createElement("div")
    root.id = ROOT_ID
    document.body.appendChild(root)
    return root
  }

  afterEach(() => {
    for (const stray of document.querySelectorAll(`#${ROOT_ID}`)) stray.remove()
  })

  const opened = async (
    root: HTMLElement,
    onChange: (settings: Settings) => void = () => {}
  ) => {
    render(<SettingsMenu settings={DEFAULTS} onChange={onChange} />, { container: root })
    await userEvent.click(screen.getByLabelText("Display settings"))
    return await screen.findByRole("dialog", { name: "Display settings" })
  }

  test("is drawn where the colours are", async () => {
    const root = ourRoot()

    const panel = await opened(root)

    expect(root.contains(panel)).toBe(true)
  })

  /**
   * Every knob on the one surface, and its value on the row with it.
   *
   * Each of these used to be a submenu, so reading what the diff was set to
   * meant hovering eight rows one after another and reading eight panels.
   */
  test("holds every knob, with its control on the row", async () => {
    const root = ourRoot()
    await opened(root)

    const layout = screen.getByRole("combobox", { name: "Layout" }) as HTMLSelectElement
    const numbers = screen.getByRole("switch", { name: "Line numbers" })
    const indent = screen.getByRole("slider", { name: "Folder indent" }) as HTMLInputElement

    expect(layout.value).toBe("unified")
    expect(numbers.getAttribute("aria-checked")).toBe("true")
    // The fifth step of ten, which is the six pixels the tree indents by.
    expect(indent.value).toBe("4")
  })

  /**
   * A glyph on every row, and none of them said out loud.
   *
   * The eye going down the left edge for the knob it changed last week is what
   * they are for; a reader listening to the row already has the label, so the
   * glyph is hidden from them rather than read to them twice.
   */
  test("marks every row with a glyph, and says none of them", async () => {
    const root = ourRoot()
    const panel = await opened(root)

    const rows = panel.querySelectorAll('[role="group"] > div')
    const marked = [...rows].filter((row) => row.querySelector("svg") !== null)

    expect(rows.length).toBeGreaterThan(0)
    expect(marked.length).toBe(rows.length)
    expect(panel.querySelectorAll('[aria-hidden="true"] svg').length).toBe(rows.length)
  })

  /** The advanced knobs, which used to be behind one more click. */
  test("holds the advanced knobs at the end of the same panel", async () => {
    const root = ourRoot()
    await opened(root)

    expect(screen.getByRole("combobox", { name: "Change marks" })).toBeDefined()
    expect(screen.getByRole("switch", { name: "Search box" })).toBeDefined()
  })

  test("writes the answer picked from a list", async () => {
    const root = ourRoot()
    let written: Settings | undefined
    await opened(root, (settings) => {
      written = settings
    })

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Layout" }), "split")

    expect(written).toEqual({ ...DEFAULTS, diff: { ...DEFAULTS.diff, layout: "split" } })
  })

  test("writes the other side of a switch", async () => {
    const root = ourRoot()
    let written: Settings | undefined
    await opened(root, (settings) => {
      written = settings
    })

    await userEvent.click(screen.getByRole("switch", { name: "Line numbers" }))

    expect(written).toEqual({
      ...DEFAULTS,
      diff: { ...DEFAULTS.diff, lineNumbers: "off" }
    })
  })

  test("writes the step a handle lands on", async () => {
    const root = ourRoot()
    let written: Settings | undefined
    await opened(root, (settings) => {
      written = settings
    })

    fireEvent.change(screen.getByRole("slider", { name: "Folder indent" }), {
      target: { value: "9" }
    })

    expect(written?.tree.indent).toBe("16")
  })
})
