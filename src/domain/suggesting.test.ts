import { describe, expect, test } from "bun:test"
import { asking, filled, matching, type Numbered, type Named } from "./suggesting"

/**
 * What a box offers while somebody types, and where the offer comes from.
 *
 * Two triggers, both of which anybody who writes on GitHub already uses: `@` for a person and
 * `#` for an issue. The rules are here rather than in the box for the usual reason: which
 * word the caret is in is a string question, and the list under the caret is not.
 */

const people: ReadonlyArray<Named> = [
  { login: "flazouh", name: "Alex" },
  { login: "flowline-bot", name: "Flowline" },
  { login: "jarred", name: "Jarred Sumner" }
]

const issues: ReadonlyArray<Numbered> = [
  { number: 77, title: "Closing an issue", state: "open" },
  { number: 78, title: "The canonical one", state: "closed" },
  { number: 120, title: "Flaky test on Windows", state: "open" }
]

describe("what the caret is asking for", () => {
  const at = (written: string) => asking(written.replace("|", ""), written.indexOf("|"))

  test("asks for a person after an at sign", () => {
    expect(at("thanks @fla|")).toEqual({ kind: "person", said: "fla", from: 7 })
  })

  test("asks for an issue after a hash", () => {
    expect(at("same as #7|")).toEqual({ kind: "issue", said: "7", from: 8 })
  })

  test("asks for nothing where the trigger has not been typed yet", () => {
    expect(at("thanks |")).toBeUndefined()
  })

  test("offers the whole list on the trigger alone, which is how a reader browses", () => {
    expect(at("thanks @|")).toEqual({ kind: "person", said: "", from: 7 })
  })

  /*
   * An address has an at sign in the middle of a word, and that is not a mention. A hash at
   * the start of one is a reference, even when what follows turns out to be a colour: the
   * offer is made and `matching` finds nothing, so nothing is shown either way.
   */
  test("says nothing mid-word, where the trigger is part of something else", () => {
    expect(at("write to alex@example|")).toBeUndefined()
  })

  test("offers issues for a hash that turns out to be a colour, and finds none", () => {
    expect(at("the colour #ff00aa|")).toEqual({ kind: "issue", said: "ff00aa", from: 11 })
    expect(matching(issues, "ff00aa")).toEqual([])
  })

  test("says nothing once the word has a space in it, the offer being over by then", () => {
    expect(at("thanks @fla and |")).toBeUndefined()
  })

  test("reads the caret rather than the end of the text", () => {
    expect(at("thanks @fla| for that")).toEqual({ kind: "person", said: "fla", from: 7 })
  })

  test("takes a trigger at the very start of the box", () => {
    expect(at("@fla|")).toEqual({ kind: "person", said: "fla", from: 0 })
  })

  test("takes a trigger after a bracket or a line, which are not letters", () => {
    expect(at("(@fla|")).toEqual({ kind: "person", said: "fla", from: 1 })
    expect(at("one\n@fla|")).toEqual({ kind: "person", said: "fla", from: 4 })
  })
})

describe("which of them to offer, and in what order", () => {
  test("offers everybody on the trigger alone", () => {
    expect(matching(people, "").length).toBe(3)
  })

  test("finds a person by the start of their login", () => {
    expect(matching(people, "fl").map((one) => one.login)).toEqual(["flazouh", "flowline-bot"])
  })

  test("finds a person by their name, which is what a reader remembers", () => {
    expect(matching(people, "jarred s").map((one) => one.login)).toEqual(["jarred"])
  })

  test("puts a login that starts with what was typed above one that merely holds it", () => {
    const both: ReadonlyArray<Named> = [
      { login: "not-alex", name: "Someone" },
      { login: "alex", name: "Alex" }
    ]

    expect(matching(both, "alex").map((one) => one.login)).toEqual(["alex", "not-alex"])
  })

  test("finds an issue by its number", () => {
    expect(matching(issues, "7").map((one) => one.number)).toEqual([77, 78])
  })

  test("finds an issue by a word in its title", () => {
    expect(matching(issues, "flaky").map((one) => one.number)).toEqual([120])
  })

  test("offers nothing where nothing matches, rather than everything", () => {
    expect(matching(people, "zzz")).toEqual([])
  })

  test("keeps the list short enough to read", () => {
    const many = Array.from({ length: 40 }, (_, at) => ({ login: `person-${at}`, name: "" }))

    expect(matching(many, "person").length).toBe(8)
  })
})

describe("putting the chosen one in", () => {
  test("replaces what was typed with the whole login and a space", () => {
    expect(filled("thanks @fla", 7, 11, "@flazouh")).toEqual({
      text: "thanks @flazouh ",
      caret: 16
    })
  })

  test("leaves what comes after the caret where it was", () => {
    expect(filled("thanks @fla for that", 7, 11, "@flazouh")).toEqual({
      text: "thanks @flazouh  for that",
      caret: 16
    })
  })

  test("puts an issue in by its number", () => {
    expect(filled("same as #7", 8, 10, "#77")).toEqual({ text: "same as #77 ", caret: 12 })
  })
})
