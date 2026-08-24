import { describe, expect, test } from "bun:test"

const styles = await Bun.file(new URL("./markdown.css", import.meta.url)).text()

describe("markdown layout", () => {
  test("does not defer top-level blocks inside a cached file", () => {
    expect(styles).toContain(".markdown {")
    expect(styles).not.toContain("content-visibility: auto")
    expect(styles).not.toContain("contain-intrinsic-size: auto 32px")
  })
})
