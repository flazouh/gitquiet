import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import { type Box, gapTo, NEAR, useNearby, withinReach } from "./near"

afterEach(cleanup)

const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom
})

describe("how far the pointer is", () => {
  test("is nothing at all inside the box", () => {
    expect(gapTo(box(0, 0, 100, 20), { x: 50, y: 10 })).toBe(0)
  })

  test("measures straight up, down and sideways", () => {
    expect(gapTo(box(0, 0, 100, 20), { x: 130, y: 10 })).toBe(30)
    expect(gapTo(box(0, 0, 100, 20), { x: 50, y: 45 })).toBe(25)
  })

  test("measures the diagonal from a corner, not the larger of the two", () => {
    expect(gapTo(box(0, 0, 100, 20), { x: 103, y: 24 })).toBe(5)
  })

  test("picks out only the boxes within reach", () => {
    const boxes = [
      ["near", box(0, 0, 10, 10)],
      ["far", box(0, 500, 10, 510)]
    ] as const

    expect(withinReach(boxes, { x: 5, y: 40 }, 40)).toEqual(["near"])
  })
})

/** jsdom lays nothing out, so every rect a test needs is stated outright. */
const layOut = (rects: Record<string, DOMRect | Box>) => {
  const original = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const key = this.getAttribute(NEAR) ?? this.getAttribute("data-box") ?? ""
    const found = rects[key] ?? box(0, 0, 0, 0)
    return { ...found, width: 0, height: 0, x: found.left, y: found.top, toJSON: () => "" } as DOMRect
  }
  return () => {
    Element.prototype.getBoundingClientRect = original
  }
}

const move = (x: number, y: number) => {
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y }))
}

const List = ({ onNear, within }: { onNear: (key: string) => void; within?: number }) => {
  const ref = useNearby({ onNear, within })
  return (
    <div ref={ref} data-box="list">
      <button type="button" {...{ [NEAR]: "one" }}>
        one
      </button>
      <button type="button" {...{ [NEAR]: "two" }}>
        two
      </button>
    </div>
  )
}

describe("warming what the pointer is heading for", () => {
  test("says nothing while the pointer is elsewhere on the page", async () => {
    const restore = layOut({ list: box(0, 0, 100, 60), one: box(0, 0, 100, 30) })
    const warmed: Array<string> = []
    render(<List onNear={(key) => warmed.push(key)} />)

    move(800, 800)
    await waitFor(() => expect(warmed).toEqual([]))

    restore()
  })

  test("announces a row once the pointer is close to it, and only once", async () => {
    const restore = layOut({
      list: box(0, 0, 100, 60),
      one: box(0, 0, 100, 30),
      two: box(0, 30, 100, 60)
    })
    const warmed: Array<string> = []
    render(<List onNear={(key) => warmed.push(key)} within={20} />)

    move(50, 45)
    await waitFor(() => expect(warmed).toContain("two"))

    move(50, 46)
    move(50, 47)
    await waitFor(() => expect(warmed.filter((key) => key === "two")).toHaveLength(1))

    restore()
  })

  test("reaches the row above before the pointer is over it", async () => {
    const restore = layOut({
      list: box(0, 0, 100, 60),
      one: box(0, 0, 100, 30),
      two: box(0, 30, 100, 60)
    })
    const warmed: Array<string> = []
    render(<List onNear={(key) => warmed.push(key)} within={40} />)

    // Sitting on the second row, within forty pixels of the first.
    move(50, 45)
    await waitFor(() => expect(warmed.sort()).toEqual(["one", "two"]))

    restore()
  })
})
