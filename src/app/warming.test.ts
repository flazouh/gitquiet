import { describe, expect, test } from "bun:test"
import { warmingFor } from "./warming"

/**
 * The coverage, page by page, and the two rules that keep it honest.
 *
 * A screen whose address warms nothing opens cold, and nobody finds out until a reader
 * waits for it: the reads behind these pages are between one request and half a megabyte
 * of markup. So the table is asserted one address per screen rather than by testing the
 * branch that happens to be new.
 */

const HERE = "https://github.com/flazouh/gitquiet/pull/1"

const warming = (href: string, at: string = HERE) => warmingFor(href, at)

describe("what resting on a link reads", () => {
  const pages: ReadonlyArray<readonly [string, string, string]> = [
    ["a pull request", "https://github.com/oven-sh/bun/pull/36915", "oven-sh/bun/36915"],
    ["their dashboard", "https://github.com/pulls", "/pulls"],
    ["their inbox, which is the same list", "https://github.com/pulls/inbox", "/pulls"],
    ["Home, which is also the same list", "https://github.com/", "/pulls"],
    [
      "a repository's pull requests",
      "https://github.com/oven-sh/bun/pulls",
      "/oven-sh/bun/pulls"
    ],
    [
      "a repository's issues",
      "https://github.com/oven-sh/bun/issues",
      "/oven-sh/bun/issues"
    ],
    ["one issue", "https://github.com/oven-sh/bun/issues/24680", "/oven-sh/bun/issues/24680"],
    ["the reader's own issues", "https://github.com/issues", "/issues"],
    ["the reader's inbox", "https://github.com/notifications", "/notifications"],
    [
      // A different inbox, and a different memory: their own nav offers several of these.
      "one question asked of the inbox",
      "https://github.com/notifications?query=is%3Aunread",
      "/notifications?query=is%3Aunread"
    ],
    ["a repository's front page", "https://github.com/oven-sh/bun", "/oven-sh/bun"],
    ["a repository's Actions tab", "https://github.com/oven-sh/bun/actions", "/oven-sh/bun/actions"],
    [
      "one run of it",
      "https://github.com/oven-sh/bun/actions/runs/30866145080",
      "/oven-sh/bun/actions/runs/30866145080"
    ],
    ["a branch's history", "https://github.com/oven-sh/bun/commits/main", "/oven-sh/bun/commits/main"],
    [
      "one commit",
      "https://github.com/oven-sh/bun/commit/9f2c1d4e5a6b7c8d9e0f1a2b3c4d5e6f70819293",
      "/oven-sh/bun/commit/9f2c1d4e5a6b7c8d9e0f1a2b3c4d5e6f70819293"
    ]
  ]

  for (const [what, href, key] of pages) {
    test(`reads ${what}`, () => {
      expect(warming(href)?.key).toBe(key)
    })
  }

  /*
   * The other half of the coverage above. A table that answered for anything would pass
   * every test in this file while reading the wrong page for half of them.
   */
  test("reads nothing about a page of GitHub's that no screen of ours draws", () => {
    expect(warming("https://github.com/settings/profile")).toBeNull()
    // Their subscriptions page, which lists threads rather than Notices and has no screen.
    expect(warming("https://github.com/notifications/subscriptions")).toBeNull()
    expect(warming("https://github.com/oven-sh/bun/issues/new")).toBeNull()
  })

  test("reads nothing on another host, this being every page of the web", () => {
    expect(warming("https://gitlab.com/oven-sh/bun/pull/1")).toBeNull()
  })

  test("reads nothing about the page already open, which is reading itself", () => {
    expect(warming(HERE)).toBeNull()
  })

  /*
   * The address moves without a document, so the page being read is the one the address
   * names now. Held from the start, this declined a press back to the layer of a stack the
   * reader arrived on and handed it to a router that drops about every other one.
   */
  test("reads a pull request the reader has moved off, rather than declining it", () => {
    const arrived = "https://github.com/flazouh/gitquiet/pull/1"

    expect(warming(arrived, "https://github.com/flazouh/gitquiet/pull/2")?.key).toBe(
      "flazouh/gitquiet/1"
    )
  })

  /*
   * Each page of a busy list is a different list, and so is each filter. A key that
   * stopped at the path would read page one and call every page after it already read.
   */
  test("counts the page and the filter as part of which list a list is", () => {
    const second = warming("https://github.com/oven-sh/bun/pulls?page=2")
    const filtered = warming("https://github.com/oven-sh/bun/pulls?q=is%3Aopen+author%3Ame")

    expect(second?.key).toBe("/oven-sh/bun/pulls?page=2")
    expect(filtered?.key).toBe("/oven-sh/bun/pulls?q=is%3Aopen+author%3Ame")
    expect(second?.key).not.toBe(filtered?.key)
  })
})
