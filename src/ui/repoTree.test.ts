import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { Entry } from "../domain/repoHome"
import { agesOf, asPaths, fileUnder } from "./RepoTree"

const entry = (name: string, over: Partial<Entry> = {}): Entry => ({
  name,
  path: name,
  kind: "file",
  touched: Option.none(),
  ...over
})

describe("what the tree is given", () => {
  test("marks a directory with the trailing slash the tree reads folders by", () => {
    // Without it an empty directory in the root of a repository is drawn as a
    // file, which is the only signal the tree takes.
    const paths = asPaths([entry("src", { kind: "directory" }), entry("README.md")])

    expect(paths).toEqual(["src/", "README.md"])
  })

  test("keeps the order it was given, which is GitHub's reading order", () => {
    const paths = asPaths([
      entry("docs", { kind: "directory" }),
      entry("src", { kind: "directory" }),
      entry("bun.lock")
    ])

    expect(paths).toEqual(["docs/", "src/", "bun.lock"])
  })

  test("says when each entry last moved, for the lane beside the name", () => {
    const ages = agesOf([
      entry("README.md", {
        touched: Option.some({
          at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          said: "Say what this is for",
          url: "/o/r/commit/def"
        })
      })
    ])

    expect(ages.get("README.md")).toContain("3d")
  })

  test("says nothing for an entry the commit column has not reached", () => {
    // It arrives a quarter of a second behind the rows, and a row of dashes that
    // turns into a date is worse than a row that gains one.
    expect(agesOf([entry("README.md")]).has("README.md")).toBe(false)
  })
})

/** A row of the tree, as the pointer's composed path holds it. */
const row = (path: string, type: "file" | "folder"): HTMLElement => {
  const element = document.createElement("button")
  element.dataset.itemPath = path
  element.dataset.itemType = type
  return element
}

const over = (...path: ReadonlyArray<HTMLElement>): PointerEvent =>
  ({ composedPath: () => [...path, document.body] }) as unknown as PointerEvent

describe("the row the pointer is on", () => {
  test("names the file, so the press that follows costs nothing", () => {
    expect(fileUnder(over(row("src/main.ts", "file")))).toBe("src/main.ts")
  })

  test("names nothing for a folder, which the tree calls a folder", () => {
    // `data-item-type` is `folder` or `file` and never `directory`: read for the
    // other word, every folder the pointer crossed was fetched as though it were
    // a file, and the file the reader was actually heading for was not.
    expect(fileUnder(over(row("src/", "folder")))).toBe(null)
  })

  test("names nothing over the tree but off every row", () => {
    expect(fileUnder(over())).toBe(null)
  })
})
