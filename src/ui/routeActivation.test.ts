import { beforeEach, describe, expect, test } from "bun:test"
import { prepareRouteActivation } from "./routeActivation"

beforeEach(() => {
  document.body.replaceChildren()
})

describe("prepared route activation", () => {

  test("reveals a prepared file panel in bounded stages", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <div data-gitquiet-activation="files-panel">
        <div data-gitquiet-activation="files-tree"></div>
        <div data-gitquiet-activation="files-content">
          <div data-file="one.md" aria-hidden="false">
            <div data-gitquiet-prose-runs>
              ${Array.from({ length: 10 }, (_, at) => `<div data-run="${at}"></div>`).join("")}
            </div>
          </div>
        </div>
      </div>
    `
    const queued: Array<() => void> = []
    const activation = prepareRouteActivation(root, (work) => queued.push(work))
    const panel = root.querySelector<HTMLElement>('[data-gitquiet-activation="files-panel"]')!
    const tree = root.querySelector<HTMLElement>('[data-gitquiet-activation="files-tree"]')!
    const content = root.querySelector<HTMLElement>('[data-gitquiet-activation="files-content"]')!
    const drawing = root.querySelector<HTMLElement>('[data-file][aria-hidden="false"]')!
    const runs = [...root.querySelectorAll<HTMLElement>("[data-run]")]

    expect(panel.style.contentVisibility).toBe("hidden")
    expect(tree.hidden).toBe(true)
    expect(content.hidden).toBe(true)
    expect(drawing.hidden).toBe(true)
    expect(runs.map((run) => run.hidden)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true
    ])

    activation.start()
    expect(queued).toHaveLength(1)

    queued.shift()?.()
    expect(panel.style.contentVisibility).toBe("")
    expect(tree.hidden).toBe(true)

    queued.shift()?.()
    expect(tree.hidden).toBe(false)
    expect(content.hidden).toBe(true)

    queued.shift()?.()
    expect(content.hidden).toBe(false)
    expect(drawing.hidden).toBe(true)

    queued.shift()?.()
    expect(drawing.hidden).toBe(false)
    expect(runs.filter((run) => run.hidden)).toHaveLength(9)

    queued.shift()?.()
    expect(runs.filter((run) => run.hidden)).toHaveLength(8)

    for (let at = 0; at < 8; at += 1) queued.shift()?.()
    expect(runs.some((run) => run.hidden)).toBe(false)
  })

  test("does nothing when a prepared route has no file panel", () => {
    const root = document.createElement("div")
    const queued: Array<() => void> = []

    prepareRouteActivation(root, (work) => queued.push(work)).start()

    expect(queued).toHaveLength(0)
  })

  test("reveals cached list sections one task at a time", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <div data-gitquiet-activation="list">
        <div data-gitquiet-activation="list-section"></div>
        <div data-gitquiet-activation="list-section"></div>
      </div>
    `
    const queued: Array<() => void> = []
    const sections = [
      ...root.querySelectorAll<HTMLElement>('[data-gitquiet-activation="list-section"]')
    ]
    const activation = prepareRouteActivation(root, (work) => queued.push(work))
    const list = root.querySelector<HTMLElement>('[data-gitquiet-activation="list"]')!

    expect(list.hidden).toBe(true)
    expect(sections.map((section) => section.hidden)).toEqual([true, true])

    activation.start()
    queued.shift()?.()
    expect(list.hidden).toBe(false)
    expect(sections.map((section) => section.hidden)).toEqual([true, true])

    queued.shift()?.()
    expect(sections.map((section) => section.hidden)).toEqual([false, true])

    queued.shift()?.()
    expect(sections.map((section) => section.hidden)).toEqual([false, false])
  })
})
