import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gistOnPage } from "./gistView"

const html = readFileSync("tests/fixtures/gistView.html", "utf8")
const pageOf = (source: string): Document =>
  new DOMParser().parseFromString(source, "text/html")

const seen = (source: string = html) => gistOnPage(pageOf(source), "octocat", "aaa111")

describe("one gist, read out of their page", () => {
  test("reads its name, description and visibility", () => {
    expect(seen()).toMatchObject({
      owner: "octocat",
      id: "aaa111",
      title: "deploy-notes.md",
      description: "Notes on rolling out the staging environment",
      secret: true,
      updatedAt: "2026-08-27T00:09:42+02:00"
    })
  })

  test("does not read the date as the description", () => {
    // The head's other muted span is the "Last active" line, and a reader taking the
    // first muted span anywhere puts a date where the sentence goes.
    expect(seen()?.description).not.toContain("Last active")
  })

  test("reads every file, with the language they highlighted it as", () => {
    const files = seen()?.files ?? []

    expect(files.map((file) => file.name)).toEqual(["deploy-notes.md", "retry.py"])
    expect(files[0]?.language).toBe("markdown")
    expect(files[1]?.language).toBe("python")
  })

  test("tells a rendered file from a printed one", () => {
    // Prose and code are drawn differently, and reading the text of both and hoping is
    // how a markdown file lands in a monospace column with its heading markers showing.
    const files = seen()?.files ?? []

    expect(files[0]?.rendered).toBe(true)
    expect(files[1]?.rendered).toBe(false)
  })

  test("keeps the markup GitHub rendered, not only its text", () => {
    // Their `.markdown-body` is HTML they already made; its text is that HTML with every
    // heading and code block flattened into one run of words.
    const files = seen()?.files ?? []

    expect(files[0]?.html).toContain("<p>")
    expect(files[1]?.html).toBeNull()
  })

  test("reads each file's content and its raw link", () => {
    const files = seen()?.files ?? []

    expect(files[0]?.content).toContain("Run migrations before the deploy step")
    expect(files[1]?.content).toContain("exponential_backoff")
    expect(files[1]?.raw).toBe("/octocat/aaa111/raw/abc/retry.py")
  })

  test("reads every count their head prints", () => {
    expect(seen()).toMatchObject({ revisions: 4, forks: 6, stars: 4, comments: 2 })
  })

  test("counts nothing where their head prints no such link", () => {
    // Their head omits a count that is zero on some pages and prints it on others.
    const bare = html.replace(/<div class="gist-count-links">[\s\S]*?<\/div>/, "")

    expect(seen(bare)).toMatchObject({ revisions: 0, forks: 0, stars: 0, comments: 0 })
  })

  test("reads nothing at all from a page that has stopped looking like this", () => {
    // Empty rather than wrong: the screen hands the document back to GitHub, which is
    // the only honest answer to markup this no longer recognises.
    expect(gistOnPage(pageOf("<html><body><p>something else</p></body></html>"), "o", "i")).toBeNull()
    expect(gistOnPage(pageOf('<div class="gisthead"></div>'), "o", "i")).toBeNull()
  })
})
