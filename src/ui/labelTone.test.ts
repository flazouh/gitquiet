import { describe, expect, test } from "bun:test"
import { toneOf } from "./labelTone"

describe("a label's colour", () => {
  test("is the same every time the same word is drawn", () => {
    // The whole worth of the dot: `bug` in one repository looking like `bug` in the next.
    expect(toneOf("bug")).toBe(toneOf("bug"))
  })

  test("tells two words apart", () => {
    expect(toneOf("bug")).not.toBe(toneOf("enhancement"))
    // Anagrams too, which a plain sum of letters would have painted identically.
    expect(toneOf("bug")).not.toBe(toneOf("gub"))
  })

  test("stays at one lightness, so a row of them is quiet", () => {
    const words = ["bug", "enhancement", "agent:claude-code", "p2", "ready-for-agent", "rust"]

    for (const word of words) {
      expect(toneOf(word)).toMatch(/^hsl\(\d{1,3} 52% 62%\)$/)
    }
  })
})
