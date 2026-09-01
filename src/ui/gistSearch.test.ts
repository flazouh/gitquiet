import { afterEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { GHOST_ID, plantGistSearch, reapplyGistSearch } from "./gistSearch"

const html = readFileSync("tests/fixtures/gistList.html", "utf8")
const pageOf = (source: string): Document => new DOMParser().parseFromString(source, "text/html")

afterEach(() => {
  document.body.innerHTML = ""
})

const typeInto = (page: Document, said: string): void => {
  const input = page.getElementById(GHOST_ID) as HTMLInputElement
  input.value = said
  input.dispatchEvent(new page.defaultView!.Event("input", { bubbles: true }))
}

const visibleTitles = (page: Document): ReadonlyArray<string> =>
  [...page.querySelectorAll(".gist-snippet")]
    .filter((row) => (row as HTMLElement).style.display !== "none")
    .map((row) => row.querySelector("strong.css-truncate-target")?.textContent?.trim() ?? "")

describe("the search bar over a reader's own gists", () => {
  test("shows every row before anything is typed", () => {
    const page = pageOf(html)
    plantGistSearch(page)

    expect(visibleTitles(page)).toEqual(["deploy-notes.md", "retry.py", "config.json"])
  })

  test("hides rows that do not match, on the title", () => {
    const page = pageOf(html)
    plantGistSearch(page)

    typeInto(page, "retry")

    expect(visibleTitles(page)).toEqual(["retry.py"])
  })

  test("matches on content GitHub's own search does not read", () => {
    const page = pageOf(html)
    plantGistSearch(page)

    typeInto(page, "exponential_backoff")

    expect(visibleTitles(page)).toEqual(["retry.py"])
  })

  test("matches on the description", () => {
    const page = pageOf(html)
    plantGistSearch(page)

    typeInto(page, "staging")

    expect(visibleTitles(page)).toEqual(["deploy-notes.md"])
  })

  test("shows every row again once the query is cleared", () => {
    const page = pageOf(html)
    plantGistSearch(page)

    typeInto(page, "retry")
    typeInto(page, "")

    expect(visibleTitles(page)).toEqual(["deploy-notes.md", "retry.py", "config.json"])
  })

  test("is planted once, not stacked on a second call", () => {
    const page = pageOf(html)
    plantGistSearch(page)
    plantGistSearch(page)

    expect(page.querySelectorAll(`#${GHOST_ID}`).length).toBe(1)
  })

  test("plants nothing on a page with no gist rows", () => {
    const page = pageOf("<html><body><p>Empty</p></body></html>")
    plantGistSearch(page)

    expect(page.getElementById(GHOST_ID)).toBeNull()
  })

  test("matches on the extra text a caller supplies, for a Label GitHub does not carry", () => {
    const page = pageOf(html)
    plantGistSearch(page, (id) => (id === "bbb222" ? "backoff-strategy" : ""))

    typeInto(page, "backoff-strategy")

    expect(visibleTitles(page)).toEqual(["retry.py"])
  })

  test("re-runs the search already typed, against fresh extra text", () => {
    const page = pageOf(html)
    let label = ""
    plantGistSearch(page, (id) => (id === "bbb222" ? label : ""))

    typeInto(page, "backoff-strategy")
    expect(visibleTitles(page)).toEqual([])

    label = "backoff-strategy"
    reapplyGistSearch(page, (id) => (id === "bbb222" ? label : ""))

    expect(visibleTitles(page)).toEqual(["retry.py"])
  })

  test("does nothing on reapply where nothing has been typed", () => {
    const page = pageOf(html)
    plantGistSearch(page)

    reapplyGistSearch(page, () => "")

    expect(visibleTitles(page)).toEqual(["deploy-notes.md", "retry.py", "config.json"])
  })
})
