import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DEFAULTS } from "../domain/Settings"
import { ROOT_ID } from "./mount"
import { SettingsMenu } from "./SettingsMenu"
import { ScreenActivityProvider } from "./screenActivity"

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

  test("builds the menu before the first press, but keeps it hidden", async () => {
    const root = ourRoot()
    render(<SettingsMenu settings={DEFAULTS} onChange={() => {}} />, { container: root })

    const prepared = screen.getByRole("menu", { hidden: true })
    expect(prepared.hidden || getComputedStyle(prepared).display === "none").toBe(true)

    await userEvent.click(screen.getByLabelText("Display settings"))

    expect(screen.getByRole("menu")).toBe(prepared)
  })

  test("keeps a prepared menu inside its detached screen", () => {
    const standing = ourRoot()
    const prepared = document.createElement("div")
    prepared.id = ROOT_ID

    render(
      <ScreenActivityProvider active root={prepared}>
        <SettingsMenu settings={DEFAULTS} onChange={() => {}} />
      </ScreenActivityProvider>,
      { container: prepared }
    )

    const menu = within(prepared).getByRole("menu", { hidden: true })
    expect(prepared.contains(menu)).toBe(true)
    expect(standing.contains(menu)).toBe(false)
  })

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

  test("and the explanation beside a knob", async () => {
    const root = ourRoot()
    await open(root)

    // The information icon, which is the last thing on the row and a span rather
    // than a button: a pointer landing on it must not count as choosing the row.
    const row = screen.getByRole("menuitem", { name: /Layout/ })
    await userEvent.hover(row.lastElementChild as HTMLElement)

    const said = await screen.findByRole("tooltip")
    expect(root.contains(said)).toBe(true)
  })
})
