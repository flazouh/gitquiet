import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import type { RepoList } from "../domain/repoList"
import { layer } from "../github/GitHubGateway"
import { type Listed, loadRepoList } from "./repoList"

/**
 * What reading one page of a repository's list asks GitHub for, and what it does
 * when one of those reads fails.
 *
 * Driven through the real gateway with `fetch` intercepted, as every read here is
 * tested: the routes are part of the behaviour, and a hand-written fake gateway
 * would agree with whatever the code currently sends.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const intercept = (respond: (url: string) => Response): ReadonlyArray<string> => {
  const asked: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    asked.push(url)
    return Promise.resolve(respond(url))
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return asked
}

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })

const aRow = (over: Record<string, unknown> = {}) => ({
  id: 4120501898,
  number: 96113,
  title: "stop blurring on navigations",
  repoNameWithOwner: "vercel/next.js",
  permalink: "https://github.com/vercel/next.js/pull/96113",
  author: { displayLogin: "icyJoseph" },
  state: "OPEN",
  isDraft: false,
  isReadByCurrentUser: true,
  commentCount: 3,
  createdAt: "2026-07-24T00:44:25+02:00",
  updatedAt: "2026-07-30T01:11:41+02:00",
  headSha: "8272e272",
  category: null,
  labels: [],
  assignees: [],
  ...over
})

const searchAnswer = (rows: ReadonlyArray<unknown>, pageInfo?: unknown) =>
  json({
    payload: {
      pullsDashboardSurfaceContentRoute: {
        results: rows,
        ...(pageInfo === undefined ? {} : { pageInfo })
      }
    }
  })

const aShelf = (rows: ReadonlyArray<unknown>) =>
  json({ payload: { pullsInboxSurfaceContentRoute: { results: rows } } })

const noStandings = () =>
  json({ payload: { pullsInboxSurfaceContentDeferredData: { results: [] } } })

const aDiffstat = (added: number, deleted: number) =>
  json({ diffstat: { linesAdded: added, linesDeleted: deleted, linesChanged: added + deleted } })

/** A repository with one open pull request, none of it the reader's. */
const oneStranger = (url: string): Response => {
  if (url.includes("/pulls?q=")) {
    return searchAnswer([aRow()], { currentPage: 1, totalPages: 1, totalCount: 1 })
  }
  if (url.includes("/pulls/inbox/queries")) return aShelf([])
  if (url.includes("/pulls/inbox/deferred")) return noStandings()
  if (url.includes("/page_data/diffstat")) return aDiffstat(120, 8)
  return new Response("unexpected", { status: 404 })
}

const list: RepoList = { repo: { owner: "vercel", repo: "next.js" }, query: "", page: 1 }

const read = (over: Partial<RepoList> = {}) =>
  Effect.runPromise(loadRepoList({ ...list, ...over }).pipe(Effect.provide(layer)))

