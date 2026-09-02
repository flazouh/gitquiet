import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { loadFixture } from "../../tests/fixtures"
import { layer } from "../github/GitHubGateway"
import { loadWorkingSet } from "./workingSet"

/**
 * What reading a whole Working Set asks GitHub for, and what it does when one of
 * those reads fails.
 *
 * Driven through the real gateway with `fetch` intercepted, which is how the rest
 * of this codebase tests a read: the routes are part of the behaviour, and a
 * hand-written fake gateway would agree with whatever the code currently sends.
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
  id: "4153828483",
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
  updatedAt: "2026-07-28T19:43:33+02:00",
  headSha: "d34db33f",
  labels: [],
  assignees: [],
  ...over
})

const aShelf = (rows: ReadonlyArray<unknown>) =>
  json({ payload: { pullsInboxSurfaceContentRoute: { results: rows } } })

const noStandings = () => json({ payload: { pullsInboxSurfaceContentDeferredData: { results: [] } } })

/** One row on `needs-action` and nothing anywhere else, which is most Working Sets. */
const oneRow = (url: string): Response => {
  if (url.includes("filter=needs-action")) return aShelf([aRow()])
  if (url.includes("/pulls/inbox/queries")) return aShelf([])
  if (url.includes("/pulls/inbox/deferred")) return noStandings()
  return new Response("unexpected", { status: 404 })
}

const read = () => Effect.runPromise(loadWorkingSet().pipe(Effect.provide(layer)))

describe("reading the whole Working Set", () => {
  test("asks GitHub for every shelf it knows about", async () => {
    // Six requests, which is what their own dashboard makes. A shelf missed here
    // is a group of pull requests the reader never learns about.
    const asked = intercept(oneRow)

    await read()

    const shelves = asked.filter((url) => url.includes("/pulls/inbox/queries"))
    expect(shelves).toHaveLength(6)
    expect(shelves.some((url) => url.includes("filter=needs-action"))).toBe(true)
    expect(shelves.some((url) => url.includes("filter=merge-queue"))).toBe(true)
  })

  test("arranges what came back into Courts", async () => {
    intercept(oneRow)

    const sittings = await read()

    expect(sittings).toHaveLength(1)
    expect(sittings[0]?.court).toBe("needs-you")
    expect(sittings[0]?.count).toBe(1)
  })

  test("refuses to show part of a Working Set when a shelf does not answer", async () => {
    // The reader cannot tell a list missing rows from a complete one, and this is
    // the page they use to decide what to work on. Nothing rather than some.
    intercept((url) =>
      url.includes("filter=ready-to-merge")
        ? new Response("nope", { status: 500 })
        : oneRow(url)
    )

    await expect(read()).rejects.toThrow()
  })

  test("shows the rows anyway when the check rollups do not arrive", async () => {
    // Checks only ever add to a row that is already real. `Option.none()` on the
    // domain type already means not known, so a failed read is absence, not error.
    intercept((url) =>
      url.includes("/pulls/inbox/deferred") ? new Response("nope", { status: 500 }) : oneRow(url)
    )

    const sittings = await read()

    expect(sittings[0]?.count).toBe(1)
    expect(Option.isNone(sittings[0]!.piles[0]!.one.checks)).toBe(true)
  })

  test("does not ask for branches where no stack could exist", async () => {
    // A repository with one pull request in the Working Set has nothing to stack
    // it on, and each of these reads is a whole merge_box.
    const asked = intercept(oneRow)

    await read()

    expect(asked.filter((url) => url.includes("merge_box"))).toHaveLength(0)
  })

  test("asks for branches where two pull requests share a repository", async () => {
    const asked = intercept((url) => {
      if (url.includes("filter=needs-action")) {
        return aShelf([aRow(), aRow({ id: "42", number: 1458, title: "the one above" })])
      }
      if (url.includes("merge_box")) return new Response("nope", { status: 500 })
      return oneRow(url)
    })

    const sittings = await read()

    // Distinct addresses rather than requests: a 500 is asked again, so counting
    // requests here would be counting the retry policy rather than the two rows.
    expect(new Set(asked.filter((url) => url.includes("merge_box"))).size).toBe(2)
    // And a branch read that failed leaves flat rows rather than an invented stack.
    expect(sittings[0]?.piles).toHaveLength(2)
    expect(sittings[0]?.piles.every((pile) => pile.above.length === 0)).toBe(true)
  })
})

/**
 * The issues a reader is involved in, in the Courts beside the pull requests.
 *
 * "It took me 3 minutes to find my open issues when I expected those to be displayed in
 * the dashboard" is its own discussion, and a Court that is only the pull-request half of
 * what is owed is not a Court. Three queries rather than one, because `involves:@me`
 * throws away the reason a reader is involved and that reason is the Court.
 */
const withIssues = (url: string): Response => {
  // Their own answer, recorded: a hand-written row is a row that agrees with whatever this
  // code currently expects, and the shape of their search is the thing most likely to move.
  if (url.includes("/search?")) return json(loadFixture("involved-issues"))
  return oneRow(url)
}

describe("the Involved Issues on the dashboard", () => {
  test("asks their search once for each way a reader can be involved", async () => {
    const asked = intercept(withIssues)

    await read()

    const searches = asked.filter((url) => url.includes("/search?"))
    expect(searches).toHaveLength(3)
    expect(searches.some((url) => url.includes("assignee%3A%40me"))).toBe(true)
    expect(searches.some((url) => url.includes("author%3A%40me"))).toBe(true)
    expect(searches.some((url) => url.includes("mentions%3A%40me"))).toBe(true)
  })

  test("puts an issue in a Court beside the pull requests", async () => {
    intercept(withIssues)

    const sittings = await read()

    const held = sittings.flatMap((sitting) => sitting.issues)
    expect(held.some((one) => one.reference.number === 1267)).toBe(true)
  })

  test("still draws the pull requests when their issue search fails", async () => {
    // Additive, unlike a shelf: a Court holding pull requests and no issues is the page as
    // it was last month, and it is worth more than an empty screen.
    intercept((url) =>
      url.includes("/search?") ? new Response("nope", { status: 500 }) : oneRow(url)
    )

    const sittings = await read()

    expect(sittings).toHaveLength(1)
    expect(sittings[0]?.count).toBe(1)
  })
})
