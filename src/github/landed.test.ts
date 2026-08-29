import { describe, expect, test, afterEach } from "bun:test"
import { Option } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { forgetLanded, landedState, recordLanded } from "./landed"

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
