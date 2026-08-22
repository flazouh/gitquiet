import { describe, expect, test } from "bun:test"
import { Window as HappyWindow } from "happy-dom"
import {
  NAVIGATION_DURATION,
  NAVIGATION_END_MARK,
  NAVIGATION_START_MARK,
  beginNavigation,
  beginTraversalNavigation,
  finishNavigation
} from "./navigationTiming"

describe("extension navigation timing", () => {
  test("marks the exact start and readable end in the browser trace", () => {
    const view = new HappyWindow({ url: "https://github.com/pulls/inbox" })
    const page = view.document as unknown as Document
    const screen = page.createElement("div")
    screen.textContent = "Ready"
    page.body.append(screen)

    beginNavigation(view as unknown as Window)
    finishNavigation(page, "/owner/repo/pull/2", screen)

    expect(view.performance.getEntriesByType("mark").map((entry) => entry.name)).toEqual([
      NAVIGATION_START_MARK,
      NAVIGATION_END_MARK
    ])
    view.close()
  })

  test("publishes the time from an owned action to the target screen", () => {
    const view = new HappyWindow({ url: "https://github.com/pulls/inbox" })
    const page = view.document as unknown as Document
    const screen = page.createElement("div")
    screen.textContent = "Ready"
    page.body.append(screen)

    beginNavigation(view as unknown as Window)
    finishNavigation(page, "/owner/repo/pull/2", screen)

    const duration = Number(page.documentElement.getAttribute(NAVIGATION_DURATION))
    expect(duration).toBeGreaterThanOrEqual(0)
    view.close()
  })

  test("waits until the target screen is readable", async () => {
    const view = new HappyWindow({ url: "https://github.com/pulls/inbox" })
    const page = view.document as unknown as Document
    const screen = page.createElement("div")
    const waiting = page.createElement("div")
    waiting.setAttribute("data-gitquiet-loading", "")
    screen.append(waiting)
    page.body.append(screen)

    beginNavigation(view as unknown as Window)
    finishNavigation(page, "/owner/repo/pull/2", screen)

    expect(page.documentElement.getAttribute(NAVIGATION_DURATION)).toBeNull()

    waiting.remove()
    screen.textContent = "Ready"
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(Number(page.documentElement.getAttribute(NAVIGATION_DURATION))).toBeGreaterThanOrEqual(
      0
    )
    view.close()
  })

  test("keeps the earlier Back-button press when the browser announces the traversal", () => {
    const page = document.implementation.createHTMLDocument("github")
    let now = 42
    const target = { document: page, performance: { now: () => now } } as unknown as Window

    beginNavigation(target)
    now = 42.5
    beginTraversalNavigation(target)

    expect(page.documentElement.getAttribute("data-gitquiet-navigation-started")).toBe("42")
  })
})
