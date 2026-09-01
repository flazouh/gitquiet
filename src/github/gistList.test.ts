import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { rowsOnPage } from "./gistList"

const html = readFileSync("tests/fixtures/gistList.html", "utf8")
const pageOf = (source: string): Document => new DOMParser().parseFromString(source, "text/html")

describe("a reader's own gist list, read out of their page", () => {
  test("reads every row", () => {
    expect(rowsOnPage(pageOf(html)).length).toBe(3)
  })

  test("reads a secret gist's title, owner, id and visibility", () => {
    const [first] = rowsOnPage(pageOf(html))

    expect(first).toMatchObject({
      id: "aaa111",
      owner: "octocat",
      title: "deploy-notes.md",
      secret: true
    })
  })

  test("reads the description where one is written", () => {
    const [first] = rowsOnPage(pageOf(html))

    expect(first?.description).toBe("Notes on rolling out the staging environment")
  })

  test("reads a gist with no description as having none", () => {
    const [, second] = rowsOnPage(pageOf(html))

    expect(second?.description).toBeNull()
  })

  test("reads the content GitHub already rendered into the row, markdown or code alike", () => {
    const [first, second] = rowsOnPage(pageOf(html))

    expect(first?.preview).toContain("Run migrations before the deploy step")
    expect(second?.preview).toContain("exponential_backoff")
  })

  test("reads every file's preview on a multi-file gist", () => {
    const [, , third] = rowsOnPage(pageOf(html))

    expect(third?.preview).toContain("dark")
    expect(third?.preview).toContain("Widget config")
  })

  test("reads the updated time off GitHub's own relative-time element", () => {
    const [first] = rowsOnPage(pageOf(html))

    expect(first?.updatedAt).toBe("2026-08-27T00:09:42+02:00")
  })

  test("reads a public gist as not secret", () => {
    const [, second] = rowsOnPage(pageOf(html))

    expect(second?.secret).toBe(false)
  })

  test("reads nothing off a page with no gist rows", () => {
    expect(rowsOnPage(pageOf("<html><body><p>Empty</p></body></html>")).length).toBe(0)
  })
})
