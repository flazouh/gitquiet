import { describe, expect, test } from "bun:test"
import { blameAt, blobAt, historyAt, quoting, rawAt, rawContentAt, type FileAt } from "./fileAt"

const at = (over: Partial<FileAt> = {}): FileAt => ({
  owner: "flowline-labs",
  repo: "flowline",
  on: "main",
  path: "src/ui/Field.tsx",
  ...over
})

describe("the other pages of a file", () => {
  test("writes the history as a file's commits, which this interface leaves to GitHub", () => {
    expect(historyAt(at())).toBe("/flowline-labs/flowline/commits/main/src/ui/Field.tsx")
  })

  test("writes the raw route on github.com, so a private repository can still be read", () => {
    expect(rawAt(at())).toBe("/flowline-labs/flowline/raw/main/src/ui/Field.tsx")
  })

  test("writes the raw user content host, which is the address a script or an image wants", () => {
    expect(rawContentAt(at())).toBe(
      "https://raw.githubusercontent.com/flowline-labs/flowline/main/src/ui/Field.tsx"
    )
  })

  test("writes the blame of the same path", () => {
    expect(blameAt(at())).toBe("/flowline-labs/flowline/blame/main/src/ui/Field.tsx")
  })

  test("writes the file at a sha, which is the permalink their menu copies", () => {
    expect(blobAt(at({ on: "abc123" }))).toBe(
      "/flowline-labs/flowline/blob/abc123/src/ui/Field.tsx"
    )
  })

  /*
   * The one address in this file that is whole rather than a path, because it
   * goes inside a comment: GitHub renders such a link as a box naming the file,
   * the line and the commit, with the code quoted under it. Verified on
   * `flazouh/ghpro-scratch#14`, 2 September 2026.
   */
  describe("quoting a file into something said about the pull request", () => {
    test("writes the whole address, since a path alone is not a link anybody can follow", () => {
      expect(quoting(at({ on: "abc123" }))).toBe(
        "https://github.com/flowline-labs/flowline/blob/abc123/src/ui/Field.tsx"
      )
    })

    test("names one line the way GitHub's own permalink does", () => {
      expect(quoting(at({ on: "abc123" }), { from: 120, to: 120 })).toBe(
        "https://github.com/flowline-labs/flowline/blob/abc123/src/ui/Field.tsx#L120"
      )
    })

    test("names a run of lines with both ends", () => {
      expect(quoting(at({ on: "abc123" }), { from: 120, to: 124 })).toBe(
        "https://github.com/flowline-labs/flowline/blob/abc123/src/ui/Field.tsx#L120-L124"
      )
    })

    test("reads a run written backwards the way it was meant", () => {
      expect(quoting(at({ on: "abc123" }), { from: 124, to: 120 })).toBe(
        "https://github.com/flowline-labs/flowline/blob/abc123/src/ui/Field.tsx#L120-L124"
      )
    })

    test("escapes the path the same way the other addresses do", () => {
      expect(quoting(at({ on: "abc123", path: "docs/a b#c.md" }), { from: 2, to: 2 })).toBe(
        "https://github.com/flowline-labs/flowline/blob/abc123/docs/a%20b%23c.md#L2"
      )
    })
  })

  test("encodes a space or a hash in the path, and leaves the slashes", () => {
    expect(rawAt(at({ path: "docs/a b#c.md" }))).toBe(
      "/flowline-labs/flowline/raw/main/docs/a%20b%23c.md"
    )
  })

  test("keeps a slash in the branch, which is how their own route writes one", () => {
    expect(rawContentAt(at({ on: "feat/x" }))).toBe(
      "https://raw.githubusercontent.com/flowline-labs/flowline/feat/x/src/ui/Field.tsx"
    )
  })
})
