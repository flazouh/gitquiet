import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DEFAULTS, DIFF_KNOBS, type Settings, TREE_KNOBS } from "../domain/Settings"
import { SettingsDialog, SettingsSheet } from "./SettingsDialog"

afterEach(cleanup)

const opened = async (onChange: (settings: Settings) => void = () => {}) => {
  render(<SettingsDialog settings={DEFAULTS} onChange={onChange} />)
  await userEvent.click(screen.getByLabelText("Display settings"))
  return screen.getByRole("dialog", { name: "Settings" })
}

/** The row a knob owns, found by the name it wears at the top of it. */
const rowFor = (frame: HTMLElement, label: string): HTMLElement => {
  const found = within(frame)
    .getAllByRole("listitem")
    .find((row) => row.textContent?.startsWith(label))
  if (found === undefined) throw new Error(`no row for ${label}`)
  return found
}

const tab = async (frame: HTMLElement, name: string) =>
  userEvent.click(within(frame).getByRole("tab", { name }))

/** Whether a knob has a row on the page that is showing. */
const hasRow = (frame: HTMLElement, label: string): boolean =>
  within(frame)
    .getAllByRole("listitem")
    .some((row) => row.textContent?.startsWith(label) === true)

/** The panel down the right, which is a picture and the whole explanation. */
const panel = (frame: HTMLElement): HTMLElement => {
  const found = frame.querySelector("aside")
  if (found === null) throw new Error("no preview panel")
  return found
}

describe("the keyboard's own page", () => {
  test("holds the profile and a row for every command", async () => {
    const frame = await opened()
    await tab(frame, "Keyboard")

    expect(hasRow(frame, "Keys")).toBe(true)
    expect(within(frame).getByLabelText("Change the key for Next file")).toBeTruthy()
  })

  test("writes a key the reader presses into the settings", async () => {
    const written: Array<Settings> = []
    const frame = await opened((settings) => written.push(settings))
    await tab(frame, "Keyboard")

    await userEvent.click(within(frame).getByLabelText("Change the key for Next file"))
    await userEvent.keyboard("c")

    expect(written.at(-1)?.bound).toEqual({ nextFile: "c" })
  })
})

describe("opening the settings", () => {
  test("puts them in front of the page rather than in a menu beside it", async () => {
    const frame = await opened()

    expect(within(frame).queryByRole("menu")).toBeNull()
    expect(frame.textContent).toContain("Theme")
  })

  /*
   * The app's window opens this from the account menu in its title bar, where
   * there is no diff to have knobs about and so no small button to hang them on.
   * The sheet has to stand on its own for that, without the way in it ships with.
   */
  test("can be opened by something other than its own button", async () => {
    let shut = false
    render(<SettingsSheet settings={DEFAULTS} onChange={() => {}} onClose={() => { shut = true }} />)

    const frame = screen.getByRole("dialog", { name: "Settings" })
    expect(frame.textContent).toContain("Theme")
    // No second way in drawn beside it: the shell that opened it has its own.
    expect(screen.queryByLabelText("Display settings")).toBeNull()

    await userEvent.keyboard("{Escape}")
    expect(shut).toBe(true)
  })

  /*
   * Room left for whatever the shell has in its corners. In the app's window that
   * is the traffic lights, which a sheet centred in 86% of the window sat under.
   */
  test("leaves the shell's own furniture room, by asking rather than assuming", async () => {
    const frame = await opened()

    expect(frame.className).toContain("--sheet-away")
    // Centred by this component, because the reset both interfaces are built on
    // takes away the margin the browser would have centred it with.
    expect(frame.className).toContain("m-auto")
  })

  test("closes on Escape, which is the first thing anyone tries", async () => {
    await opened()

    await userEvent.keyboard("{Escape}")

    expect(screen.queryByRole("dialog") === null ? "gone" : "open").toBe("gone")
  })
})

