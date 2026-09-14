import { afterEach, describe, expect, test } from "bun:test"
import { DEFAULT_SPOT, readSpot, type Spot } from "@/domain/Settings"
import { GRIP_ID, offerOurPage, WAY_BACK_ID } from "./wayBack"

/**
 * A page of GitHub's with nothing of ours on it, which is the only page this widget is
 * ever drawn on.
 *
 * The live document rather than one built with `createHTMLDocument`, which is what the
 * rest of this folder's DOM tests use. A document made that way has no `defaultView`,
 * and this widget is positioned against the window: how wide it is, how far the pointer
 * moved, and where the edges are. A page with no window is a page this cannot be drawn
 * on at all, so a test on one would be a test of the refusal.
 */
const githubPage = (): Document => {
  document.body.innerHTML = '<div id="repo-content-pjax-container"><h1>Pull requests</h1></div>'
  return document
}

const widgetIn = (page: Document) => page.getElementById(WAY_BACK_ID)
const gripIn = (page: Document) => page.getElementById(GRIP_ID)!
const markIn = (page: Document) => page.querySelector(`#${WAY_BACK_ID} button:not(#${GRIP_ID})`)!

const shown = (element: Element): boolean =>
  (element.getAttribute("style") ?? "").includes("opacity: 1")

const leftOf = (page: Document): number =>
  Number.parseFloat((widgetIn(page) as HTMLElement).style.left)
const topOf = (page: Document): number =>
  Number.parseFloat((widgetIn(page) as HTMLElement).style.top)

const hover = (element: Element): void => {
  element.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }))
}
const unhover = (element: Element): void => {
  element.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }))
}

/** Longer than the grace the grip waits out before it fades. */
const rested = (): Promise<void> => new Promise((wake) => setTimeout(wake, 220))

/**
 * A drag, in the three events one is made of.
 *
 * The move and the release go to the window rather than to the grip, because that is
 * where the widget listens for them: a pointer moving faster than the element follows
 * leaves the grip behind, and a drag that only heard its own element would stop the
 * moment it did.
 */
type At = readonly [number, number]

const drag = (page: Document, from: At, to: At): void => {
  gripIn(page).dispatchEvent(
    new PointerEvent("pointerdown", { clientX: from[0], clientY: from[1], bubbles: true })
  )
  page.defaultView!.dispatchEvent(
    new PointerEvent("pointermove", { clientX: to[0], clientY: to[1], bubbles: true })
  )
  page.defaultView!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))
}

/** Every widget a test planted, taken off again so the next test starts on a bare page. */
const opened: Array<() => void> = []
const offer = (
  page: Document,
  onChoose: () => void = () => {},
  spot?: Spot,
  onMoved?: (spot: Spot) => void
) => {
  const close = offerOurPage(page, onChoose, spot, onMoved)
  opened.push(close)
  return close
}

/*
 * The live document is one document for the whole suite, so what these tests put on it
 * has to come off again. Left there, the body one of these wrote is the body every file
 * that runs after this one starts from, and a query bound to it finds a page of GitHub's
 * where its own fixture should be. Measured: nineteen tests in five other files failed
 * on a `repo-content-pjax-container` this file had left behind.
 */
afterEach(() => {
  for (const close of opened.splice(0)) close()
  document.getElementById(WAY_BACK_ID)?.remove()
  document.body.innerHTML = ""
})

