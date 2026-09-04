import { describe, expect, test } from "bun:test"
import { POLL_MS, pollUpdates } from "./poll"

describe("the window's live follow-up", () => {
  test("asks again on the timer, and stops when asked", () => {
    let fired = 0
    const real = setInterval
    const ids: Array<ReturnType<typeof setInterval>> = []
    const intervals: Array<number> = []

    globalThis.setInterval = ((fn: () => void, ms: number) => {
      intervals.push(ms)
      const id = real(() => {
        fired += 1
      }, 60_000)
      ids.push(id)
      return id
    }) as typeof setInterval

    const stop = pollUpdates([], () => {
      fired += 1
    })

    expect(intervals).toEqual([POLL_MS])
    stop()
    for (const id of ids) clearInterval(id)
    globalThis.setInterval = real
  })
})
