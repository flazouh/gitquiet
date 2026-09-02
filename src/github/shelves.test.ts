import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { GitHubGateway } from "../ports/GitHubGateway"
import { layer } from "./GitHubGateway"

/**
 * What the gateway sends to GitHub for a Working Set, and what it makes of the
 * answer. The URLs are asserted literally because they were read off GitHub's
 * own dashboard: a route spelled differently is a route that answers 406.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

type Call = { readonly url: string; readonly headers: Headers }

const intercept = (respond: (url: string) => Response): ReadonlyArray<Call> => {
  const calls: Array<Call> = []
  const handler = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    calls.push({ url, headers: new Headers(init?.headers) })
    return Promise.resolve(respond(url))
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return calls
}

const aRow = (over: Record<string, unknown> = {}) => ({
  id: "PR_kwDOAn8RLM8AAAABB5X9Fw",
  number: 1457,
  title: "price claude turns from the streamed usage",
  repoNameWithOwner: "octo-org/octo-repo",
  permalink: "https://github.com/octo-org/octo-repo/pull/1457",
  author: { displayLogin: "flazouh" },
  state: "OPEN",
  isDraft: false,
  isReadByCurrentUser: true,
  commentCount: 4,
  createdAt: "2026-07-28T19:43:33+02:00",
  updatedAt: "2026-07-29T04:19:41+02:00",
  headSha: "0f95bb9db765f8134a8c33b4f6ecbdb21666e32e",
  category: "CI_FAILING",
  labels: [],
  assignees: [],
  ...over
})

const shelfPayload = (rows: ReadonlyArray<unknown>) => ({
  payload: { pullsInboxSurfaceContentRoute: { results: rows } }
})

const deferredPayload = (results: ReadonlyArray<unknown>) => ({
  payload: { pullsInboxSurfaceContentDeferredData: { results } }
})

const readingShelf = Effect.gen(function* () {
  const gateway = yield* GitHubGateway
  return yield* gateway.workingSet("needs-action")
}).pipe(Effect.provide(layer))

const readingStandings = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const gateway = yield* GitHubGateway
    return yield* gateway.standingsFor(ids)
  }).pipe(Effect.provide(layer))

describe("reading one shelf of the Working Set", () => {
  test("asks the route GitHub's own dashboard asks, window and all", async () => {
    const calls = intercept(() => Response.json(shelfPayload([])))

    await Effect.runPromise(readingShelf)

    expect(calls[0]?.url).toBe(
      "https://github.com/pulls/inbox/queries?filter=needs-action&max_pr_age=1m"
    )
  })

  test("sends the header GitHub answers 406 without", async () => {
    const calls = intercept(() => Response.json(shelfPayload([])))

    await Effect.runPromise(readingShelf)

    expect(calls[0]?.headers.get("X-Requested-With")).toBe("XMLHttpRequest")
    expect(calls[0]?.headers.get("Accept")).toBe("application/json")
  })

  test("reads the rows as Involved Pull Requests, on the shelf they came from", async () => {
    intercept(() => Response.json(shelfPayload([aRow()])))

    const involved = await Effect.runPromise(readingShelf)

    expect(involved).toHaveLength(1)
    expect(involved[0]?.reference).toEqual({
      owner: "octo-org",
      repo: "octo-repo",
      number: 1457
    })
    expect(involved[0]?.shelf).toEqual(Option.some("needs-action"))
  })

  test("reports a refusal as one rather than an empty Working Set", async () => {
    // An empty shelf and a shelf that would not load are the same picture and
    // must not be the same answer: one means nothing needs the Participant.
    intercept(() => new Response("not acceptable", { status: 406 }))

    const error = await Effect.runPromise(Effect.flip(readingShelf))

    expect(error.reason).toBe("rejected")
    expect(error.detail).toBe("HTTP 406")
  })

  test("reports a payload it cannot decode instead of rendering half of it", async () => {
    intercept(() => Response.json({ payload: {} }))

    const error = await Effect.runPromise(Effect.flip(readingShelf))

    expect(error.reason).toBe("undecodable")
  })
})

describe("reading how the listed pull requests stand", () => {
  test("asks nothing at all for nothing at all", async () => {
    // The empty Working Set. A request with no ids in it is a request for
    // everything or an error, depending on GitHub's mood, and neither is wanted.
    const calls = intercept(() => Response.json(deferredPayload([])))

    const standings = await Effect.runPromise(readingStandings([]))

    expect(calls).toHaveLength(0)
    expect(standings.size).toBe(0)
  })

  test("spells the ids the way their route reads them", async () => {
    const calls = intercept(() => Response.json(deferredPayload([])))

    await Effect.runPromise(readingStandings(["11", "22"]))

    expect(calls[0]?.url).toBe(
      "https://github.com/pulls/inbox/deferred?page=1&pr_ids%5B%5D=11&pr_ids%5B%5D=22"
    )
  })

  test("batches nine at a time, as their own dashboard does", async () => {
    // Ten ids is two requests. A batch size nobody has served is a batch size
    // nobody has tested, and being wrong costs the whole listing's second half.
    const calls = intercept(() => Response.json(deferredPayload([])))

    await Effect.runPromise(readingStandings(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]))

    expect(calls).toHaveLength(2)
    expect(calls[0]?.url).toContain("pr_ids%5B%5D=9")
    expect(calls[1]?.url).toBe("https://github.com/pulls/inbox/deferred?page=1&pr_ids%5B%5D=10")
  })

  test("joins every batch into one answer", async () => {
    intercept((url) =>
      Response.json(
        deferredPayload([
          {
            id: url.includes("pr_ids%5B%5D=10") ? "10" : "1",
            statusCheckRollup: { state: "SUCCESS", totalCount: 2, successCount: 2 }
          }
        ])
      )
    )

    const standings = await Effect.runPromise(
      readingStandings(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"])
    )

    expect([...standings.keys()].toSorted()).toEqual(["1", "10"])
  })
})
