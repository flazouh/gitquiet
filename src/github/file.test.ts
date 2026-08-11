import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import code from "../../fixtures/github/blob-code.json"
import markdown from "../../fixtures/github/blob-markdown.json"
import { decodeBlob, openedFrom } from "./file"

const read = (given: unknown, path: string) =>
  openedFrom(Effect.runSync(decodeBlob(given)), path)

describe("one file of a repository, read out of their page", () => {
  test("gives back the file a line at a time, as they sent it", () => {
    const opened = read(code, "package.json")

    expect(opened.path).toBe("package.json")
    expect(opened.lines[0]).toBe("{")
    expect(opened.lines[1]).toBe('  "private": true,')
  })

  test("has nothing rendered for a file GitHub does not render", () => {
    expect(Option.isNone(read(code, "package.json").rendered)).toBe(true)
  })

  test("keeps their rendering of a markdown file, which is what the README pane draws", () => {
    const opened = read(markdown, "README.md")

    expect(Option.getOrThrow(opened.rendered).startsWith("<article")).toBe(true)
  })

  test("keeps the source of a markdown file too, so it can be read as what it says", () => {
    expect(read(markdown, "README.md").lines.length).toBeGreaterThan(0)
  })
})
