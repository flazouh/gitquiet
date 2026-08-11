import { describe, expect, test } from "bun:test"
import { stepping } from "./stepping"

describe("stepping through a list that has no ends", () => {
  test("moves one along, in either direction", () => {
    expect(stepping(4, 1, 1)).toBe(2)
    expect(stepping(4, 1, -1)).toBe(0)
  })

  test("comes back round to the first after the last", () => {
    expect(stepping(4, 3, 1)).toBe(0)
  })

  test("goes round to the last from the first", () => {
    expect(stepping(4, 0, -1)).toBe(3)
  })

  test("stays where it is when there is only one of them", () => {
    expect(stepping(1, 0, 1)).toBe(0)
    expect(stepping(1, 0, -1)).toBe(0)
  })

  test("has nowhere to go in an empty list, and says so", () => {
    // An index no list has, so a caller reading straight out of theirs finds
    // nothing there rather than the last item.
    expect(stepping(0, 0, 1)).toBe(-1)
  })
})
