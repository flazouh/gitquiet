import { describe, expect, test } from "bun:test"

const styles = await Bun.file(new URL("./markdown.css", import.meta.url)).text()

describe("markdown layout", () => {
  test("defers top-level blocks outside a scroll viewport", () => {
    expect(styles).toContain(".markdown > :is(")
    expect(styles).toContain("content-visibility: auto")
    expect(styles).toContain("contain-intrinsic-size: auto 32px")
  })
})
