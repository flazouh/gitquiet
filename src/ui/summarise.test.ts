import { describe, expect, test } from "bun:test"
import { summarise } from "./summarise"

describe("naming a comment by what it says", () => {
  test("skips the machine-readable preamble review bots hide at the top", () => {
    // Every comment from the review bots on a real pull request starts with one
    // of these, and a list full of `<!-- devin-review-comment {"id":` says
    // nothing about any of them.
    expect(summarise('<!-- devin-review-comment {"id": "ANALYSIS"} -->\nThe width is off by one.')).toBe(
      "The width is off by one."
    )
  })

  test("skips a heading marker to the words after it", () => {
    expect(summarise("### Truncation\n\nThe marker disappears.")).toBe("Truncation")
  })

  test("reads the words rather than the markdown around them", () => {
    expect(summarise("- **`options`** is [wired](http://x) wrong")).toBe("options is wired wrong")
  })

  test("falls back to saying nothing rather than to punctuation", () => {
    expect(summarise("<!-- only a marker -->")).toBe("")
  })

  test("cuts a long line rather than letting it push everything else off", () => {
    const long = summarise("x".repeat(200))

    expect(long).toHaveLength(90)
    expect(long.endsWith("…")).toBe(true)
  })
})
