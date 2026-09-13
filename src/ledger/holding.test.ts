import { describe, expect, test } from "bun:test"
import { heldIn, holdIn, holdingOf } from "./holding"

describe("how many Ledgers a document holds", () => {
  test("holds more than one, so moving between repositories is free", () => {
    const holding = holdingOf<number>()

    holdIn(holding, "one/a@x", 1, 3)
    holdIn(holding, "two/b@y", 2, 3)

    expect(heldIn(holding, "one/a@x")).toBe(1)
    expect(heldIn(holding, "two/b@y")).toBe(2)
  })

  test("lets go of the one asked for longest ago", () => {
    const holding = holdingOf<number>()

    holdIn(holding, "a", 1, 2)
    holdIn(holding, "b", 2, 2)
    holdIn(holding, "c", 3, 2)

    expect(heldIn(holding, "a")).toBeUndefined()
    expect(heldIn(holding, "b")).toBe(2)
    expect(heldIn(holding, "c")).toBe(3)
  })

  test("counts being asked for as being used, not only being put in", () => {
    const holding = holdingOf<number>()

    holdIn(holding, "a", 1, 2)
    holdIn(holding, "b", 2, 2)
    // `a` again: it is the one being read, so `b` is now the stale one.
    heldIn(holding, "a")
    holdIn(holding, "c", 3, 2)

    expect(heldIn(holding, "a")).toBe(1)
    expect(heldIn(holding, "b")).toBeUndefined()
  })

  test("replaces rather than doubles, where the same one is put in twice", () => {
    const holding = holdingOf<number>()

    holdIn(holding, "a", 1, 2)
    holdIn(holding, "a", 2, 2)

    expect(holding.size).toBe(1)
    expect(heldIn(holding, "a")).toBe(2)
  })
})