describe("the way back, on a page this interface has been turned off on", () => {
  test("stands on the document itself, not inside the body GitHub replaces", () => {
    // A turbo visit swaps `body` wholesale. Standing in it means being thrown away by
    // a navigation that never loaded a document, on a page with nothing else of ours
    // to notice and put it back.
    const page = githubPage()

    offer(page)

    expect(widgetIn(page)!.parentElement).toBe(page.documentElement)
  })

  test("carries the gitquiet mark, so it is recognisable before it is read", () => {
    const page = githubPage()

    offer(page)

    expect(markIn(page).querySelector("svg")).not.toBeNull()
    expect(markIn(page).getAttribute("aria-label")).toContain("gitquiet")
  })

  test("is marked as ours, so a takeover does not hide it as part of their page", () => {
    const page = githubPage()

    offer(page)

    expect(widgetIn(page)!.hasAttribute("data-gitquiet-outside")).toBe(true)
  })

  test("turns the interface back on when the mark is pressed", () => {
    const page = githubPage()
    let asked = 0

    offer(page, () => {
      asked += 1
    })
    markIn(page).dispatchEvent(new PointerEvent("click", { bubbles: true }))

    expect(asked).toBe(1)
  })

  test("comes off, and stops listening, when it is withdrawn", () => {
    const page = githubPage()

    const close = offer(page)
    close()

    expect(widgetIn(page)).toBeNull()

    // The observer that puts it back must be off as well, or withdrawing it plants it
    // again on the next change anywhere in the document.
    page.body.append(page.createElement("div"))
    expect(widgetIn(page)).toBeNull()
  })

  test("is put back when something sweeps it off the page", () => {
    const page = githubPage()

    offer(page)
    widgetIn(page)!.remove()
    // The observer is asynchronous, so this is what the browser does a microtask later.
    page.documentElement.append(page.createElement("div"))

    return Promise.resolve().then(() => {
      expect(widgetIn(page)).not.toBeNull()
      expect(page.querySelectorAll(`#${WAY_BACK_ID}`).length).toBe(1)
    })
  })
})

describe("the grip", () => {
  test("is out of sight until the pointer is over the widget", () => {
    const page = githubPage()

    offer(page)

    expect(shown(gripIn(page))).toBe(false)
  })

  test("appears when the pointer is on the mark, and goes when it leaves", async () => {
    const page = githubPage()

    offer(page)
    hover(markIn(page))
    expect(shown(gripIn(page))).toBe(true)

    unhover(markIn(page))
    await rested()
    expect(shown(gripIn(page))).toBe(false)
  })

  test("stays up while the pointer crosses the gap from the mark to it", async () => {
    // The four pixels between the two are four pixels the pointer is on neither. Hidden
    // on that frame the grip stops taking presses as well, so the hand that was just
    // shown a handle reaches for it and finds nothing. Measured in Chrome before the
    // wait was there: hovering the widget never revealed a grip that could be grabbed.
    const page = githubPage()

    offer(page)
    hover(markIn(page))
    unhover(markIn(page))
    hover(gripIn(page))
    await rested()

    expect(shown(gripIn(page))).toBe(true)
  })

  test("does not swallow presses on the page above the mark", async () => {
    // The box is taller than the mark so the grip can live inside it. The part the grip
    // is not filling is somebody's page, and a way back has no business catching a press
    // meant for what is underneath it.
    const page = githubPage()

    offer(page)

    expect((widgetIn(page) as HTMLElement).style.pointerEvents).toBe("none")
    expect((markIn(page) as HTMLElement).style.pointerEvents).toBe("auto")
  })

  test("stays in the tree while it is out of sight, so the keyboard can still reach it", () => {
    // Removed instead of faded, it would be a control that only exists for a pointer.
    const page = githubPage()

    offer(page)

    expect(gripIn(page)).not.toBeNull()
    expect(gripIn(page).getAttribute("aria-label")).toBe("Move this control")
  })

  test("stays visible for the whole of a drag, even once the pointer has left", () => {
    // A pointer dragged quickly outruns the element and fires `pointerleave` on the
    // way. A grip that vanished then would read as the widget having been dropped.
    const page = githubPage()

    offer(page)
    hover(markIn(page))
    gripIn(page).dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 100, bubbles: true })
    )
    unhover(markIn(page))

    expect(shown(gripIn(page))).toBe(true)
  })
})

