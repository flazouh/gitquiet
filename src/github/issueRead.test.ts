import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { afterwards } from "../../tests/afterwards"
import { loadFixture } from "../../tests/fixtures"
import { forgetEverything, installStorage } from "../../tests/storage"
import type { IssueRef } from "../domain/issues"
import { GitHubGateway } from "../ports/GitHubGateway"
import { layer } from "./GitHubGateway"

/**
 * Two reads of one issue, which is what opening one from a list actually is.
 *
 * The pointer resting on a row reads the issue ahead, and the press a moment later
 * reads it again. Measured on an instrumented build before the reads were folded
 * together, milliseconds from the press: on their GraphQL route the screen's answer
 * came at 798ms and the read ahead's at 1494ms, and on the page path 4519ms and
 * 5427ms. Two whole reads, and resting on the row bought the reader nothing.
 *
 * Read through the gateway rather than through `flight.ts`, because the joining is
 * only worth anything if it happens where the screen asks: `gateway.issue` twice,
 * one fetch.
 */

installStorage()
beforeEach(forgetEverything)

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/**
 * How long a stubbed answer takes to come back, which may not be nothing.
 *
 * A request is joinable while it is in the air and no longer, which is the whole
 * design of `flight.ts`. The two reads of a page arrive out of two separate
 * three-second waits, so an answer that lands in the same tick it was asked for has
 * already settled before the second read gets there and there is nothing left to
 * join. GitHub answered the real page in about a second.
 */
const ANSWERED_IN = 50

const intercept = (respond: (url: string) => Response): ReadonlyArray<string> => {
  const asked: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    asked.push(String(input))
    return new Promise((resolve) => {
      setTimeout(() => resolve(respond(String(input))), ANSWERED_IN)
    })
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return asked
}

const reference: IssueRef = { owner: "react", repo: "react", number: 35000 }

/** This deploy's hash for their issue query, as one of theirs is shaped. */
const HASH = "16d22ec92e42cba436de5c76d5b5d94e"

const reading = (which: IssueRef) =>
  Effect.gen(function* () {
    const gateway = yield* GitHubGateway
    return yield* gateway.issue(which)
  }).pipe(Effect.provide(layer))

/**
 * Both reads at once, which is the whole of what is being tested.
 *
 * Concurrent rather than one after the other: an entry only exists while a request
 * is in the air, so a second read that waits for the first to land is a second read
 * that has nothing to join and must ask GitHub again.
 */
const twice = Effect.all([reading(reference), reading(reference)], { concurrency: "unbounded" })

const meta = (name: string, content: string) => {
  const tag = document.createElement("meta")
  tag.setAttribute("name", name)
  tag.setAttribute("content", content)
  document.head.append(tag)
  return () => tag.remove()
}

/** What the browser records having asked for, which is where a hash is read from. */
const recorded = (...names: ReadonlyArray<string>) => {
  const real = performance.getEntriesByType
  performance.getEntriesByType = ((kind: string) =>
    kind === "resource" ? names.map((name) => ({ name })) : []) as typeof real
  return () => {
    performance.getEntriesByType = real
  }
}

/** One request for a persisted query, as `performance` hands it back. */
const asking = (name: string, hash: string, variables: unknown = {}) =>
  `https://github.com/_graphql?body=${encodeURIComponent(
    JSON.stringify({ persistedQueryName: name, query: hash, variables })
  )}`

describe("two reads of one issue on their GraphQL route", () => {
  const undo = afterwards()

  const standingOn = () => {
    undo(recorded(asking("IssueViewerViewQuery", HASH)))
    undo(meta("fetch-nonce", "v2:87d025d2"))
  }

  test("asks their route once, the second read joining the first", async () => {
    standingOn()
    const asked = intercept(() => Response.json(loadFixture("issue-view")))

    await Effect.runPromise(twice)

    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain("/_graphql?body=")
  })

  test("answers both readers, the one that joined included", async () => {
    standingOn()
    intercept(() => Response.json(loadFixture("issue-view")))

    const [first, second] = await Effect.runPromise(twice)

    expect(first.title).toBe("Activity mode=“hidden” does not hide nested portals")
    expect(second.title).toBe(first.title)
    expect(second.remarks).toHaveLength(first.remarks.length)
  })

  test("reads two issues for themselves, their routes being two questions", async () => {
    standingOn()
    const asked = intercept(() => Response.json(loadFixture("issue-view")))

    await Effect.runPromise(
      Effect.all([reading(reference), reading({ ...reference, number: 35001 })], {
        concurrency: "unbounded"
      })
    )

    expect(asked).toHaveLength(2)
  })

  test("keeps GitHub's refusal, on the route it was always reported under", async () => {
    standingOn()
    intercept(() => new Response("", { status: 403 }))

    const error = await Effect.runPromise(Effect.flip(reading(reference)))

    expect(error.reason).toBe("rejected")
    expect(error.route).toBe("/_graphql")
    expect(error.detail).toBe("HTTP 403")
  })

  test("keeps a body that will not read as undecodable", async () => {
    standingOn()
    intercept(() => new Response("<html>their sign-in page</html>", { status: 200 }))

    const error = await Effect.runPromise(Effect.flip(reading(reference)))

    expect(error.reason).toBe("undecodable")
    expect(error.route).toBe("/_graphql")
  })
})

