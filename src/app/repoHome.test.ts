import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Fiber, Option } from "effect"
import blob from "../../fixtures/github/blob-markdown.json"
import answered from "../../fixtures/github/repo-home-touches.json"
import type { Touch, TouchWho } from "../domain/repoHome"
import { layer } from "../github/GitHubGateway"
import { fillWho, loadFolderTouches, loadReadme } from "./repoHome"

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

/** The column answered, and every face answered as well. */
const answering = (): ReadonlyArray<string> => {
  const asked: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    asked.push(url)
    const body = url.includes("/tree-commit-info/")
      ? answered
      : { oid: url.split("/latest-commit/")[1] ?? "", author: { login: "flazouh" } }
    return Promise.resolve(
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })
    )
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

  /*
   * The face used to come off the commit's own page, which carries the whole
   * diff to name one person: 28 kilobytes here and 390 on `facebook/react`,
   * against 2 for this route.
   */
  test("reads the face off the cheap route, not off the commit's own page", async () => {
    const asked = answering()

    await Effect.runPromise(
      loadFolderTouches(repo, "head", "src").pipe(Effect.provide(layer))
    )

    expect(asked.some((url) => url.includes("/latest-commit/"))).toBe(true)
    expect(asked.some((url) => url.includes("/commit/"))).toBe(false)
  })

  test("asks once for a commit two folders share", async () => {
    const asked = answering()
    // Its own repository, because the faces are remembered for as long as the
    // document lives and another test in this file has already named these.
    const alone = { owner: "flazouh", repo: "shared-commits" }

    await Effect.runPromise(
      loadFolderTouches(alone, "head", "src").pipe(Effect.provide(layer))
    )
    const first = asked.filter((url) => url.includes("/latest-commit/")).length
    await Effect.runPromise(
      loadFolderTouches(alone, "head", "src/ui").pipe(Effect.provide(layer))
    )

    expect(first).toBeGreaterThan(0)
    expect(asked.filter((url) => url.includes("/latest-commit/"))).toHaveLength(first)
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

/** Their page for a file, with the payload written into it as GitHub writes it. */
const blobPage = (): string =>
  `<html><body><script type="application/json" data-target="react-app.embeddedData">${JSON.stringify(blob)}</script></body></html>`

/**
 * The raw route answered or refused, and their page for the file behind it.
 *
 * `refusing` is a repository the raw route will not serve, which is the case the
 * fallback exists for.
 */
const serving = (refusing: boolean): ReadonlyArray<string> => {
  const asked: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    asked.push(url)

    if (url.includes("/raw/")) {
      return Promise.resolve(
        refusing
          ? new Response("Not Found", { status: 404 })
          : new Response("# Flowline\n\nA queue, a worker and somewhere to watch them.", {
              headers: { "content-type": "text/plain" }
            })
      )
    }

    return Promise.resolve(
      new Response(blobPage(), { headers: { "content-type": "text/html" } })
    )
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return asked
}

/**
 * The README as text, which is what makes it this interface's markdown rather
 * than GitHub's HTML.
 */
describe("the README's own source", () => {
  const repo = { owner: "flowline-labs", repo: "flowline" }

  test("comes off the raw route, not off their page for the file", async () => {
    const asked = serving(false)

    const source = await Effect.runPromise(
      loadReadme(repo, "main", "README.md").pipe(Effect.provide(layer))
    )

    expect(source.startsWith("# Flowline")).toBe(true)
    expect(asked).toEqual(["https://github.com/flowline-labs/flowline/raw/main/README.md"])
  })

  /*
   * The raw route reaches a private repository through a redirect GitHub signs.
   * Where a repository is ever met that it will not serve, a heavier read beats
   * a README nobody can draw in this interface's own chrome.
   */
  test("falls back to their page for the file where the raw route is refused", async () => {
    const asked = serving(true)

    const source = await Effect.runPromise(
      loadReadme(repo, "main", "README.md").pipe(Effect.provide(layer))
    )

    expect(source.length).toBeGreaterThan(0)
    expect(asked.some((url) => url.includes("/blob/main/README.md"))).toBe(true)
  })
})