describe("reading one page of a repository's pull requests", () => {
  test("searches for the repository the address named", async () => {
    const asked = intercept(oneStranger)

    await read()

    const search = asked.find((url) => url.includes("/pulls?q="))
    expect(search).toContain("repo%3Avercel%2Fnext.js")
    expect(search).toContain("is%3Apr")
  })

  test("asks the reader's own shelves as well, to find their work among the rest", async () => {
    // The search knows nothing about the reader and the shelves know nothing about
    // repositories. Neither alone can tell the reader's three pull requests from the
    // two hundred around them.
    const asked = intercept(oneStranger)

    await read()

    expect(asked.filter((url) => url.includes("/pulls/inbox/queries"))).toHaveLength(6)
  })

  test("puts a stranger's pull request in Waiting", async () => {
    intercept(oneStranger)

    const listed = await read()

    expect(listed.sittings).toHaveLength(1)
    expect(listed.sittings[0]?.court).toBe("waiting")
  })

  test("puts one of the reader's own in the Court its shelf implies", async () => {
    intercept((url) =>
      url.includes("filter=ready-to-merge")
        ? aShelf([aRow({ category: "READY_TO_MERGE" })])
        : oneStranger(url)
    )

    const listed = await read()

    expect(listed.sittings[0]?.court).toBe("needs-you")
  })

  test("reads every page of the list, so nothing is behind a pager", async () => {
    const asked = intercept((url) => {
      if (url.includes("/pulls?q=")) {
        const page = new URL(url).searchParams.get("page")
        return page === "2"
          ? searchAnswer([aRow({ id: 42, number: 96114, title: "the second page" })], {
              currentPage: 2,
              totalPages: 2,
              totalCount: 2
            })
          : searchAnswer([aRow()], { currentPage: 1, totalPages: 2, totalCount: 2 })
      }
      if (url.includes("merge_box")) return new Response("nope", { status: 500 })
      return oneStranger(url)
    })

    const listed = await read()

    expect(asked.filter((url) => url.includes("/pulls?q="))).toHaveLength(2)
    expect(listed.sittings[0]?.count).toBe(2)
    // Every page is here, so there is no paging left to describe.
    expect(listed.pages).toEqual(Option.none())
  })

  test("stops reading pages at the cap, and says the list is cut rather than complete", async () => {
    // A repository with two thousand open pull requests is eighty pages. The cap is
    // what "safely" means: the list holds the first thousand, and the paging info is
    // kept so the screen can say how much of the whole this is.
    const asked = intercept((url) => {
      if (url.includes("/pulls?q=")) {
        return searchAnswer([aRow()], { currentPage: 1, totalPages: 80, totalCount: 1989 })
      }
      if (url.includes("merge_box")) return new Response("nope", { status: 500 })
      return oneStranger(url)
    })

    const listed = await read()

    expect(asked.filter((url) => url.includes("/pulls?q="))).toHaveLength(40)
    expect(listed.pages).toEqual(Option.some({ current: 1, total: 80, count: 1989 }))
  })

  test("refuses to show a repository whose list would not load", async () => {
    // Nothing rather than an empty list: a repository with two hundred open pull
    // requests and one whose search failed would otherwise be the same picture, and
    // the wrong one of the two is very reassuring.
    intercept((url) =>
      url.includes("/pulls?q=") ? new Response("nope", { status: 500 }) : oneStranger(url)
    )

    await expect(read()).rejects.toThrow()
  })

  test("shows the page anyway when the reader's shelves do not answer", async () => {
    // The difference from the Working Set, where a missing shelf hides work. Here the
    // shelves only say which rows are the reader's: losing them shows every row as
    // somebody else's, which is less useful and still the list that was asked for.
    intercept((url) =>
      url.includes("/pulls/inbox/queries")
        ? new Response("nope", { status: 500 })
        : oneStranger(url)
    )

    const listed = await read()

    expect(listed.sittings).toHaveLength(1)
    expect(listed.sittings[0]?.court).toBe("waiting")
  })

  test("shows the rows anyway when the check rollups do not arrive", async () => {
    intercept((url) =>
      url.includes("/pulls/inbox/deferred") ? new Response("nope", { status: 500 }) : oneStranger(url)
    )

    const listed = await read()

    expect(listed.sittings[0]?.count).toBe(1)
    expect(Option.isNone(listed.sittings[0]!.piles[0]!.one.checks)).toBe(true)
  })

  test("hands over the rows before it knows whose move they are", async () => {
    // The whole point of the staging. A repository with twenty-five open pull requests
    // is six rounds of branch reads away from a complete list and one read away from a
    // useful one, and the reader spent that difference looking at a skeleton.
    intercept((url) =>
      url.includes("filter=ready-to-merge")
        ? aShelf([aRow({ category: "READY_TO_MERGE" })])
        : oneStranger(url)
    )

    const stages: Array<Listed> = []
    const listed = await Effect.runPromise(
      loadRepoList(list, (stage) => stages.push(stage)).pipe(Effect.provide(layer))
    )

    // Whose move it is comes off the shelves, which the first stage has not waited for.
    expect(stages[0]?.sittings[0]?.court).toBe("waiting")
    expect(stages[0]?.sittings[0]?.count).toBe(1)
    expect(listed.sittings[0]?.court).toBe("needs-you")
  })

  test("reads how many lines each row changes", async () => {
    intercept(oneStranger);

    const listed = await read()

    expect(listed.sittings[0]?.piles[0]?.one.size).toEqual(
      Option.some({ added: 120, deleted: 8 })
    )
  })

  test("shows the rows anyway when a size cannot be read", async () => {
    // One row without a size is a row missing a column, which every row looked
    // like a second earlier. A page that refused to draw over it would be
    // withholding the list to protect a decoration on it.
    intercept((url) =>
      url.includes("/page_data/diffstat")
        ? new Response("nope", { status: 500 })
        : oneStranger(url)
    )

    const listed = await read()

    expect(listed.sittings[0]?.piles[0]?.one.size).toEqual(Option.none())
    expect(listed.sittings[0]?.count).toBe(1)
  })

  test("hands over the flat rows before the branches fold them into a stack", async () => {
    intercept((url) => {
      if (url.includes("/pulls?q=")) {
        return searchAnswer([aRow(), aRow({ id: 42, number: 96114, title: "the one above" })])
      }
      if (url.includes("merge_box")) return new Response("nope", { status: 500 })
      return oneStranger(url)
    })

    const stages: Array<Listed> = []
    await Effect.runPromise(
      loadRepoList(list, (stage) => stages.push(stage)).pipe(Effect.provide(layer))
    )

    // Four: the page, the shelves, the check rollups, then the sizes. The stacks
    // are the fifth and they are the returned value rather than a stage.
    expect(stages).toHaveLength(4)
    for (const stage of stages) expect(stage.sittings[0]?.piles).toHaveLength(2)
  })

  test("asks for branches where two pull requests could be stacked", async () => {
    // Every row of this page is in one repository, so unlike the Working Set every
    // row is a candidate and all of them get asked about.
    const asked = intercept((url) => {
      if (url.includes("/pulls?q=")) {
        return searchAnswer([aRow(), aRow({ id: 42, number: 96114, title: "the one above" })])
      }
      if (url.includes("merge_box")) return new Response("nope", { status: 500 })
      return oneStranger(url)
    })

    const listed = await read()

    // Distinct addresses rather than requests: a 500 is asked again, so counting
    // requests here would be counting the retry policy rather than the two rows.
    expect(new Set(asked.filter((url) => url.includes("merge_box"))).size).toBe(2)
    // And a branch read that failed leaves flat rows rather than an invented stack.
    expect(listed.sittings[0]?.piles).toHaveLength(2)
  })
})
