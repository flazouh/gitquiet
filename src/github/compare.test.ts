import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { changedInCompare } from "./compare"

const html = readFileSync("tests/fixtures/compareFileList.html", "utf8")
const pageOf = (source: string): Document =>
  new DOMParser().parseFromString(source, "text/html")

describe("what a comparison changed, read out of their fragment", () => {
  test("reads every file, and none of their Split and Unified rows", () => {
    const found = changedInCompare(pageOf(html))

    expect(found.map((one) => one.path)).toEqual([
      "src/domain/gist.ts",
      "plans/008-the-two-pages-left.md",
      "src/ui/gistSearch.ts"
    ])
  })

  test("reads both counts, including their own minus sign", () => {
    // Their minus is U+2212 and not a hyphen. A parser that only knew the hyphen read
    // every deletion as zero, which is a diff that looks like it only ever added.
    const [first] = changedInCompare(pageOf(html))

    expect(first).toMatchObject({ added: 82, deleted: 7 })
  })

  test("reads what happened to each file off the word their icon carries", () => {
    // That title is written for a screen reader, which makes it the one thing on the
    // row that says the kind out loud. Anything else here is reading a colour.
    expect(changedInCompare(pageOf(html)).map((one) => one.kind)).toEqual([
      "modified",
      "added",
      "removed"
    ])
  })

  test("keeps their anchor, so a reader can still reach GitHub's own diff of it", () => {
    expect(changedInCompare(pageOf(html))[0]?.anchor).toBe("#diff-aaa111")
  })

  test("reads the contents rather than the diff blocks below it", () => {
    // Their diff renders a handful of files and defers the rest: on the live
    // forty-one-file comparison this was written against, counting `.js-file` blocks
    // finds four.
    const withoutBlocks = html.replace(/<div id="diff">/, '<div id="diff"><div class="js-file"></div>')

    expect(changedInCompare(pageOf(withoutBlocks)).length).toBe(3)
  })

  test("comes back empty rather than wrong on markup it does not know", () => {
    expect(changedInCompare(pageOf("<html><body><p>something else</p></body></html>"))).toEqual([])
    expect(changedInCompare(pageOf('<div id="toc"><ul><li>Split</li></ul></div>'))).toEqual([])
  })
})
