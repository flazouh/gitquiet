import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { ReviewThread, ThreadComment } from "./PullRequest"
import { speakersIn, unansweredFirst } from "./threads"

const said = (login: string): ThreadComment => ({
  author: { login, isAutomated: false, faceUrl: Option.none() },
  body: "",
  html: "",
  createdAt: "2026-07-29T12:00:00Z"
})

const thread = (
  id: string,
  isResolved: boolean,
  ...logins: ReadonlyArray<string>
): ReviewThread => ({
  id,
  isResolved,
  at: Option.none(),
  comments: logins.map(said)
})

describe("who spoke in a thread", () => {
  test("counts a person once however often they wrote", () => {
    const people = speakersIn(thread("t1", false, "alex", "alex", "alex"))

    expect(people.map((person) => person.login)).toEqual(["alex"])
  })

  test("keeps them in the order they first spoke", () => {
    const people = speakersIn(thread("t1", false, "alex", "robin", "alex", "sam"))

    expect(people.map((person) => person.login)).toEqual(["alex", "robin", "sam"])
  })
})

describe("the order threads are read in", () => {
  test("puts what still wants an answer above what does not", () => {
    const sorted = unansweredFirst([
      thread("settled", true),
      thread("live", false),
      thread("also-settled", true),
      thread("also-live", false)
    ])

    expect(sorted.map((one) => one.id)).toEqual(["live", "also-live", "settled", "also-settled"])
  })

  test("leaves the order GitHub sent alone within each half", () => {
    // Which for review threads is the order they were opened, and the only
    // ordering either half has any claim to.
    const sorted = unansweredFirst([thread("first", false), thread("second", false)])

    expect(sorted.map((one) => one.id)).toEqual(["first", "second"])
  })

  test("does not disturb the array it was handed", () => {
    const threads = [thread("settled", true), thread("live", false)]

    unansweredFirst(threads)

    expect(threads.map((one) => one.id)).toEqual(["settled", "live"])
  })
})
