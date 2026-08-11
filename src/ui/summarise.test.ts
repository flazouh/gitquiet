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

  test("says a screenshot in the words it was given, not as the tag it is", () => {
    // A comment that is one image is an `img` tag, from their box and from this one.
    const said = summarise('<img width="1600" height="900" alt="login error" src="https://x/1" />')

    expect(said).toBe("login error")
  })

  test("calls a picture nobody described a picture", () => {
    // What their own box writes every time, alt and all.
    expect(summarise('<img width="8" height="8" alt="Image" src="https://x/1" />')).toBe("Image")
    expect(summarise('<img src="https://x/1">')).toBe("Image")
  })

  test("reads the words around a picture rather than the tag between them", () => {
    expect(summarise('Before <img alt="a shot" src="https://x/1" /> after')).toBe(
      "Before a shot after"
    )
  })

  test("cuts a long line rather than letting it push everything else off", () => {
    const long = summarise("x".repeat(200))

    expect(long).toHaveLength(90)
    expect(long.endsWith("…")).toBe(true)
  })
})
