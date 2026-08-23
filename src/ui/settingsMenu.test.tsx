import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DEFAULTS } from "../domain/Settings"
import { ROOT_ID } from "./mount"
import { SettingsMenu } from "./SettingsMenu"

afterEach(cleanup)

/**
 * Everything this menu opens has to open inside our own root.
 *
 * The colours are inline custom properties on `#gitquiet-root` and not on
 * `<html>`, because the rest of the document is GitHub's page and our names on
 * their root would repaint their chrome. So anything Radix portals to
 * `document.body` is drawn with the stylesheet's defaults, which are the light
 * pack — white panel, near-black text, on a dark page. `outside.ts` was written
 * for that failure, having been paid for once by the bar.
 */
describe("the menu is drawn where the colours are", () => {
  const ourRoot = (): HTMLElement => {
    const root = document.createElement("div")
    root.id = ROOT_ID
    document.body.appendChild(root)
    return root
  }

  afterEach(() => {
    for (const stray of document.querySelectorAll(`#${ROOT_ID}`)) stray.remove()
  })

  const open = async (root: HTMLElement) => {
    render(<SettingsMenu settings={DEFAULTS} onChange={() => {}} />, { container: root })
    await userEvent.click(screen.getByLabelText("Display settings"))
  }

  test("the menu itself", async () => {
    const root = ourRoot()

    await open(root)

    expect(root.contains(screen.getByRole("menu"))).toBe(true)
  })

  test("a knob's choices, which are a portal of their own", async () => {
    const root = ourRoot()
    await open(root)

    await userEvent.hover(screen.getByRole("menuitem", { name: /Layout/ }))

    // By part of the label: the chosen one wears a tick, which is in its name.
    const choices = await screen.findByRole("menuitemradio", { name: /Side by side/ })
    expect(root.contains(choices)).toBe(true)
  })

  test("a size knob's handle, which is dragged rather than picked from a list", async () => {
    const root = ourRoot()
    let written: typeof DEFAULTS | undefined
    render(
      <SettingsMenu
        settings={DEFAULTS}
        onChange={(settings) => {
          written = settings
        }}
      />,
      { container: root }
    )
    await userEvent.click(screen.getByLabelText("Display settings"))

    await userEvent.hover(screen.getByRole("menuitem", { name: /Folder indent/ }))
    const handle = (await screen.findByRole("slider", {
      name: "Folder indent"
    })) as HTMLInputElement

    expect(root.contains(handle)).toBe(true)
    fireEvent.change(handle, { target: { value: "8" } })

    expect(written?.tree.indent).toBe("16")
  })

  /**
   * Said on the row, not behind an icon a reader has to find and hover.
   *
   * Every knob here is a trade, and a two-word label can only name it. The gist
   * is the one line that says which way each choice goes; the whole note and
   * the mockups are in the settings sheet, where there is room for them.
   */
  test("a knob says on its own row what it is for", async () => {
    const root = ourRoot()
    await open(root)

    const row = screen.getByRole("menuitem", { name: /Layout/ })

    expect(row.textContent).toContain("One column, or two side by side")
    expect(screen.queryByRole("tooltip")).toBeNull()
  })
})
