import { describe, expect, test } from "bun:test"
import { letterFor } from "./letters"

const offered = ["m", "c", "d", "y"]

describe("the letter a press amounts to, among those on offer", () => {
  test("the letter itself, where something is offering it", () => {
    expect(letterFor({ key: "c" }, offered)).toBe("c")
  })

  test("nothing for a letter nobody here is offering", () => {
    // Left in the air rather than swallowed: the menu's own typeahead and the
    // page underneath it are both entitled to a key this layer has no claim on.
    expect(letterFor({ key: "z" }, offered)).toBeNull()
  })

  test("nothing while the browser or the system has a claim on the press", () => {
    // Cmd+C is a copy and Ctrl+D is a bookmark. A single letter that also fired
    // held is a shortcut that breaks the ones every reader already has.
    expect(letterFor({ key: "c", meta: true }, offered)).toBeNull()
    expect(letterFor({ key: "c", ctrl: true }, offered)).toBeNull()
    expect(letterFor({ key: "d", alt: true }, offered)).toBeNull()
  })

  test("the shifted letter is not the letter, the cap having promised the small one", () => {
    expect(letterFor({ key: "C", shift: true }, offered)).toBeNull()
  })

  test("nothing at all where nothing is offered", () => {
    expect(letterFor({ key: "c" }, [])).toBeNull()
  })
})
