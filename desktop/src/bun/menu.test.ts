import { describe, expect, test } from "bun:test"
import { everyItemIn, macMenu, MODIFIERS } from "./menu"

const menu = macMenu("GitQuiet")

const named = (label: string) => everyItemIn(menu).find((one) => one.label === label)

describe("the menu bar a mac window is expected to have", () => {
  test("quits on Command+Q, which is the whole reason this file exists", () => {
    const quitting = everyItemIn(menu).find((one) => one.role === "quit")

    expect(quitting?.accelerator).toBe("Command+Q")
  })

  test("carries the four menus a mac reader reaches for without thinking", () => {
    // The application first and named after itself, which is where macOS draws it
    // whatever this says, then the three every other application has.
    expect(menu.map((one) => ("label" in one ? one.label : "—"))).toEqual([
      "GitQuiet",
      "Edit",
      "View",
      "Window"
    ])
  })

  test("has the editing keys, without which a webview cannot even be copied out of", () => {
    const edit = everyItemIn(named("Edit")?.submenu ?? [])
    const keyFor = (role: string) => edit.find((one) => one.role === role)?.accelerator

    expect(keyFor("copy")).toBe("Command+C")
    expect(keyFor("paste")).toBe("Command+V")
    expect(keyFor("cut")).toBe("Command+X")
    expect(keyFor("selectAll")).toBe("Command+A")
  })

  test("closes and minimises the window on the standard pair", () => {
    const window = everyItemIn(named("Window")?.submenu ?? [])
    const keyFor = (role: string) => window.find((one) => one.role === role)?.accelerator

    expect(keyFor("close")).toBe("Command+W")
    expect(keyFor("minimize")).toBe("Command+M")
  })

  test("spells its modifiers the way the native layer reads them", () => {
    /*
     * The fault this guards, and it fails silently: the native wrapper lowercases
     * a modifier and looks it up in a fixed set — command, commandorcontrol,
     * control, ctrl, meta, option, shift, super. Electron's own spellings for two
     * of those, `Cmd` and `Alt`, are not in it, so `Cmd+Q` parses as nothing and
     * the item appears in the menu with no key beside it and no way to press it.
     */
    for (const item of everyItemIn(menu)) {
      if (item.accelerator === undefined) continue

      const parts = item.accelerator.split("+")
      for (const modifier of parts.slice(0, -1)) {
        expect(MODIFIERS).toContain(modifier.toLowerCase())
      }
    }
  })

  test("leaves the zoom keys to the view, which already answers them", () => {
    // `pageZoomFromPress` reads Command+= and its siblings inside the webview. A
    // key equivalent on a menu item would be a second answer to one press.
    const keys = everyItemIn(menu).map((one) => one.accelerator ?? "")

    expect(keys.some((key) => key.endsWith("+Plus") || key.endsWith("+Minus"))).toBe(false)
    expect(keys.some((key) => key.endsWith("+0"))).toBe(false)
  })
})