describe("two reads of one issue out of its own page", () => {
  const undo = afterwards()

  const RELEASE = "d1eb9dd4c8bbb35d2c2b40f8a2a8a2ba17e3b3f7"

  /** The row a kept hash is filed under, which is what a second page read would rewrite. */
  const kept = `hash:${RELEASE}/IssueViewerViewQuery`

  /**
   * Every write the store took, so a joiner that wrote nothing can be told from one
   * that wrote the same row again.
   */
  const writes = (): ReadonlyArray<string> => {
    const local = (
      globalThis as unknown as {
        readonly browser: {
          readonly storage: {
            readonly local: { set: (items: Record<string, unknown>) => Promise<void> }
          }
        }
      }
    ).browser.storage.local

    const real = local.set
    const keys: Array<string> = []
    local.set = (items) => {
      keys.push(...Object.keys(items))
      return real(items)
    }
    undo(() => {
      local.set = real
    })

    return keys
  }

  /**
   * A page with no hash anywhere: nothing recorded, nothing kept under this release.
   *
   * This is an issue reached from their own list, and it is the arrival the page path
   * exists for. It also costs the read three real seconds, which is `ASKING` in the
   * gateway: the hash is waited for before the page is fetched instead, so a test of
   * this path pays that wait once and asserts everything it can while it is there.
   */
  const standingOn = () => {
    undo(recorded(asking("IssueViewerSecondaryViewQuery", "b0f4a1d20e6b4c9d8f7a6e5d4c3b2a19")))
    undo(meta("release", RELEASE))
  }

  const page = (result: unknown) =>
    `<script type="application/json" data-target="react-app.embeddedData">${JSON.stringify({
      payload: {
        preloadedQueries: [{ queryId: HASH, queryName: "IssueViewerViewQuery", result }]
      }
    })}</script>`

  test(
    "fetches the page once for both readers, and keeps its hash once",
    async () => {
      standingOn()
      const wrote = writes()
      const asked = intercept(() => new Response(page(loadFixture("issue-view")), { status: 200 }))

      const [first, second] = await Effect.runPromise(twice)

      expect(asked).toEqual(["https://github.com/react/react/issues/35000"])
      expect(first.title).toBe("Activity mode=“hidden” does not hide nested portals")
      expect(second.title).toBe(first.title)
      // Once, because the write is inside the fold. Outside it, both readers would
      // write the same thirty-two bytes and the second would be paying to learn what
      // the first already knew.
      expect(wrote.filter((key) => key === kept)).toHaveLength(1)
    },
    10_000
  )

  /*
   * Both failures in one test, and two issues rather than one so that neither read
   * joins the other. The three-second wait above is the reason: written separately,
   * each of these would sit out its own three seconds to check one sentence.
   */
  test(
    "keeps both ways a page read fails, under the page's own route",
    async () => {
      standingOn()
      const bare: IssueRef = { ...reference, number: 35001 }
      intercept((url) =>
        url.endsWith("35001")
          ? new Response("<html><body>signed out</body></html>", { status: 200 })
          : new Response("", { status: 404 })
      )

      const [refused, unreadable] = await Effect.runPromise(
        Effect.all([Effect.flip(reading(reference)), Effect.flip(reading(bare))], {
          concurrency: "unbounded"
        })
      )

      expect(refused.reason).toBe("rejected")
      expect(refused.route).toBe("/react/react/issues/35000")
      // Their status alone, which is what this path has always said. `fetchRoute`
      // spells the same refusal `HTTP 404`, and both are read by people rather than
      // by code.
      expect(refused.detail).toBe("404")

      expect(unreadable.reason).toBe("undecodable")
      expect(unreadable.detail).toBe("no IssueViewerViewQuery preloaded in the page")
    },
    10_000
  )
})
