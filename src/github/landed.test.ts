import { describe, expect, test, afterEach } from "bun:test"
import { Option } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { asLanded, forgetLanded, landedNow, landedState, recordLanded, seedLanded } from "./landed"

const one: PullRequestRef = { owner: "flazouh", repo: "gitquiet", number: 7 }
const other: PullRequestRef = { owner: "flazouh", repo: "gitquiet", number: 8 }

const clock = Date.now

afterEach(() => {
  Date.now = clock
  forgetLanded()
})

describe("what our own writes know that a read does not", () => {
  test("says nothing about a pull request nobody has written to", () => {
    expect(Option.isNone(landedState(one))).toBe(true)
  })

  test("holds the state a write made true", () => {
    recordLanded(one, "merged")

    expect(landedState(one)).toEqual(Option.some("merged"))
  })

  test("keeps one pull request's write off another", () => {
    recordLanded(one, "merged")

    expect(Option.isNone(landedState(other))).toBe(true)
  })

  test("takes the newer write, so a reopen puts a close back", () => {
    recordLanded(one, "closed")
    recordLanded(one, "open")

    expect(landedState(one)).toEqual(Option.some("open"))
  })

  test("lets go once GitHub has had long enough to agree", () => {
    // The whole reason this is not permanent. Past the window GitHub is the
    // better source, and a held state is only a way to go on saying something
    // wrong — a pull request reopened from another tab, say.
    recordLanded(one, "merged")
    Date.now = () => clock() + 6 * 60_000

    expect(Option.isNone(landedState(one))).toBe(true)
  })

  test("still holds while their search index could still be behind", () => {
    // A minute was the window while this covered their page data alone. The
    // Working Set is read off their search, which is behind by minutes.
    recordLanded(one, "merged")
    Date.now = () => clock() + 4 * 60_000

    expect(landedState(one)).toEqual(Option.some("merged"))
  })
})

describe("what one document tells the next about its own writes", () => {
  /*
   * The map is per document and the reader's browsing is not. Close a pull
   * request on Home, open GitHub in a new tab, and their search still has it
   * open — so without this the row is back under Needs You, in a document that
   * has no idea a press ever happened.
   */
  test("hands out what was written, to be kept", () => {
    recordLanded(one, "merged")

    expect(landedNow()).toEqual({
      "flazouh/gitquiet#7": { state: "merged", at: clock() }
    })
  })

  test("hands out nothing once the window has passed", () => {
    recordLanded(one, "merged")
    Date.now = () => clock() + 6 * 60_000

    expect(landedNow()).toEqual({})
  })

  test("puts back what an earlier document wrote", () => {
    seedLanded({ "flazouh/gitquiet#7": { state: "closed", at: Date.now() } })

    expect(landedState(one)).toEqual(Option.some("closed"))
  })

  test("leaves this document's own press alone, it being the newer", () => {
    recordLanded(one, "open")
    seedLanded({ "flazouh/gitquiet#7": { state: "closed", at: Date.now() } })

    expect(landedState(one)).toEqual(Option.some("open"))
  })

  test("ignores a record older than the window", () => {
    seedLanded({ "flazouh/gitquiet#7": { state: "closed", at: Date.now() - 6 * 60_000 } })

    expect(Option.isNone(landedState(one))).toBe(true)
  })

  test("ignores anything that is not a state and a moment", () => {
    // Whatever is in storage was written by a build that may not be this one, so
    // it is shaped rather than trusted.
    seedLanded({
      "flazouh/gitquiet#7": { state: "abandoned", at: Date.now() },
      "flazouh/gitquiet#8": "closed",
      "flazouh/gitquiet#9": { state: "closed" }
    })

    expect(Option.isNone(landedState(one))).toBe(true)
    expect(Option.isNone(landedState(other))).toBe(true)
  })
})

describe("what a read wears once our own write disagrees with it", () => {
  const row = (reference: PullRequestRef, state: "open" | "merged") => ({
    reference,
    state,
    title: "Make the widget spin"
  })

  test("leaves a read alone where nothing was written", () => {
    const read = row(one, "open")

    expect(asLanded(read)).toBe(read)
  })

  test("wears the state our write made, over what the read said", () => {
    recordLanded(one, "merged")

    expect(asLanded(row(one, "open")).state).toBe("merged")
  })

  test("keeps everything else the read carried", () => {
    recordLanded(one, "merged")

    expect(asLanded(row(one, "open")).title).toBe("Make the widget spin")
  })
})
