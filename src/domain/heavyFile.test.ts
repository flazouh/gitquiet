import { describe, expect, test } from "bun:test"
import { drawnWhenAsked, HEAVY_LINES } from "./heavyFile"

describe("a file drawn only when the reader asks", () => {
  test("is one whose changed lines run past what a press can draw at once", () => {
    expect(drawnWhenAsked({ linesAdded: 14193, linesDeleted: 0 })).toBe(true)
    expect(drawnWhenAsked({ linesAdded: 1200, linesDeleted: 1200 })).toBe(true)
  })

  test("is not one at the line, or one GitHub sent no counts for", () => {
    expect(drawnWhenAsked({ linesAdded: HEAVY_LINES, linesDeleted: 0 })).toBe(false)
    expect(drawnWhenAsked({ linesAdded: 0, linesDeleted: 0 })).toBe(false)
  })
})
