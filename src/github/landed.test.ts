import { describe, expect, test, afterEach } from "bun:test"
import { Option } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { allAsLanded, asLanded, forgetLanded, landedState, recordLanded } from "./landed"

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
    // The whole reason this is not permanent. It covers the seconds GitHub's own
    // page data takes to catch up; past that, GitHub is the better source and a
    // held state is only a way to go on saying something wrong — a pull request
    // reopened from another tab, say.
    recordLanded(one, "merged")
    Date.now = () => clock() + 61_000

    expect(Option.isNone(landedState(one))).toBe(true)
  })

  test("still holds just inside the minute", () => {
    recordLanded(one, "merged")
    Date.now = () => clock() + 59_000

    expect(landedState(one)).toEqual(Option.some("merged"))
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

  test("corrects the one row in a list and leaves its neighbours", () => {
    /*
     * The fault this was written for. A merge landed, Home was opened from
     * memory, and the pull request sat under Needs You for the two seconds the
     * live read took — `courtOf` files on the state, and the state was GitHub's
     * alone until the lists were decoded through here too.
     */
    recordLanded(one, "merged")

    const rows = allAsLanded([row(one, "open"), row(other, "open")])

    expect(rows.map((each) => each.state)).toEqual(["merged", "open"])
  })

  test("hands a list straight back when nothing has been written at all", () => {
    const rows = [row(one, "open")]

    expect(allAsLanded(rows)).toBe(rows)
  })
})
