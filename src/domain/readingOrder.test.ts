import { describe, expect, test } from "bun:test"
import { readingOrder } from "./readingOrder"

describe("the order files are likely to be read in", () => {
  const files = ["a", "b", "c", "d", "e"]

  test("goes forward from where the reader is, then back over what they passed", () => {
    expect(readingOrder(files, 2)).toEqual(["d", "e", "b", "a"])
  })

  test("leaves out the file already open", () => {
    expect(readingOrder(files, 0)).toEqual(["b", "c", "d", "e"])
  })

  test("has only the way back to offer at the end", () => {
    expect(readingOrder(files, 4)).toEqual(["d", "c", "b", "a"])
  })

  test("treats no selection as starting from the top", () => {
    expect(readingOrder(files, -1)).toEqual(["a", "b", "c", "d", "e"])
  })
})