describe("what a row says about its knob", () => {
  test("names every plain diff knob and gives the gist of it, briefly", async () => {
    const frame = await opened()
    await tab(frame, "Diff")

    for (const knob of DIFF_KNOBS.filter((one) => !one.advanced)) {
      const row = rowFor(frame, knob.label)
      expect([knob.key, within(row).getByText(knob.gist) !== null]).toEqual([knob.key, true])
    }
  })

  test("keeps the whole explanation in reach of a reader being read to", async () => {
    // The panel is for looking at, and is hidden from assistive technology
    // because of it. What it shows has to be somewhere a screen reader goes.
    const frame = await opened()
    await tab(frame, "Diff")

    for (const knob of DIFF_KNOBS.filter((one) => !one.advanced)) {
      const row = rowFor(frame, knob.label)
      expect([knob.key, row.textContent?.includes(knob.note)]).toEqual([knob.key, true])
    }
  })

  test("puts the knob under the pointer in the panel, with its picture", async () => {
    const frame = await opened()
    await tab(frame, "Diff")

    await userEvent.hover(rowFor(frame, "Syntax colours"))

    const shown = panel(frame)
    expect(within(shown).getByText("Syntax colours")).toBeDefined()
    expect(within(shown).getByText(/Which colours the code itself/)).toBeDefined()
    expect(shown.querySelector("figure")?.innerHTML).not.toBe("")
  })

  test("rests on the first knob of the page rather than on nothing", async () => {
    const frame = await opened()

    expect(within(panel(frame)).getByText("Appearance")).toBeDefined()
    expect(within(panel(frame)).getByText("System · in use")).toBeDefined()
  })

  test("marks what is in use, so a row can be read without opening anything", async () => {
    const frame = await opened()
    await tab(frame, "Diff")
    const row = rowFor(frame, "Layout")

    expect(within(row).getByRole("radio", { name: "Unified", checked: true })).toBeDefined()
    expect(within(row).getByRole("radio", { name: "Side by side", checked: false })).toBeDefined()
  })
})

describe("choosing something", () => {
  test("changes the one diff knob that was asked about", async () => {
    let written: Settings | undefined
    const frame = await opened((settings) => {
      written = settings
    })

    await tab(frame, "Diff")
    await userEvent.click(within(rowFor(frame, "Layout")).getByRole("radio", { name: "Side by side" }))

    expect(written).toEqual({ ...DEFAULTS, diff: { ...DEFAULTS.diff, layout: "split" } })
  })

  test("writes a rail knob to the rail rather than to the diff", async () => {
    let written: Settings | undefined
    const frame = await opened((settings) => {
      written = settings
    })

    await tab(frame, "Files")
    await userEvent.click(within(rowFor(frame, "Row height")).getByRole("radio", { name: "Relaxed" }))

    expect(written).toEqual({ ...DEFAULTS, tree: { ...DEFAULTS.tree, density: "relaxed" } })
  })

  test("drags a size knob to the step the handle lands on", async () => {
    let written: Settings | undefined
    const frame = await opened((settings) => {
      written = settings
    })

    await tab(frame, "Files")
    const handle = within(rowFor(frame, "Folder indent")).getByRole("slider", {
      name: "Folder indent"
    }) as HTMLInputElement

    // The handle walks the choices by position, so what it is worth here is an
    // index and what is written down is the pixels at that index.
    expect(handle.value).toBe("4")
    fireEvent.change(handle, { target: { value: "1" } })

    expect(written).toEqual({ ...DEFAULTS, tree: { ...DEFAULTS.tree, indent: "1" } })
  })
})

