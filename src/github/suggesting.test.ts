import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { decodeMentionable, decodeReferable, numberedIn, peopleIn } from "./suggesting"

/**
 * Their suggester's two answers, read as people and as issues.
 *
 * Both bodies are as recorded from `flazouh/stack-probe` on 2026-08-06.
 */

describe("who can be mentioned", () => {
  test("reads a login and the name beside it", async () => {
    const said = await Effect.runPromise(
      decodeMentionable([
        { type: "user", id: 25705704, login: "flazouh", name: "Alex" },
        { type: "team", id: 3, login: "flowline/core", name: null }
      ])
    )

    expect(peopleIn(said)).toEqual([
      { login: "flazouh", name: "Alex" },
      { login: "flowline/core", name: "" }
    ])
  })

  test("reads an answer with nobody in it, which a fresh repository gives", async () => {
    const said = await Effect.runPromise(decodeMentionable([]))

    expect(peopleIn(said)).toEqual([])
  })
})

describe("what can be referred to by number", () => {
  test("reads the number, the title, and whether it is closed", async () => {
    const said = await Effect.runPromise(
      decodeReferable({
        suggestions: [
          { id: 1, number: 76, title: "Conflicted files", type: "pull_request" },
          { id: 2, number: 77, title: "Closing an issue", type: "issue_open" },
          { id: 3, number: 78, title: "The canonical one", type: "issue_closed" }
        ]
      })
    )

    expect(numberedIn(said)).toEqual([
      { number: 76, title: "Conflicted files", state: "open" },
      { number: 77, title: "Closing an issue", state: "open" },
      { number: 78, title: "The canonical one", state: "closed" }
    ])
  })

  /*
   * `skip` is their word for the issue the reader is on. It stays: a comment on an issue
   * refers to that issue as often as to any other.
   */
  test("keeps the one the reader is looking at", async () => {
    const said = await Effect.runPromise(
      decodeReferable({ suggestions: [{ id: 1, number: 77, title: "This one", type: "skip" }] })
    )

    expect(numberedIn(said)).toEqual([{ number: 77, title: "This one", state: "open" }])
  })
})
