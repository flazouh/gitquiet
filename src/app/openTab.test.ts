import { describe, expect, test } from "bun:test"
import { isOpenTab, OPEN_TAB } from "./openTab"

describe("an ask to open a tab", () => {
  test("is the kind and a url", () => {
    expect(isOpenTab({ kind: OPEN_TAB, url: "https://github.com/flazouh/gitquiet/issues" })).toBe(
      true
    )
  })

  test("is not a message without either", () => {
    expect(isOpenTab({ kind: OPEN_TAB })).toBe(false)
    expect(isOpenTab({ url: "https://github.com" })).toBe(false)
    expect(isOpenTab(null)).toBe(false)
  })
})
