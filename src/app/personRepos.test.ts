import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { layer } from "../github/GitHubGateway"
import { personPageIn } from "../domain/person"
import { AT_MOST, theirFirstPage, theirOtherPages } from "./personRepos"

const real = await Bun.file("tests/fixtures/personRepos.html").text()
const last = await Bun.file("tests/fixtures/personReposArchived.html").text()

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

const html = (body: string): Response =>
  new Response(body, { headers: { "content-type": "text/html" } })

const page = Option.getOrThrow(personPageIn("https://github.com/flazouh?tab=repositories"))

const document_ = (markup: string): Document =>
  new DOMParser().parseFromString(markup, "text/html")

describe("the page the screen is standing on", () => {
  test("costs no request at all", () => {
    // Their tab is Rails-rendered, so thirty rows are in the document before any
    // script runs. This is the whole reason this screen paints at once.
    const asked = intercept(() => html("nothing should be asked"))

    const first = theirFirstPage(document_(real))

    expect(first.rows).toHaveLength(30)
    expect(first.more).toBe(true)
    expect(asked).toEqual([])
  })

  test("is nothing at all on a document that is not one of theirs", () => {
    // An organisation reaches this: their address is one segment, exactly as a
    // person's is. An empty listing is what makes the screen hand the page back.
    const first = theirFirstPage(document_("<!doctype html><body><main>an organisation"))

    expect(first.rows).toEqual([])
    expect(first.more).toBe(false)
  })
})

describe("the pages behind it", () => {
  test("asks for page two onwards, with the address's own narrowing", async () => {
    const asked = intercept((url) => html(url.includes("page=2") ? last : real))

    await Effect.runPromise(theirOtherPages(page).pipe(Effect.provide(layer)))

    expect(asked[0]).toContain("tab=repositories")
    expect(asked[0]).toContain("page=2")
  })

  test("stops where their pager stops", async () => {
    // The archived fixture is their last page: four rows and no Next link.
    intercept((url) => html(url.includes("page=2") ? last : real))

    const rest = await Effect.runPromise(theirOtherPages(page).pipe(Effect.provide(layer)))

    expect(rest.rows).toHaveLength(4)
    expect(rest.more).toBe(false)
  })

  test("reads one page at a time rather than all of them at once", async () => {
    // Five documents of a third of a megabyte, asked for together, is the kind of
    // thing GitHub answers with a 429 — which costs the reader the whole list.
    const asked = intercept(() => html(real))

    await Effect.runPromise(theirOtherPages(page, 4).pipe(Effect.provide(layer)))

    expect(asked).toHaveLength(3)
    expect(asked[1]).toContain("page=3")
    expect(asked[2]).toContain("page=4")
  })

  test("says so when it stopped at the cap rather than at the end", async () => {
    intercept(() => html(real))

    const rest = await Effect.runPromise(theirOtherPages(page, 3).pipe(Effect.provide(layer)))

    expect(rest.more).toBe(true)
    expect(rest.rows).toHaveLength(60)
  })

  test("keeps what it read when a page fails", async () => {
    // Four pages of five is a group count that is nearly right. Nothing is a list
    // with no groups at all.
    intercept((url) => (url.includes("page=3") ? new Response("no", { status: 500 }) : html(real)))

    const rest = await Effect.runPromise(theirOtherPages(page).pipe(Effect.provide(layer)))

    expect(rest.rows).toHaveLength(30)
    expect(rest.more).toBe(false)
  })

  test("reads at most ten pages, which is three hundred repositories", () => {
    expect(AT_MOST).toBe(10)
  })
})
