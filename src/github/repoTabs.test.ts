import { describe, expect, test } from "bun:test"
import { isKeptTabs, tabsOnPage } from "./repoTabs"

/**
 * A repository's tabs, read out of the document GitHub serves for its front page.
 *
 * Read here rather than off the row in the live page, which is the whole point: their row is
 * inside the header their React hydrates, so a bar drawn before that lands had nothing to
 * show but the two tabs an address can promise. This read belongs to us, is kept, and is
 * warmed before a press, so the bar opens with the repository's real tabs on it.
 */

/** Their row as it comes, counts and the screen-reader copy of them included. */
const page = (row: string) => `<!doctype html><html><body>
  <header class="GlobalNav">
    <nav aria-label="Repository" data-view-component="true">${row}</nav>
  </header>
</body></html>`

const theRow = `
  <a href="/flowline-labs/flowline" aria-current="page"><span>Code</span></a>
  <a href="/flowline-labs/flowline/issues">Issues<span class="CounterLabel-x">195</span><span class="VisuallyHidden-y"> (195)</span></a>
  <a href="/flowline-labs/flowline/pulls">Pull requests<span class="CounterLabel-x">9</span><span class="VisuallyHidden-y"> (9)</span></a>
  <a href="/flowline-labs/flowline/discussions">Discussions</a>
  <a href="/flowline-labs/flowline/network/dependencies">Insights</a>
`

describe("a repository's tabs, out of their own document", () => {
  test("reads every tab in the order they put them in", () => {
    expect(tabsOnPage(page(theRow)).map((one) => one.name)).toEqual([
      "Code",
      "Issues",
      "Pull requests",
      "Discussions",
      "Insights"
    ])
  })

  test("reads the counts, which are the part an address cannot guess", () => {
    const tabs = tabsOnPage(page(theRow))

    expect(tabs.find((one) => one.name === "Issues")?.count).toBe(195)
    expect(tabs.find((one) => one.name === "Pull requests")?.count).toBe(9)
    expect(tabs.find((one) => one.name === "Discussions")?.count).toBeUndefined()
  })

  /*
   * Insights is at `/network/dependencies` and nowhere near `/insights`, which is the second
   * reason this is read rather than written out as a list of names and addresses.
   */
  test("reads each address as they wrote it", () => {
    const insights = tabsOnPage(page(theRow)).find((one) => one.name === "Insights")

    expect(insights?.href).toBe("/flowline-labs/flowline/network/dependencies")
  })

  test("says nothing at all about a document with no row of theirs in it", () => {
    expect(tabsOnPage("<!doctype html><html><body><p>nothing here</p></body></html>")).toEqual([])
  })

  /*
   * A repository with Issues switched off has no Issues tab, which is why the bar cannot name
   * one from the address. `octo-org/octo-repo` is such a repository.
   */
  test("has no Issues where the repository has none", () => {
    const off = `
      <a href="/octo-org/octo-repo" aria-current="page">Code</a>
      <a href="/octo-org/octo-repo/pulls">Pull requests<span class="CounterLabel-x">46</span></a>
    `

    expect(tabsOnPage(page(off)).map((one) => one.name)).toEqual(["Code", "Pull requests"])
  })

  test("knows an entry written by an older version of this extension when it sees one", () => {
    expect(isKeptTabs([{ name: "Code", href: "/a/b", here: true }])).toBe(true)
    expect(isKeptTabs([{ name: "Code" }])).toBe(false)
    expect(isKeptTabs("Code")).toBe(false)
  })
})