describe("the tabs", () => {
  test("keeps the diff's knobs and the rail's apart", async () => {
    const frame = await opened()

    expect(hasRow(frame, "Row height")).toBe(false)

    await tab(frame, "Files")

    expect(hasRow(frame, "Layout")).toBe(false)
    expect(hasRow(frame, "Row height")).toBe(true)
  })

  test("holds every advanced knob of both, and nothing else does", async () => {
    const frame = await opened()

    expect(hasRow(frame, "Change marks")).toBe(false)

    await tab(frame, "Advanced")

    for (const knob of [...DIFF_KNOBS, ...TREE_KNOBS].filter((one) => one.advanced)) {
      expect([knob.key, hasRow(frame, knob.label)]).toEqual([knob.key, true])
    }
  })

  test("shows the page it is on, and the panel follows the page", async () => {
    const frame = await opened()

    await tab(frame, "Files")

    expect(within(panel(frame)).getByText("Row height")).toBeDefined()
  })

  test("puts appearance and theme on their own page", async () => {
    const frame = await opened()

    expect(hasRow(frame, "Appearance")).toBe(true)
    expect(hasRow(frame, "Theme")).toBe(true)
    expect(hasRow(frame, "Layout")).toBe(false)

    await tab(frame, "Diff")

    expect(hasRow(frame, "Theme")).toBe(false)
    expect(hasRow(frame, "Layout")).toBe(true)
  })

  test("writes a theme pack without touching the diff", async () => {
    let written: Settings | undefined
    const frame = await opened((settings) => {
      written = settings
    })

    await tab(frame, "Appearance")
    await userEvent.click(within(rowFor(frame, "Theme")).getByRole("radio", { name: "Anthropic" }))

    expect(written).toEqual({
      ...DEFAULTS,
      theme: { ...DEFAULTS.theme, pack: "anthropic" }
    })
  })
})

describe("pointing at a choice that has not been made", () => {
  test("shows what it would look like without choosing it", async () => {
    let calls = 0
    const frame = await opened(() => {
      calls = calls + 1
    })
    await tab(frame, "Diff")
    const row = rowFor(frame, "Layout")
    const picture = () => panel(frame).querySelector("figure")?.innerHTML

    const before = picture()
    await userEvent.hover(within(row).getByRole("radio", { name: "Side by side" }))

    expect(picture()).not.toBe(before)
    expect(within(panel(frame)).getByText("Side by side")).toBeDefined()
    expect(calls).toBe(0)
  })

  test("goes back to what is in use once the pointer leaves", async () => {
    const frame = await opened()
    await tab(frame, "Diff")
    const row = rowFor(frame, "Layout")
    const picture = () => panel(frame).querySelector("figure")?.innerHTML

    const before = picture()
    await userEvent.hover(within(row).getByRole("radio", { name: "Side by side" }))
    await userEvent.unhover(within(row).getByRole("radio", { name: "Side by side" }))

    expect(picture()).toBe(before)
  })
})

/**
 * Every appearance choice, pointed at, drawn.
 *
 * The panel beside the rows draws a picture of whatever the pointer is on, and two
 * of those pictures are new: a set of glyphs, and a pack pair for an answer that is
 * not a pack. A sample that throws takes the whole screen with it rather than the
 * one picture, because it renders inside the dialog and the dialog inside the
 * interface — so every choice on the page is pointed at here rather than one.
 */
describe("the picture beside every choice on the appearance page", () => {
  test("draws for all of them, including the two that are not a single pack", async () => {
    const frame = await opened()
    const choices = within(frame).getAllByRole("radio")
    expect(choices.length).toBeGreaterThan(30)

    // Two of them say "Match the page", one on each of the two knobs that has an
    // answer meaning the place. Both are in the list, so both are pointed at.
    expect(
      choices.filter((one) => (one as HTMLInputElement).value === "match").length
    ).toBe(2)

    for (const choice of choices) {
      await userEvent.hover(choice)
      expect(within(frame).getAllByRole("radio").length).toBe(choices.length)
    }
    /*
     * Thirty pointers and thirty pictures, against a five second default.
     *
     * Every other test here points at one thing; this one points at more than
     * thirty, because a sample that throws takes the screen with it and the only
     * way to know none of them does is to draw all of them. Under
     * `bun test --parallel` on two slow cores that crosses five seconds and is
     * reported as a fault in the dialog, which is the one thing it is not.
     */
  }, 20_000)
})
