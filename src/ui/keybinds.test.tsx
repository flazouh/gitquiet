import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { keysOf } from "../app/keyboard"
import { DEFAULTS, type Settings } from "../domain/Settings"
import { Keybinds } from "./Keybinds"

afterEach(cleanup)

/**
 * The panel, and whatever it last wrote.
 *
 * Written back into the panel as it goes, because the rows read the reader's own
 * chords: a test that dropped what was written would be testing a panel that
 * never sees its own answers.
 */
const panel = (from: Settings = DEFAULTS) => {
  const written: Array<Settings> = []
  const { rerender } = render(
    <Keybinds settings={from} onChange={() => {}} keys={keysOf(from)} />
  )
  const draw = (settings: Settings) => {
    written.push(settings)
    rerender(<Keybinds settings={settings} onChange={draw} keys={keysOf(settings)} />)
  }
  rerender(<Keybinds settings={from} onChange={draw} keys={keysOf(from)} />)
  return { written }
}

const rowFor = (word: string): HTMLElement => {
  const found = screen
    .getAllByRole("listitem")
    .find((row) => row.textContent?.startsWith(word))
  if (found === undefined) throw new Error(`no row for ${word}`)
  return found
}

const change = (word: string) => screen.getByLabelText(`Change the key for ${word}`)

describe("changing a key", () => {
  test("says which key each command answers to", () => {
    panel()

    expect(rowFor("Next file").textContent).toContain("s")
    expect(rowFor("Previous file").textContent).toContain("w")
  })

  test("wears the key the reader put on it rather than the profile's", () => {
    panel({ ...DEFAULTS, bound: { nextFile: "c" } })

    expect(rowFor("Next file").textContent).toContain("c")
  })

  test("writes the next key pressed against the command", async () => {
    const { written } = panel()

    await userEvent.click(change("Next file"))
    await userEvent.keyboard("c")

    expect(written.at(-1)?.bound).toEqual({ nextFile: "c" })
  })

  test("asks for a key before it takes one", async () => {
    panel()

    await userEvent.click(change("Next file"))

    expect(change("Next file").textContent).toBe("Press a key")
  })

  test("leaves a press the browser has first claim on alone", async () => {
    const { written } = panel()

    await userEvent.click(change("Next file"))
    await userEvent.keyboard("{Meta>}c{/Meta}")

    expect(written).toEqual([])
  })

  test("takes Escape as the way out of asking rather than as a key", async () => {
    // Every dialog and bubble on this page is listening for Escape, so a command
    // bound to it would fire behind whatever the reader was closing.
    const { written } = panel()

    await userEvent.click(change("Next file"))
    await userEvent.keyboard("{Escape}")

    expect(written).toEqual([])
    expect(change("Next file").textContent).not.toBe("Press a key")
  })

  test("offers the way back only on a command the reader has changed", async () => {
    panel({ ...DEFAULTS, bound: { nextFile: "c" } })

    expect(within(rowFor("Next file")).queryByText("Put back")).not.toBeNull()
    expect(within(rowFor("Previous file")).queryByText("Put back")).toBeNull()
  })

  test("puts a command back on the key its profile gives it", async () => {
    const { written } = panel({ ...DEFAULTS, bound: { nextFile: "c" } })

    await userEvent.click(within(rowFor("Next file")).getByText("Put back"))

    expect(written.at(-1)?.bound).toEqual({})
  })

  test("says so rather than drawing eleven rows that do nothing", () => {
    panel({ ...DEFAULTS, keys: { profile: "off" } })

    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
    expect(document.body.textContent).toContain("The keyboard is off")
  })
})
