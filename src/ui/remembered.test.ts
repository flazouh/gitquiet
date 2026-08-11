import { afterEach, describe, expect, test } from "bun:test"
import { rememberFilter, rememberedFilter } from "./remembered"

afterEach(() => localStorage.clear())

describe("remembering what a list was filtered to", () => {
  test("nothing was filtered before anything was filtered", () => {
    expect(rememberedFilter("working-set")).toBe("")
  })

  test("comes back with what was last asked for", () => {
    rememberFilter("working-set", "author:me is:failing")

    expect(rememberedFilter("working-set")).toBe("author:me is:failing")
  })

  test("each list is remembered on its own", () => {
    // `author:someone` makes sense in the repository whose rows they are on and
    // nowhere else, so one screen's filter must not arrive on another's.
    rememberFilter("working-set", "is:unread")
    rememberFilter("flazouh/octo-repo", "author:seawatts")

    expect(rememberedFilter("working-set")).toBe("is:unread")
    expect(rememberedFilter("flazouh/octo-repo")).toBe("author:seawatts")
    expect(rememberedFilter("vercel/next.js")).toBe("")
  })

  test("forgetting is asking for nothing", () => {
    rememberFilter("working-set", "is:unread")
    rememberFilter("working-set", "")

    expect(rememberedFilter("working-set")).toBe("")
    // Cleared rather than left as an empty string, so a reader who never filters
    // does not carry a key around for the rest of the installation.
    expect(localStorage.getItem("gitquiet:filter:working-set")).toBeNull()
  })

  test("says nothing was filtered when the page has no storage to read", () => {
    // Private windows, storage turned off, quota spent. All of them are a list
    // that is simply unfiltered, never a screen that fails to draw.
    const held = globalThis.localStorage
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("denied")
      }
    })

    expect(rememberedFilter("working-set")).toBe("")
    expect(() => rememberFilter("working-set", "is:unread")).not.toThrow()

    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: held })
  })
})
