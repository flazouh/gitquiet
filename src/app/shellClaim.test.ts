import { describe, expect, test } from "bun:test"
import { claimShell } from "./shellClaim"

describe("the one route shell in a document", () => {
  test("accepts the first start and refuses another", () => {
    const page = document.implementation.createHTMLDocument("GitHub")

    expect(claimShell(page)).toBe(true)
    expect(claimShell(page)).toBe(false)
  })
})
