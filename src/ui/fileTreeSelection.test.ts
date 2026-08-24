import { describe, expect, test } from "bun:test"
import {
  paintFileTreeMarks,
  paintFileTreeSelection,
  paintOrScrollFileTreeSelection
} from "./fileTreeSelection"

describe("file tree selection paint", () => {
  test("moves the visible selection without rebuilding the tree", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <button data-type="item" data-item-path="one" data-item-selected="true" aria-selected="true" tabindex="0"></button>
      <button data-type="item" data-item-path="two" aria-selected="false" tabindex="-1"></button>
    `
    const one = root.querySelector<HTMLElement>('[data-item-path="one"]')!
    const two = root.querySelector<HTMLElement>('[data-item-path="two"]')!

    expect(paintFileTreeSelection(root, "two")).toBe(two)
    expect(one?.getAttribute("data-item-selected")).toBeNull()
    expect(one?.getAttribute("aria-selected")).toBe("false")
    expect(one?.tabIndex).toBe(-1)
    expect(two?.getAttribute("data-item-selected")).toBe("true")
    expect(two?.getAttribute("aria-selected")).toBe("true")
    expect(two?.tabIndex).toBe(0)
  })

  test("keeps the current row when the wanted row is not mounted", () => {
    const root = document.createElement("div")
    root.innerHTML = `<button data-type="item" data-item-path="one" data-item-selected="true" aria-selected="true"></button>`
    const one = root.querySelector("button")

    expect(paintFileTreeSelection(root, "two")).toBeNull()
    expect(one?.getAttribute("data-item-selected")).toBe("true")
    expect(one?.getAttribute("aria-selected")).toBe("true")
  })

  test("does not ask the virtual tree to scroll when the row is mounted", () => {
    const root = document.createElement("div")
    root.innerHTML = '<button data-type="item" data-item-path="one"></button>'
    const scroll = () => {
      throw new Error("mounted rows do not need a virtual scroll")
    }

    expect(paintOrScrollFileTreeSelection(root, "one", scroll)).toBe(false)
  })

  test("scrolls without moving focus when the row is not mounted", () => {
    const root = document.createElement("div")
    const calls: Array<readonly [string, { readonly focus: false }]> = []

    expect(
      paintOrScrollFileTreeSelection(root, "two", (path, options) => calls.push([path, options]))
    ).toBe(true)
    expect(calls).toEqual([["two", { focus: false }]])
  })

  test("updates a mounted row mark without rebuilding the tree", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <button data-type="item" data-item-path="one">
        <div data-item-section="decoration"><span title="+2 −1"><span>+2</span></span></div>
      </button>
    `
    const row = root.querySelector<HTMLElement>('[data-item-path="one"]')!

    paintFileTreeMarks(root, new Map([["one", { added: 2, deleted: 1, seen: true }]]), {
      counts: true,
      ticks: true
    })

    const mark = row.querySelector<HTMLElement>('[data-item-section="decoration"] > span')!
    expect(mark.title).toBe("+2 −1, seen")
    expect(mark.textContent).toBe("✓ +2 −1")
    expect(paintFileTreeMarks(root, new Map([["one", { added: 2, deleted: 1, seen: true }]]), {
      counts: true,
      ticks: true
    })).toBe(0)
  })
})
