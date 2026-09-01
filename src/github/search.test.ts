import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { GitHubGateway } from "../ports/GitHubGateway"
import { layer } from "./GitHubGateway"

/**
 * What the gateway sends to read a repository's pull request list, and what it
 * makes of the answer.
 *
 * The route is GitHub's dashboard search rather than the repository's own list
 * page, because that page is rendered and refuses to be read as JSON — it answers
 * 406 for anything but HTML. The search answers about repositories the reader has
 * never touched, which is what makes it usable here at all. URLs are asserted
 * literally: a route spelled differently is a route that answers 406.
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

/** A row as the search route sends one: no `category`, since only shelves carry it. */
const aRow = (over: Record<string, unknown> = {}) => ({
  id: "PR_kwDOABCDE84AAAAB",
  number: 96113,
  title: "[fragment-scroll] Stop blurring on navigations",
  repoNameWithOwner: "vercel/next.js",
  permalink: "https://github.com/vercel/next.js/pull/96113",
  author: { displayLogin: "icyJoseph" },
  state: "OPEN",
  isDraft: false,
  isReadByCurrentUser: true,
  commentCount: 3,
  createdAt: "2026-07-24T00:44:25+02:00",
  updatedAt: "2026-07-30T01:11:41+02:00",
  headSha: "8272e27274693caeecf068e9fcfa459c4bf109b1",
  category: null,
  labels: [],
  assignees: [],
  ...over
})

const searchPayload = (rows: ReadonlyArray<unknown>, pageInfo?: unknown) => ({
  payload: {
    pullsDashboardSurfaceContentRoute: {
      results: rows,
      ...(pageInfo === undefined ? {} : { pageInfo })
    }
  }
})

const searching = (query: string, page = 1) =>
  Effect.gen(function* () {
    const gateway = yield* GitHubGateway
    return yield* gateway.search(query, page)
  }).pipe(Effect.provide(layer))

describe("reading a page of GitHub's pull request search", () => {
  test("asks the dashboard's own search route, with the query escaped", async () => {
    const calls = intercept(() => Response.json(searchPayload([])))

    await Effect.runPromise(searching("repo:vercel/next.js is:pr is:open"))

    expect(calls[0]?.url).toBe(
      "https://github.com/pulls?q=repo%3Avercel%2Fnext.js+is%3Apr+is%3Aopen&page=1"
    )
  })

  test("asks for the page it was given", async () => {
    const calls = intercept(() => Response.json(searchPayload([])))

    await Effect.runPromise(searching("is:pr", 3))

    expect(calls[0]?.url).toContain("&page=3")
  })

  test("sends the header GitHub answers 406 without", async () => {
    const calls = intercept(() => Response.json(searchPayload([])))

    await Effect.runPromise(searching("is:pr"))

    expect(calls[0]?.headers.get("X-Requested-With")).toBe("XMLHttpRequest")
    expect(calls[0]?.headers.get("Accept")).toBe("application/json")
  })

  test("reads the rows as pull requests on no shelf at all", async () => {
    // The whole difference from a shelf read. These rows were not put anywhere by
    // GitHub on the reader's behalf, and saying so is what keeps a stranger's work
    // out of Needs You.
    intercept(() => Response.json(searchPayload([aRow()])))

    const found = await Effect.runPromise(searching("repo:vercel/next.js is:pr"))

    expect(found.rows).toHaveLength(1)
    expect(found.rows[0]?.reference).toEqual({ owner: "vercel", repo: "next.js", number: 96113 })
    expect(found.rows[0]?.shelf).toEqual(Option.none())
    expect(found.rows[0]?.why).toEqual(Option.none())
  })

  test("drops a row it cannot read and keeps the rest, rather than blanking the page", async () => {
    // The resilience the loose listing buys. A row whose shape GitHub changed, or
    // one carrying a field in a form nothing here decodes, costs that one row. The
    // twenty-four beside it are still the list the reader came for. Only a payload
    // with no rows array at all is a read that failed.
    intercept(() =>
      Response.json(searchPayload([aRow(), { itemType: "pull_request", broken: true }, aRow({ permalink: "https://github.com/vercel/next.js/pull/96114", number: 96114 })]))
    )

    const found = await Effect.runPromise(searching("repo:vercel/next.js is:pr"))

    expect(found.rows.map((row) => row.reference.number)).toEqual([96113, 96114])
  })

  test("says how many there are altogether, where GitHub said", async () => {
    // A repository can have two thousand open pull requests and a page holds
    // twenty-five. Without the count the reader cannot tell a small repository from
    // the first page of a large one.
    intercept(() =>
      Response.json(
        searchPayload([aRow()], { currentPage: 2, totalPages: 40, totalCount: 1989 })
      )
    )

    const found = await Effect.runPromise(searching("is:pr", 2))

    expect(found.pages).toEqual(Option.some({ current: 2, total: 40, count: 1989 }))
  })

  test("still answers when GitHub says nothing about paging", async () => {
    intercept(() => Response.json(searchPayload([aRow()])))

    const found = await Effect.runPromise(searching("is:pr"))

    expect(found.pages).toEqual(Option.none())
    expect(found.rows).toHaveLength(1)
  })

  test("reports a refusal as one rather than an empty repository", async () => {
    intercept(() => new Response("not acceptable", { status: 406 }))

    const error = await Effect.runPromise(Effect.flip(searching("is:pr")))

    expect(error.reason).toBe("rejected")
    expect(error.detail).toBe("HTTP 406")
  })

  test("reports a payload it cannot decode instead of rendering half of it", async () => {
    intercept(() => Response.json({ payload: {} }))

    const error = await Effect.runPromise(Effect.flip(searching("is:pr")))

    expect(error.reason).toBe("undecodable")
  })
})
