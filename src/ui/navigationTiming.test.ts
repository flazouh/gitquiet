import { describe, expect, test } from "bun:test"
import { Window as HappyWindow } from "happy-dom"
import {
  NAVIGATION_DURATION,
  beginNavigation,
  finishNavigation
} from "./navigationTiming"

describe("extension navigation timing", () => {
  test("publishes the time from an owned action to the target screen", () => {
    const view = new HappyWindow({ url: "https://github.com/pulls/inbox" })
    const page = view.document as unknown as Document

    beginNavigation(view as unknown as Window)
    finishNavigation(page, "/owner/repo/pull/2")

    const duration = Number(page.documentElement.getAttribute(NAVIGATION_DURATION))
    expect(duration).toBeGreaterThanOrEqual(0)
    view.close()
  })
})
