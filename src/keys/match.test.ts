import { describe, expect, test } from "bun:test"
import { commandFor } from "./match"

describe("what a keypress asks for", () => {
  test("moves through the files", () => {
    expect(commandFor({ key: "j" }, "standard")).toBe("nextFile")
    expect(commandFor({ key: "k" }, "standard")).toBe("previousFile")
  })

  test("takes the other pair of letters for the same two things", () => {
    expect(commandFor({ key: "n" }, "standard")).toBe("nextFile")
    expect(commandFor({ key: "p" }, "standard")).toBe("previousFile")
  })

  test("reaches the filter, the way out, and the list of these", () => {
    expect(commandFor({ key: "/" }, "standard")).toBe("search")
    expect(commandFor({ key: "Escape" }, "standard")).toBe("dismiss")
    expect(commandFor({ key: "?", shift: true }, "standard")).toBe("help")
  })

  test("keeps its hands off a shortcut belonging to the browser", () => {
    expect(commandFor({ key: "j", meta: true }, "standard")).toBeNull()
    expect(commandFor({ key: "j", ctrl: true }, "standard")).toBeNull()
    expect(commandFor({ key: "j", alt: true }, "standard")).toBeNull()
  })

  test("answers nothing at all when the reader has turned this off", () => {
    expect(commandFor({ key: "j" }, "off")).toBeNull()
    expect(commandFor({ key: "?", shift: true }, "off")).toBeNull()
  })

  test("moves through the files in the vim profile too", () => {
    expect(commandFor({ key: "j" }, "vim")).toBe("nextFile")
    expect(commandFor({ key: "k" }, "vim")).toBe("previousFile")
    // The letters vim spends on other things are not borrowed for files.
    expect(commandFor({ key: "n" }, "vim")).toBeNull()
    expect(commandFor({ key: "p" }, "vim")).toBeNull()
  })

  test("says nothing about a key nobody bound", () => {
    expect(commandFor({ key: "q" }, "standard")).toBeNull()
    expect(commandFor({ key: "Enter" }, "standard")).toBeNull()
  })
})
