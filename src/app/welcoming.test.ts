import { describe, expect, test } from "bun:test"
import { WELCOME_AT, welcomeFor } from "./welcoming"

/** A reader's browser, which is the only one this page is for. */
const shipped = { development: false }

describe("the page the extension opens by itself", () => {
  test("opens once, on the install", () => {
    expect(welcomeFor("install", shipped)).toBe(WELCOME_AT)
  })

  /*
   * The whole reason this is a function. `onInstalled` fires on an update too, and a
   * tab that opens by itself because something updated in the background is the
   * behaviour that gets an extension uninstalled.
   */
  test("opens nothing on an update, of the extension or of the browser", () => {
    for (const reason of ["update", "chrome_update", "browser_update", "shared_module_update"]) {
      expect(welcomeFor(reason, shipped)).toBeNull()
    }
  })

  /*
   * Chrome reports every reload of an unpacked build as an install, so without this a
   * developer gets a tab to gitquiet.com on each save.
   */
  test("opens nothing while the extension is being built", () => {
    expect(welcomeFor("install", { development: true })).toBeNull()
  })

  test("says it came from the extension, which is what changes the last beat", () => {
    expect(WELCOME_AT).toContain("from=extension")
  })
})
