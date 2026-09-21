import { describe, expect, test } from "bun:test"
import { byPath, manifestOf, stillToRead, whollyKnown, type Named } from "./keeping"

/**
 * What a second visit to a repository costs, decided without reading anything.
 */

const file = (path: string, sha: string, text = "x"): Named => ({ path, sha, text })

describe("which files still have to be read", () => {
  test("is none of them, where a commit changed nothing", () => {
    const files = [file("a.ts", "aaa"), file("b.ts", "bbb")]

    expect(stillToRead(files, new Set(["aaa", "bbb"]))).toEqual([])
  })

  test("is the files a push touched, and no others", () => {
    const files = [file("a.ts", "aaa"), file("b.ts", "BBB"), file("c.ts", "ccc")]

    expect(stillToRead(files, new Set(["aaa", "ccc"])).map((one) => one.path)).toEqual(["b.ts"])
  })

  test("reads one file once, however many paths hold it", () => {
    // A vendored copy, a fork of a file, a licence in four folders. The key is
    // the contents, so two paths naming the same contents are one question.
    const files = [file("a/licence", "same"), file("b/licence", "same")]

    expect(stillToRead(files, new Set())).toHaveLength(1)
  })
})

describe("whether a commit can be answered off disk alone", () => {
  const manifest = manifestOf("one/two@abc", [file("a.ts", "aaa"), file("b.ts", "bbb")], 1)

  test("can, where every path's contents are known", () => {
    expect(whollyKnown(manifest, new Map([["aaa", 1], ["bbb", 2]]))).toBe(true)
  })

  test("cannot, where one is missing — which is the one about to be asked for", () => {
    expect(whollyKnown(manifest, new Map([["aaa", 1]]))).toBe(false)
  })

  test("puts the paths back together with what each one says", () => {
    const found = byPath(manifest, new Map([["aaa", "first"], ["bbb", "second"]]))

    expect([...found]).toEqual([
      ["a.ts", "first"],
      ["b.ts", "second"]
    ])
  })
})

describe("what a commit held", () => {
  test("is a path and a name per file, and when it was read", () => {
    const manifest = manifestOf("one/two@abc", [file("a.ts", "aaa")], 1234)

    expect(manifest).toEqual({ at: "one/two@abc", files: [["a.ts", "aaa"]], seen: 1234 })
  })

  test("and the Go modules it declares, which no parsed file carries", () => {
    // A Ledger back off disk has what its files say and never read a `go.mod`.
    const manifest = manifestOf("one/two@abc", [file("a.go", "aaa")], 1, new Map([["github.com/one/two", ""]]))

    expect(manifest.goModules).toEqual([["github.com/one/two", ""]])
  })
})
