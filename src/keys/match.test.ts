import { describe, expect, test } from "bun:test"
import type { Bound, Command, Keys, Profile } from "./commands"
import { commandFor, PATIENCE, read } from "./match"

/** Whose keys a press is read against, written as one word at the call sites. */
const on = (profile: Profile = "standard", bound: Bound = {}): Keys => ({ profile, bound })

describe("what a keypress asks for", () => {
  test("moves through the files under the left hand", () => {
    expect(commandFor({ key: "s" }, on())).toBe("nextFile")
    expect(commandFor({ key: "w" }, on())).toBe("previousFile")
  })

  test("leaves the right hand's pair to the profile that lives on it", () => {
    expect(commandFor({ key: "j" }, on())).toBeNull()
    expect(commandFor({ key: "k" }, on())).toBeNull()
  })

  test("reaches review mode on the letter that names it", () => {
    // And in both profiles: `r` waits for a second key in vim, and nothing here
    // waits for one, so there is nothing of vim's to keep clear of.
    expect(commandFor({ key: "r" }, on())).toBe("reviewMode")
    expect(commandFor({ key: "r" }, on("vim"))).toBe("reviewMode")
  })

  test("reaches the filter and the way out", () => {
    expect(commandFor({ key: "f" }, on())).toBe("search")
    // The letter GitHub's own readers learnt, kept beside the one a left hand
    // can reach.
    expect(commandFor({ key: "/" }, on())).toBe("search")
    expect(commandFor({ key: "Escape" }, on())).toBe("dismiss")
  })

  test("leaves the question mark to GitHub, whose own sheet is behind it", () => {
    expect(commandFor({ key: "?", shift: true }, on())).toBeNull()
    expect(commandFor({ key: "?", shift: true }, on("vim"))).toBeNull()
  })

  test("keeps its hands off a shortcut belonging to the browser", () => {
    expect(commandFor({ key: "s", meta: true }, on())).toBeNull()
    expect(commandFor({ key: "s", ctrl: true }, on())).toBeNull()
    expect(commandFor({ key: "s", alt: true }, on())).toBeNull()
  })

  test("answers nothing at all when the reader has turned this off", () => {
    expect(commandFor({ key: "s" }, on("off"))).toBeNull()
    expect(commandFor({ key: "/" }, on("off"))).toBeNull()
  })

  test("moves through the files in the vim profile too", () => {
    expect(commandFor({ key: "j" }, on("vim"))).toBe("nextFile")
    expect(commandFor({ key: "k" }, on("vim"))).toBe("previousFile")
    // The left hand's pair belongs to the standard profile, not to this one.
    expect(commandFor({ key: "s" }, on("vim"))).toBeNull()
    expect(commandFor({ key: "w" }, on("vim"))).toBeNull()
  })

  test("says nothing about a key nobody bound", () => {
    expect(commandFor({ key: "q" }, on())).toBeNull()
    expect(commandFor({ key: "Enter" }, on())).toBeNull()
  })
})

describe("the keys a reader chose themselves", () => {
  test("answers the chord they wrote over the profile's own", () => {
    expect(commandFor({ key: "c" }, on("standard", { nextFile: "c" }))).toBe("nextFile")
  })

  test("stops answering the letter it replaced", () => {
    // The point of changing a key is knowing which key it is. A default left
    // underneath would be a second answer nobody was told about.
    expect(commandFor({ key: "s" }, on("standard", { nextFile: "c" }))).toBeNull()
  })

  test("takes the chord off whichever command had it before", () => {
    // One chord asking for two things asks for whichever the table is walked
    // into first, which is an ordering rather than an answer.
    expect(commandFor({ key: "x" }, on("standard", { nextFile: "x" }))).toBe("nextFile")
  })

  test("leaves the commands the reader said nothing about alone", () => {
    expect(commandFor({ key: "w" }, on("standard", { nextFile: "c" }))).toBe("previousFile")
  })

  test("stays quiet where the keyboard is turned off", () => {
    expect(commandFor({ key: "c" }, on("off", { nextFile: "c" }))).toBeNull()
  })

  test("ignores a chord that could never be pressed", () => {
    // A modifier held on its own is not a key being typed, so a binding on one
    // would look set and do nothing.
    expect(commandFor({ key: "s" }, on("standard", { nextFile: "Shift" }))).toBe("nextFile")
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
  keys: Keys = on(),
  answered: (command: Command) => boolean = () => true
): ReadonlyArray<Command | null> => {
  let waiting = null
  const said: Array<Command | null> = []
  for (const [key, at] of presses) {
    const reading = read({ key }, keys, waiting, answered, at)
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
    expect(after([["g", 0], ["g", 40]])).toEqual([null, "home"])
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
    expect(after([["s", 0]])).toEqual(["nextFile"])
    expect(after([["g", 0], ["x", 40], ["s", 80]])).toEqual([null, null, "nextFile"])
  })

  test("gives a key back to the page once the sequence it opened has expired", () => {
    expect(after([["g", 0], ["s", PATIENCE + 1]])).toEqual([null, "nextFile"])
  })

  test("does not open a sequence nobody on the page is listening for", () => {
    // Left in the air rather than held: GitHub's own `g` sequences are live on
    // this same page, and a screen that answers no Destination has no business
    // taking the key that starts them.
    expect(read({ key: "g" }, on(), null, () => false).waiting).toBeNull()
    expect(read({ key: "g" }, on(), null, () => true).waiting).not.toBeNull()
  })

  test("keeps a half-typed sequence through the shift the reader is holding", () => {
    // A modifier arrives as a keypress of its own, and a sequence that counted
    // it as the second key would be unfinishable by anyone reaching for a
    // shifted letter.
    expect(after([["g", 0], ["Shift", 20], ["d", 40]])).toEqual([null, null, "workingSet"])
  })

  test("opens nothing at all with the keyboard turned off", () => {
    expect(after([["g", 0], ["d", 40]], on("off"))).toEqual([null, null])
  })

  test("keeps its hands off the leader held with a browser's modifier", () => {
    const reading = read({ key: "g", meta: true }, on(), null, () => true)
    expect(reading).toEqual({ command: null, waiting: null })
  })
})
