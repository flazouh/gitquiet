import { describe, expect, test } from "bun:test"
import { DEFAULTS } from "../domain/Settings"
import { boundIn, keysOf, withBound } from "./keyboard"

describe("the keyboard the reader chose", () => {
  test("carries the profile and the chords together", () => {
    expect(keysOf({ ...DEFAULTS, bound: { nextFile: "c" } })).toEqual({
      profile: "standard",
      bound: { nextFile: "c" }
    })
  })

  test("drops a chord written against a command that no longer exists", () => {
    // Stored by a version of this that had one, and read by a version that does
    // not. A binding nothing answers is a row of the reader's own choices that
    // can never be undone from the panel it came from.
    expect(boundIn({ scrollDown: "c" })).toEqual({})
  })

  test("drops a chord that could never be pressed", () => {
    expect(boundIn({ nextFile: "Shift" })).toEqual({})
  })

  test("writes one command's chord and leaves the rest alone", () => {
    const settings = withBound({ ...DEFAULTS, bound: { search: "q" } }, "nextFile", "c")

    expect(settings.bound).toEqual({ search: "q", nextFile: "c" })
  })

  test("puts a command back on its own key rather than binding it to nothing", () => {
    const settings = withBound({ ...DEFAULTS, bound: { nextFile: "c" } }, "nextFile", null)

    expect(settings.bound).toEqual({})
    expect(keysOf(settings).bound).toEqual({})
  })
})
