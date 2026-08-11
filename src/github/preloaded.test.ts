import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { preloadedIn } from "./preloaded"

const script = (said: unknown) =>
  `<script type="application/json" data-target="react-app.embeddedData">${JSON.stringify(said)}</script>`

/** A page rendered from the queries named, in the shape GitHub writes them. */
const page = (...queries: ReadonlyArray<{ name: string; hash?: string; result?: unknown }>) =>
  script({
    payload: {
      preloadedQueries: queries.map((one) => ({
        queryId: one.hash,
        queryName: one.name,
        variables: { number: 37178 },
        result: one.result
      }))
    }
  })

const found = (html: string, name: string) => Option.getOrNull(preloadedIn(html, name))

describe("the answer GitHub already wrote into the page", () => {
  test("hands back the hash and the whole result together", () => {
    /*
     * Both halves matter and for different reasons. The result is this issue,
     * which is what the reader is waiting for; the hash is every issue after it,
     * which can go by the cheap route once this page has taught it.
     */
    const html = page({
      name: "IssueViewerViewQuery",
      hash: "16d22ec92e42cba436de5c76d5b5d94e",
      result: { data: { repository: { issue: { number: 37178 } } } }
    })

    expect(found(html, "IssueViewerViewQuery")).toEqual({
      hash: "16d22ec92e42cba436de5c76d5b5d94e",
      result: { data: { repository: { issue: { number: 37178 } } } }
    })
  })

  test("picks its own query out of the several a page is rendered from", () => {
    // An issue page carries three, and the other two describe the timeline
    // underneath it rather than the issue.
    const html = page(
      { name: "IssueViewerSecondaryViewQuery", hash: "aaa", result: { data: {} } },
      { name: "IssueViewerViewQuery", hash: "bbb", result: { data: { repository: {} } } }
    )

    expect(found(html, "IssueViewerViewQuery")?.hash).toBe("bbb")
  })

  test("says nothing where the page was not rendered from that query at all", () => {
    const html = page({ name: "IssueIndexPageQuery", hash: "aaa", result: {} })
    expect(found(html, "IssueViewerViewQuery")).toBeNull()
  })

  test("says nothing where the entry names a query and answers nothing", () => {
    // Their own rendering has a deferred form, where the entry is written before
    // the answer is. Reading that as an answer decodes an issue with no fields.
    const html = page({ name: "IssueViewerViewQuery", hash: "bbb" })
    expect(found(html, "IssueViewerViewQuery")).toBeNull()
  })

  test("says nothing where the page holds no embedded payload", () => {
    expect(found("<html><body>signed out</body></html>", "IssueViewerViewQuery")).toBeNull()
  })
})
