import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Fiber, Option } from "effect"
import answered from "../../fixtures/github/repo-home-touches.json"
import type { Touch, TouchWho } from "../domain/repoHome"
import { layer } from "../github/GitHubGateway"
import { fillWho, loadFolderTouches } from "./repoHome"

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

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/**
 * A folder's column answered, and every author read left hanging.
 *
 * Which is the shape of the complaint: a folder of many files is many unique
 * commits, and reading one commit page is a request of its own.
 */
const heldAtTheFaces = (): ReadonlyArray<string> => {
  const asked: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    asked.push(url)
    if (url.includes("/tree-commit-info/")) {
      return Promise.resolve(
        new Response(JSON.stringify(answered), {
          headers: { "content-type": "application/json" }
        })
      )
    }
    return new Promise<Response>(() => {})
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return asked
}

const soon = async (there: () => boolean): Promise<boolean> => {
  for (let tries = 0; tries < 50; tries += 1) {
    if (there()) return true
    await new Promise((wake) => setTimeout(wake, 10))
  }
  return there()
}

describe("the last commits under one folder", () => {
  const repo = { owner: "flazouh", repo: "githubpro" }

  test("reports the messages before the faces, as the root column does", async () => {
    heldAtTheFaces()
    const staged: Array<ReadonlyMap<string, Touch>> = []

    const reading = Effect.runFork(
      loadFolderTouches(repo, "head", "src", (found) => staged.push(found)).pipe(
        Effect.provide(layer)
      )
    )

    expect(await soon(() => staged.length > 0)).toBe(true)
    expect([...(staged[0] ?? new Map()).keys()].every((path) => path.startsWith("src/"))).toBe(true)

    await Effect.runPromise(Fiber.interrupt(reading))
  })

  test("asks that folder's own route, which answers relative to it", async () => {
    const asked = heldAtTheFaces()
    const staged: Array<ReadonlyMap<string, Touch>> = []

    const reading = Effect.runFork(
      loadFolderTouches(repo, "head", "src/ui", (found) => staged.push(found)).pipe(
        Effect.provide(layer)
      )
    )

    expect(await soon(() => staged.length > 0)).toBe(true)
    expect(asked[0]).toContain("/tree-commit-info/head/src/ui")

    await Effect.runPromise(Fiber.interrupt(reading))
  })
})
