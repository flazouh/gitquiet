import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { DEFAULT_SPOT, type Settings, type Spot } from "@/domain/Settings"
import { forgetful } from "@/app/settings"
import type { Store } from "@/ports/Settings"
import { WAY_BACK_ID } from "@/ui/wayBack"
import {
  aScreen,
  forgetTheSpot,
  handOverToGitHub,
  leaveTheirPages,
  takeTheWayBack,
  theSpotWas,
  withdrawTheWayBack
} from "./handOver"

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

/** The screen under test, where a test does not care which screen it is. */
const screen = aScreen("a-screen")

/** Another one, still listening, standing for a page the reader is not on. */
const stale = aScreen("another-screen")

const handOver = (
  store: Store,
  spot: Spot = DEFAULT_SPOT,
  takeBack: () => void = () => {},
  who = screen
): void => {
  theSpotWas(spot)
  handOverToGitHub(store, document, who, takeBack)
}

/*
 * The live document is one document for the whole suite, and the dropped place outlives
 * any one call. Both have to be put back, or the next file starts on a page this one
 * left behind. See the same note in `wayBack.test.ts`.
 */
afterEach(() => {
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

    handOver(forgetful())
    withdrawTheWayBack(screen)

    expect(widget()).toBeNull()
  })

  test("stands one widget, not one per hand-over", () => {
    /*
     * There is one widget on a document. Handing the withdraw back to the screen meant
     * every screen kept its own, and a screen arriving where another had left one had
     * no way to reach it.
     */
    gatedPage()

    handOver(forgetful())
    handOver(forgetful())

    expect(document.querySelectorAll(`#${WAY_BACK_ID}`)).toHaveLength(1)
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
    withdrawTheWayBack(screen)

    handOver(store, { x: 0, y: 0 })

    expect(leftOf()).toBe(moved)
  })

  test("is the screen's own answer again once the document is forgotten", () => {
    // A reload is a new document, and what a new document knows is what was stored.
    const store = forgetful()
    gatedPage()

    handOver(store, { x: 0, y: 0 })
    drag([300, 200])
    withdrawTheWayBack(screen)
    forgetTheSpot()

    handOver(store, { x: 0, y: 0 })

    expect(leftOf()).toBe(16)
  })
})

describe("leaving a page this screen does not manage", () => {
  test("takes the way back off it", async () => {
    /*
     * The bug this exists for. A screen watches the address for as long as its document
     * lives, so a turbo navigation off its own pages runs its `show` again and takes the
     * early exit. Sixteen screens handed the page back there and left the widget up: it
     * stands on `documentElement`, which the navigation did not replace, so a green mark
     * stayed over a page the screen no longer manages, wired to a press that would run
     * that same screen and take that same exit. A door drawn on a wall.
     */
    gatedPage()

    handOver(forgetful())
    leaveTheirPages(document, screen)

    expect(widget()).toBeNull()
  })

  test("lets their page through on the way out", () => {
    gatedPage()

    handOver(forgetful())
    leaveTheirPages(document, screen)

    expect(document.documentElement.hasAttribute(REVEALED)).toBe(true)
  })

  test("is safe on a page that never handed anything over", () => {
    gatedPage()

    expect(() => leaveTheirPages(document, screen)).not.toThrow()
  })
})

describe("taking the way back", () => {
  test("writes the choice down", async () => {
    const store = forgetful()
    gatedPage()

    handOver(store)
    takeTheWayBack(store, document, screen)
    await settled()

    const held: Settings = await ran(store.read)
    expect(held.page.view).toBe("ours")
  })

  test("takes the widget off, because this screen is about to stand where it was", () => {
    gatedPage()

    handOver(forgetful())
    takeTheWayBack(forgetful(), document, screen)

    expect(widget()).toBeNull()
  })

  test("gates their page again before ours is drawn", () => {
    gatedPage()

    handOver(forgetful())
    takeTheWayBack(forgetful(), document, screen)

    expect(document.documentElement.hasAttribute(GATING)).toBe(true)
    expect(document.documentElement.hasAttribute(REVEALED)).toBe(false)
  })
})

describe("whose way back it is", () => {
  /*
   * Screens are not one to a document. A screen starts once and then watches the
   * address for as long as the document lives, and nothing stops it, so half a dozen
   * of them answer every soft navigation in the order they started. Each one runs its
   * own `show`, and most of those runs are about a page that screen does not manage.
   *
   * So a withdraw that took down whatever was up would let the wrong screen remove the
   * mark the right one has just planted: the reader is on GitHub's page, the widget is
   * gone, and nothing puts it back before a reload. The same stranding the widget was
   * written to prevent, reached from the other side.
   */
  test("survives a screen that is somewhere else calling its own withdraw", () => {
    gatedPage()

    handOver(forgetful())
    withdrawTheWayBack(stale)

    expect(widget()).not.toBeNull()
  })

  test("survives that screen leaving pages it does not manage", () => {
    gatedPage()

    handOver(forgetful())
    leaveTheirPages(document, stale)

    expect(widget()).not.toBeNull()
  })

  test("still comes down for the screen that put it up", () => {
    gatedPage()

    handOver(forgetful())
    withdrawTheWayBack(stale)
    withdrawTheWayBack(screen)

    expect(widget()).toBeNull()
  })

  test("belongs to whoever put it up last", () => {
    // A hand-over replaces what is up, owner and all, so the screen that has just
    // planted one can take it down and the screen it replaced cannot.
    gatedPage()

    handOver(forgetful())
    handOver(forgetful(), DEFAULT_SPOT, () => {}, stale)
    withdrawTheWayBack(screen)

    expect(widget()).not.toBeNull()
  })
})
