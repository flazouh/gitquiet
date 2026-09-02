import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { readOwnGists } from "./ownGists"

const html = readFileSync("tests/fixtures/gistList.html", "utf8")
const pageOf = (source: string): Document =>
  new DOMParser().parseFromString(source, "text/html")

/** Their list, with the "Older" link pointed wherever a test wants it, or removed. */
const listing = (older: string | null): string =>
  older === null
    ? html.replace(/<div class="paginate-container">[\s\S]*?<\/div>\s*<\/div>/, "")
    : html.replace('href="https://gist.github.com/octocat?page=2"', `href="${older}"`)

const asked: Array<string> = []
const serving = (pages: Record<string, string>) => (address: string) => {
  asked.push(address)
  const found = pages[address]
  return found === undefined
    ? Effect.fail(new Error(`nothing at ${address}`))
    : Effect.succeed(pageOf(found))
}

describe("reading every page of a reader's own gists", () => {
  test("keeps the page in front of the reader without asking for it again", async () => {
    asked.length = 0
    const found = await Effect.runPromise(
      readOwnGists(pageOf(listing(null)), serving({}))
    )

    expect(asked).toEqual([])
    expect(found.rows.length).toBe(3)
    expect(found.whole).toBe(true)
  })

  test("follows their Older link until it stops, and joins every page", async () => {
    asked.length = 0
    const found = await Effect.runPromise(
      readOwnGists(
        pageOf(listing("/octocat?page=2")),
        serving({ "/octocat?page=2": listing(null) })
      )
    )

    expect(asked).toEqual(["/octocat?page=2"])
    // Three on the page the reader is on, three more on the page behind it.
    expect(found.rows.length).toBe(6)
    expect(found.whole).toBe(true)
  })

  test("keeps what it read when a page fails, and says the list is not whole", async () => {
    // Half a list a reader can search beats a failure over a list GitHub already drew.
    asked.length = 0
    const found = await Effect.runPromise(
      readOwnGists(pageOf(listing("/octocat?page=2")), serving({}))
    )

    expect(found.rows.length).toBe(3)
    expect(found.whole).toBe(false)
  })

  test("stops at a depth rather than walking a pager that never ends", async () => {
    // A pager that answers "Older" forever is a walk against their server with no end.
    asked.length = 0
    const looping = listing("/octocat?page=2")
    const found = await Effect.runPromise(
      readOwnGists(pageOf(looping), serving({ "/octocat?page=2": looping }))
    )

    expect(asked.length).toBe(29)
    expect(found.whole).toBe(false)
  })
})
