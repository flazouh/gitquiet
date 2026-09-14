import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { DEFAULT_SPOT, type Settings, type Spot } from "@/domain/Settings"
import { forgetful } from "@/app/settings"
import type { Store } from "@/ports/Settings"
import { WAY_BACK_ID } from "@/ui/wayBack"
import { forgetTheSpot, handOverToGitHub } from "./handOver"

const REVEALED = "data-gitquiet-revealed"
const GATING = "data-gitquiet-gating"

/**
 * A page of GitHub's with our gate up, which is what a screen hands over from.
 *
 * The live document, for the reason `wayBack.test.ts` gives: the widget is positioned
 * against a window, and a document built with `createHTMLDocument` has none.
 */
const gatedPage = (): Document => {
  document.documentElement.setAttribute(GATING, "")
  document.documentElement.removeAttribute(REVEALED)
  document.body.innerHTML = '<div id="repo-content-pjax-container"></div>'
  return document
}

const widget = () => document.getElementById(WAY_BACK_ID)
const gripIn = () => document.getElementById("gitquiet-way-back-grip")!
const leftOf = (): number => Number.parseFloat((widget() as HTMLElement).style.left)

const ran = <A>(effect: Effect.Effect<A>): Promise<A> => Effect.runPromise(effect)

/** Long enough for a write nobody awaited to have reached the store. */
const settled = (): Promise<void> => new Promise((done) => setTimeout(done, 10))

const drag = (to: readonly [number, number]): void => {
  gripIn().dispatchEvent(new PointerEvent("pointerdown", { clientX: 40, clientY: 40, bubbles: true }))
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: to[0], clientY: to[1], bubbles: true }))
  window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))
}

const opened: Array<() => void> = []
const handOver = (store: Store, spot: Spot = DEFAULT_SPOT, takeBack: () => void = () => {}) => {
  const close = handOverToGitHub(store, document, spot, takeBack)
  opened.push(close)
  return close
}

/*
 * The live document is one document for the whole suite, and the dropped place outlives
 * any one call. Both have to be put back, or the next file starts on a page this one
 * left behind. See the same note in `wayBack.test.ts`.
 */
afterEach(() => {
  for (const close of opened.splice(0)) close()
  forgetTheSpot()
  document.getElementById(WAY_BACK_ID)?.remove()
  document.body.innerHTML = ""
  document.documentElement.removeAttribute(REVEALED)
  document.documentElement.removeAttribute(GATING)
})

describe("handing a page to GitHub", () => {
  test("lets their own page through", () => {
    gatedPage()

    handOver(forgetful())

    expect(document.documentElement.hasAttribute(REVEALED)).toBe(true)
    expect(document.documentElement.hasAttribute(GATING)).toBe(false)
  })

  test("puts the way back on it in the same breath", () => {
    // The whole reason both halves are in one function. Twenty screens revealed and
    // four of them offered anything to press, which is how sixteen pages became doors
    // that only opened one way.
    gatedPage()

    handOver(forgetful())

    expect(widget()).not.toBeNull()
  })

  test("takes it off again when the screen withdraws it", () => {
    gatedPage()

    handOver(forgetful())()

    expect(widget()).toBeNull()
  })

  test("tells the screen when the mark is pressed", () => {
    gatedPage()
    let asked = 0

    handOver(forgetful(), DEFAULT_SPOT, () => {
      asked += 1
    })
    document
      .querySelector(`#${WAY_BACK_ID} button:not(#gitquiet-way-back-grip)`)!
      .dispatchEvent(new PointerEvent("click", { bubbles: true }))

    expect(asked).toBe(1)
  })
})

describe("where the widget is put back", () => {
  test("is what the screen read out of storage, until the reader moves it", () => {
    gatedPage()

    handOver(forgetful(), { x: 0, y: 0 })

    expect(leftOf()).toBe(16)
  })

  test("is written down when the reader drops it", async () => {
    const store = forgetful()
    gatedPage()

    handOver(store, { x: 0, y: 0 })
    drag([300, 200])
    await settled()

    const held: Settings = await ran(store.read)
    expect(held.wayBack.x).toBeGreaterThan(0)
  })

  test("is where they dropped it on the next hand-over, not where the screen read", async () => {
    /*
     * The bug this exists for. A screen reads the stored place once when it starts, so
     * a screen holding only that copy re-plants the widget where it was an hour ago:
     * drag it, walk to another page without a reload, and it jumps back to the corner
     * you moved it out of. The stale spot is handed in below on purpose.
     */
    const store = forgetful()
    gatedPage()

    handOver(store, { x: 0, y: 0 })
    drag([300, 200])
    const moved = leftOf()
    opened.pop()!()

    handOver(store, { x: 0, y: 0 })

    expect(leftOf()).toBe(moved)
  })

  test("is the screen's own answer again once the document is forgotten", () => {
    // A reload is a new document, and what a new document knows is what was stored.
    const store = forgetful()
    gatedPage()

    handOver(store, { x: 0, y: 0 })
    drag([300, 200])
    opened.pop()!()
    forgetTheSpot()

    handOver(store, { x: 0, y: 0 })

    expect(leftOf()).toBe(16)
  })
})
