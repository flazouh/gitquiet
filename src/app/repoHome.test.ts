import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import type { Touch, TouchWho } from "../domain/repoHome"
import { fillWho } from "./repoHome"

const touch = (path: string, oid: string, over: Partial<Touch> = {}): readonly [string, Touch] => [
  path,
  {
    at: "2026-07-30T12:00:00Z",
    said: "Say what this is for",
    url: `/o/r/commit/${oid}`,
    oid: Option.some(oid),
    who: Option.none(),
    ...over
  }
]

const who: TouchWho = { login: "flazouh", face: Option.none() }

describe("naming who wrote the last commit", () => {
  test("asks once per SHA, even when two rows share the commit", async () => {
    const asked: Array<string> = []
    const named = await Effect.runPromise(
      fillWho(new Map([touch("a.ts", "abc"), touch("b.ts", "abc")]), (sha) =>
        Effect.sync(() => {
          asked.push(sha)
          return who
        })
      )
    )

    expect(asked).toEqual(["abc"])
    expect(Option.getOrNull(named.get("a.ts")?.who ?? Option.none())?.login).toBe("flazouh")
    expect(Option.getOrNull(named.get("b.ts")?.who ?? Option.none())?.login).toBe("flazouh")
  })

  test("does not ask for a SHA the first route already named", async () => {
    const asked: Array<string> = []
    await Effect.runPromise(
      fillWho(
        new Map([touch("a.ts", "abc", { who: Option.some(who) })]),
        (sha) =>
          Effect.sync(() => {
            asked.push(sha)
            return who
          })
      )
    )

    expect(asked).toEqual([])
  })

  test("keeps the message when a SHA cannot be named", async () => {
    const named = await Effect.runPromise(
      fillWho(new Map([touch("a.ts", "abc")]), () => Effect.fail("no"))
    )

    expect(named.get("a.ts")?.said).toBe("Say what this is for")
    expect(named.get("a.ts")?.who).toEqual(Option.none())
  })
})
