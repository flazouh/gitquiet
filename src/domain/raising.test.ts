import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { NOTHING_YET, enough, raisingIn, seeding } from "./raising"

const at = (path: string) => `https://github.com${path}`

const parsed = (url: string) => Option.getOrNull(raisingIn(url))

describe("the address of the form for raising an issue", () => {
  test("reads the owner and the repository out of it", () => {
    expect(parsed(at("/flowline-labs/flowline/issues/new"))).toEqual({
      owner: "flowline-labs",
      repo: "flowline"
    })
  })

  test("does not mind a trailing slash, which is how some of their links are written", () => {
    expect(parsed(at("/flowline-labs/flowline/issues/new/"))).toEqual({
      owner: "flowline-labs",
      repo: "flowline"
    })
  })

  test("is still the form when the address carries what to open with", () => {
    expect(parsed(at("/flowline-labs/flowline/issues/new?title=Crash+on+launch"))).toEqual({
      owner: "flowline-labs",
      repo: "flowline"
    })
  })

  test("is not the repository's list, which is the same address one segment shorter", () => {
    expect(parsed(at("/flowline-labs/flowline/issues"))).toBeNull()
  })

  test("is not one issue, which is a different page with a screen of its own", () => {
    expect(parsed(at("/flowline-labs/flowline/issues/2137"))).toBeNull()
  })

  test("is not their template picker, which is theirs on purpose", () => {
    // A menu of files kept in the repository. A reader who pressed it wants the
    // template rather than the blank box this screen would hand them instead.
    expect(parsed(at("/flowline-labs/flowline/issues/new/choose"))).toBeNull()
  })

  test("is not the pull request form, which is one word different", () => {
    expect(parsed(at("/flowline-labs/flowline/compare"))).toBeNull()
  })

  test("is not another site that happens to end this way", () => {
    expect(parsed("https://example.com/flowline-labs/flowline/issues/new")).toBeNull()
  })
})

describe("whether there is enough to send", () => {
  test("needs a title, which is what their own form marks as required", () => {
    expect(enough({ title: "Crash on launch", body: "" })).toBe(true)
  })

  test("does not need a description", () => {
    // Plenty of real issues are a title. Asking for a body would be this
    // interface refusing what GitHub accepts.
    expect(enough({ title: "Crash on launch", body: "" })).toBe(true)
  })

  test("is not enough with a description alone", () => {
    expect(enough({ title: "", body: "It crashes when I press the button." })).toBe(false)
  })

  test("counts a title of spaces as no title", () => {
    // It would otherwise make a row in every list that nobody can read.
    expect(enough({ title: "   ", body: "" })).toBe(false)
  })

  test("is not enough before the reader has typed anything", () => {
    expect(enough(NOTHING_YET)).toBe(false)
  })
})

describe("what the box opens with", () => {
  test("is empty where the address said nothing", () => {
    expect(seeding(at("/flowline-labs/flowline/issues/new"))).toEqual(NOTHING_YET)
  })

  test("says the title a `report this` link wrote", () => {
    expect(seeding(at("/flowline-labs/flowline/issues/new?title=Crash+on+launch"))).toEqual({
      title: "Crash on launch",
      body: ""
    })
  })

  test("says the description too, which is where a stack trace arrives", () => {
    expect(
      seeding(at("/flowline-labs/flowline/issues/new?title=Crash&body=at+main.ts%3A12"))
    ).toEqual({ title: "Crash", body: "at main.ts:12" })
  })

  test("ignores the rest of their query, which this form draws no controls for", () => {
    expect(
      seeding(at("/flowline-labs/flowline/issues/new?template=bug.md&labels=bug&assignees=aleks"))
    ).toEqual(NOTHING_YET)
  })
})
