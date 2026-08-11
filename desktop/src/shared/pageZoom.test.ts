import { describe, expect, test } from "bun:test"
import { nextPageZoom, pageZoomFromPress } from "./pageZoom"

describe("nextPageZoom", () => {
  test("steps in by a tenth", () => {
    expect(nextPageZoom(1, "in")).toBe(1.1)
  })

  test("steps out by a tenth", () => {
    expect(nextPageZoom(1, "out")).toBe(0.9)
  })

  test("resets to 100%", () => {
    expect(nextPageZoom(1.5, "reset")).toBe(1)
  })

  test("does not go below half", () => {
    expect(nextPageZoom(0.5, "out")).toBe(0.5)
  })

  test("does not go above triple", () => {
    expect(nextPageZoom(3, "in")).toBe(3)
  })

  test("rounds away float drift", () => {
    expect(nextPageZoom(1.1, "in")).toBe(1.2)
  })
})

describe("pageZoomFromPress", () => {
  test("Cmd+= and Cmd++ zoom in", () => {
    expect(pageZoomFromPress({ key: "=", meta: true })).toBe("in")
    expect(pageZoomFromPress({ key: "+", meta: true })).toBe("in")
    expect(pageZoomFromPress({ key: "Add", ctrl: true })).toBe("in")
  })

  test("Cmd+- zooms out", () => {
    expect(pageZoomFromPress({ key: "-", meta: true })).toBe("out")
    expect(pageZoomFromPress({ key: "_", meta: true })).toBe("out")
    expect(pageZoomFromPress({ key: "Subtract", ctrl: true })).toBe("out")
  })

  test("Cmd+0 resets", () => {
    expect(pageZoomFromPress({ key: "0", meta: true })).toBe("reset")
    expect(pageZoomFromPress({ key: "Digit0", ctrl: true })).toBe("reset")
  })

  test("ignores presses without Command or Control", () => {
    expect(pageZoomFromPress({ key: "=" })).toBeNull()
    expect(pageZoomFromPress({ key: "-", alt: true })).toBeNull()
  })

  test("ignores unrelated chords", () => {
    expect(pageZoomFromPress({ key: "k", meta: true })).toBeNull()
  })
})
