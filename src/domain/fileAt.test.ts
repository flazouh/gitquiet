import { describe, expect, test } from "bun:test"
import { blameAt, blobAt, historyAt, rawAt, rawContentAt, type FileAt } from "./fileAt"

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
