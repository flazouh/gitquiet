import { describe, expect, test } from "bun:test"
import { WELCOME_AT, welcomeFor } from "./welcoming"

describe("the page the extension opens by itself", () => {
  test("opens once, on the install", () => {
    expect(welcomeFor("install")).toBe(WELCOME_AT)
  })

  /*
   * The whole reason this is a function. `onInstalled` fires on an update too, and a
   * tab that opens by itself because something updated in the background is the
   * behaviour that gets an extension uninstalled.
   */
  test("opens nothing on an update, of the extension or of the browser", () => {
    for (const reason of ["update", "chrome_update", "browser_update", "shared_module_update"]) {
      expect(welcomeFor(reason)).toBeNull()
    }
  })

  test("says it came from the extension, which is what changes the last beat", () => {
    expect(WELCOME_AT).toContain("from=extension")
  })
})
