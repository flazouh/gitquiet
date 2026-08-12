import { describe, expect, test } from "bun:test"
import { sliceOf } from "./slice"

/**
 * Which rows of a long list are worth drawing, and the two spacers that keep the
 * scrollbar honest about the ones that are not.
 */
describe("the slice of a list worth drawing", () => {
  const tall = { row: 24, height: 480, spare: 4 }

  test("draws the whole list where nothing has been measured yet", () => {
    // Before the first layout, and in any test without one. A list drawn short
    // because it could not measure itself is a list with rows missing.
    const slice = sliceOf(1000, { row: 0, height: 0, top: 0 })

    expect(slice).toEqual({ from: 0, to: 1000, above: 0, below: 0 })
  })

  test("draws the rows the viewport covers, and a few above and below", () => {
    const slice = sliceOf(1000, { ...tall, top: 2400 })

    // 100 rows down, 20 rows of viewport, 4 spare each way.
    expect(slice.from).toBe(96)
    expect(slice.to).toBe(124)
  })

  test("keeps the scrollbar honest about the rows it left out", () => {
    const slice = sliceOf(1000, { ...tall, top: 2400 })

    expect(slice.above).toBe(96 * 24)
    expect(slice.above + (slice.to - slice.from) * 24 + slice.below).toBe(1000 * 24)
  })

  test("asks for nothing above the first row", () => {
    const slice = sliceOf(1000, { ...tall, top: 0 })

    expect(slice.from).toBe(0)
    expect(slice.above).toBe(0)
  })

  test("asks for nothing below the last row", () => {
    const slice = sliceOf(30, { ...tall, top: 240 })

    expect(slice.to).toBe(30)
    expect(slice.below).toBe(0)
  })

  /*
   * A folder closing takes rows away under a scroll position that was fine a
   * moment ago. Drawing from past the end would draw an empty list over a
   * scrollbar that still has somewhere to be.
   */
  test("draws the last rows where the list shrank under the scroll", () => {
    const slice = sliceOf(10, { ...tall, top: 9000 })

    expect(slice.to).toBe(10)
    expect(slice.from).toBeLessThan(10)
    expect(slice.below).toBe(0)
  })

  test("draws nothing for an empty list", () => {
    expect(sliceOf(0, { ...tall, top: 0 })).toEqual({ from: 0, to: 0, above: 0, below: 0 })
  })
})
