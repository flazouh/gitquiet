import { describe, expect, test } from "bun:test"
import type { Command, Profile } from "./commands"
import { commandFor, PATIENCE, read } from "./match"

describe("what a keypress asks for", () => {
  test("moves through the files", () => {
    expect(commandFor({ key: "j" }, "standard")).toBe("nextFile")
    expect(commandFor({ key: "k" }, "standard")).toBe("previousFile")
  })

  test("takes the other pair of letters for the same two things", () => {
    expect(commandFor({ key: "n" }, "standard")).toBe("nextFile")
    expect(commandFor({ key: "p" }, "standard")).toBe("previousFile")
  })

  test("reaches the filter and the way out", () => {
    expect(commandFor({ key: "/" }, "standard")).toBe("search")
    expect(commandFor({ key: "Escape" }, "standard")).toBe("dismiss")
  })

  test("leaves the question mark to GitHub, whose own sheet is behind it", () => {
    expect(commandFor({ key: "?", shift: true }, "standard")).toBeNull()
    expect(commandFor({ key: "?", shift: true }, "vim")).toBeNull()
  })

  test("keeps its hands off a shortcut belonging to the browser", () => {
    expect(commandFor({ key: "j", meta: true }, "standard")).toBeNull()
    expect(commandFor({ key: "j", ctrl: true }, "standard")).toBeNull()
    expect(commandFor({ key: "j", alt: true }, "standard")).toBeNull()
  })

  test("answers nothing at all when the reader has turned this off", () => {
    expect(commandFor({ key: "j" }, "off")).toBeNull()
    expect(commandFor({ key: "/" }, "off")).toBeNull()
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

/**
 * A run of presses, each with the moment it landed, and what each amounted to.
 *
 * Written as a fold because that is what the reader's hands are: the answer to
 * one press is the state the next one is read against, and a test that reached
 * inside for it would be testing the shape rather than the reading.
 */
const after = (
  presses: ReadonlyArray<readonly [string, number]>,
  profile: Profile = "standard",
  answered: (command: Command) => boolean = () => true
): ReadonlyArray<Command | null> => {
  let waiting = null
  const said: Array<Command | null> = []
  for (const [key, at] of presses) {
    const reading = read({ key }, profile, waiting, answered, at)
    waiting = reading.waiting
    said.push(reading.command)
  }
  return said
}

describe("what two keys in a row ask for", () => {
  test("reaches each Destination from the leader", () => {
    expect(after([["g", 0], ["d", 40]])).toEqual([null, "workingSet"])
    expect(after([["g", 0], ["r", 40]])).toEqual([null, "repositories"])
    expect(after([["g", 0], ["f", 40]])).toEqual([null, "activity"])
    expect(after([["g", 0], ["h", 40]])).toEqual([null, "home"])
  })

  test("asks for nothing on the leader alone", () => {
    expect(after([["g", 0]])).toEqual([null])
  })

  test("asks for nothing when the second key finishes no sequence", () => {
    expect(after([["g", 0], ["x", 40]])).toEqual([null, null])
  })

  test("has forgotten the leader once the reader has stopped to think", () => {
    expect(after([["g", 0], ["d", PATIENCE + 1]])).toEqual([null, null])
  })

  test("still finishes a sequence typed as two deliberate presses", () => {
    expect(after([["g", 0], ["d", PATIENCE]])).toEqual([null, "workingSet"])
  })

  test("leaves a single key doing what it did before the leader existed", () => {
    expect(after([["j", 0]])).toEqual(["nextFile"])
    expect(after([["g", 0], ["x", 40], ["j", 80]])).toEqual([null, null, "nextFile"])
  })

  test("gives a key back to the page once the sequence it opened has expired", () => {
    expect(after([["g", 0], ["j", PATIENCE + 1]])).toEqual([null, "nextFile"])
  })

  test("does not open a sequence nobody on the page is listening for", () => {
    // Left in the air rather than held: GitHub's own `g` sequences are live on
    // this same page, and a screen that answers no Destination has no business
    // taking the key that starts them.
    expect(read({ key: "g" }, "standard", null, () => false).waiting).toBeNull()
    expect(read({ key: "g" }, "standard", null, () => true).waiting).not.toBeNull()
  })

  test("keeps a half-typed sequence through the shift the reader is holding", () => {
    // A modifier arrives as a keypress of its own, and a sequence that counted
    // it as the second key would be unfinishable by anyone reaching for a
    // shifted letter.
    expect(after([["g", 0], ["Shift", 20], ["d", 40]])).toEqual([null, null, "workingSet"])
  })

  test("opens nothing at all with the keyboard turned off", () => {
    expect(after([["g", 0], ["d", 40]], "off")).toEqual([null, null])
  })

  test("keeps its hands off the leader held with a browser's modifier", () => {
    const reading = read({ key: "g", meta: true }, "standard", null, () => true)
    expect(reading).toEqual({ command: null, waiting: null })
  })
})