describe("moving it", () => {
  test("follows the pointer", () => {
    const page = githubPage()
    const before = { left: 0, top: 0 }

    offer(page, () => {}, { x: 0, y: 0 })
    before.left = leftOf(page)
    before.top = topOf(page)
    drag(page, [20, 20], [120, 90])

    expect(leftOf(page)).toBe(before.left + 100)
    expect(topOf(page)).toBe(before.top + 70)
  })

  test("tells the caller where it was left, once, when the drag ends", () => {
    const page = githubPage()
    const left: Array<Spot> = []

    offer(page, () => {}, { x: 0, y: 0 }, (spot) => left.push(spot))
    drag(page, [20, 20], [120, 90])

    expect(left.length).toBe(1)
    expect(left[0]!.x).toBeGreaterThan(0)
    expect(left[0]!.y).toBeGreaterThan(0)
  })

  test("says nothing while the pointer is still down", () => {
    // A write a frame is two hundred writes for one drag, and storage is synced.
    const page = githubPage()
    const left: Array<Spot> = []

    offer(page, () => {}, { x: 0, y: 0 }, (spot) => left.push(spot))
    gripIn(page).dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 20, clientY: 20, bubbles: true })
    )
    page.defaultView!.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 60, clientY: 60, bubbles: true })
    )

    expect(left.length).toBe(0)
  })

  test("stays inside the window however far the pointer goes", () => {
    const page = githubPage()

    offer(page, () => {}, { x: 0.5, y: 0.5 })
    drag(page, [200, 200], [-9000, -9000])
    expect(leftOf(page)).toBeGreaterThanOrEqual(0)
    expect(topOf(page)).toBeGreaterThanOrEqual(0)

    drag(page, [leftOf(page), topOf(page)], [9000, 9000])
    expect(leftOf(page)).toBeLessThanOrEqual(page.defaultView!.innerWidth)
    expect(topOf(page)).toBeLessThanOrEqual(page.defaultView!.innerHeight)
  })

  test("a drag on the grip is not a press on the mark", () => {
    // The two are separate elements for exactly this: nothing in the events tells a
    // press from a drag until the pointer is already up, so one target would mean a
    // move that sometimes turned the interface on.
    const page = githubPage()
    let asked = 0

    offer(page, () => {
      asked += 1
    })
    drag(page, [100, 100], [200, 200])

    expect(asked).toBe(0)
  })

  test("and a press still works after one", () => {
    const page = githubPage()
    let asked = 0

    offer(page, () => {
      asked += 1
    })
    drag(page, [100, 100], [200, 200])
    markIn(page).dispatchEvent(new PointerEvent("click", { bubbles: true }))

    expect(asked).toBe(1)
  })

  test("moves on the arrow keys as well, for a reader with no pointer", () => {
    const page = githubPage()
    const left: Array<Spot> = []

    offer(page, () => {}, { x: 0.5, y: 0.5 }, (spot) => left.push(spot))
    const before = leftOf(page)
    gripIn(page).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))

    expect(leftOf(page)).toBeLessThan(before)
    expect(left.length).toBe(1)
  })

  test("ignores a key that is not an arrow", () => {
    const page = githubPage()

    offer(page, () => {}, { x: 0.5, y: 0.5 })
    const before = leftOf(page)
    gripIn(page).dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }))

    expect(leftOf(page)).toBe(before)
  })
})

describe("where it comes back", () => {
  test("is where the reader left it", () => {
    const page = githubPage()

    offer(page, () => {}, { x: 0, y: 0 })
    const corner = { left: leftOf(page), top: topOf(page) }
    opened.pop()!()

    offer(page, () => {}, { x: 1, y: 1 })

    expect(leftOf(page)).toBeGreaterThan(corner.left)
    expect(topOf(page)).toBeGreaterThan(corner.top)
  })

  test("is the bottom right when nothing was ever stored", () => {
    const page = githubPage()

    offer(page)

    expect(leftOf(page)).toBeGreaterThan(page.defaultView!.innerWidth / 2)
    expect(topOf(page)).toBeGreaterThan(page.defaultView!.innerHeight / 2)
  })

  test("is inside the window even when the stored place is nonsense", () => {
    // What comes back from synced storage was written by another version of this, or
    // by a hand editing it. A widget placed off the screen cannot be dragged back on.
    const page = githubPage()

    offer(page, () => {}, readSpot({ x: 9000, y: -4 }))

    expect(leftOf(page)).toBeLessThanOrEqual(page.defaultView!.innerWidth)
    expect(topOf(page)).toBeGreaterThanOrEqual(0)
  })

  test("survives a window too small to hold its travel", () => {
    // Travel below zero would put a fraction of it outside the window on the side it
    // was trying to stay inside.
    const page = githubPage()
    const view = page.defaultView as unknown as { innerWidth: number; innerHeight: number }
    const was = { width: view.innerWidth, height: view.innerHeight }
    view.innerWidth = 20
    view.innerHeight = 20

    offer(page, () => {}, DEFAULT_SPOT)

    expect(leftOf(page)).toBe(16)
    expect(topOf(page)).toBe(16)

    view.innerWidth = was.width
    view.innerHeight = was.height
  })
})
