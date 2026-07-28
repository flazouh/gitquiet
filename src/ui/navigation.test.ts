import { describe, expect, test } from "bun:test"
import { whenLocationChanges } from "./navigation"

/**
 * Enough of a window to navigate in: the address is writable, GitHub's events
 * can be fired at the document, and time is a number this test advances.
 */
const browser = (path: string) => {
  const page = document.implementation.createHTMLDocument("github")
  const listeners = new Set<() => void>()
  const timers = new Set<() => void>()
  let now = path

  const target = {
    location: { get pathname() { return now } },
    document: page,
    addEventListener: (_: string, run: () => void) => listeners.add(run),
    removeEventListener: (_: string, run: () => void) => listeners.delete(run),
    setInterval: (run: () => void) => {
      timers.add(run)
      return timers.size
    },
    clearInterval: () => timers.clear(),
    setTimeout: (run: () => void) => {
      run()
      return 0
    }
  } as unknown as Window

  return {
    target,
    goTo: (to: string) => {
      now = to
    },
    /** What the interval does, without waiting for it. */
    tick: () => {
      for (const run of [...timers]) run()
    },
    announce: (name: string) => {
      page.dispatchEvent(new Event(name))
    },
    popstate: () => {
      for (const run of [...listeners]) run()
    }
  }
}

describe("noticing GitHub navigate without loading a page", () => {
  test("reports the new path when the address changes", () => {
    const seen: Array<string> = []
    const it = browser("/o/r/pull/1")
    whenLocationChanges(it.target, (path) => seen.push(path))

    it.goTo("/o/r/pull/2")
    it.tick()

    expect(seen).toEqual(["/o/r/pull/2"])
  })

  test("says nothing while the address stays where it was", () => {
    const seen: Array<string> = []
    const it = browser("/o/r/pull/1")
    whenLocationChanges(it.target, (path) => seen.push(path))

    it.tick()
    it.tick()

    expect(seen).toEqual([])
  })

  test("reports each move once, however many things announce it", () => {
    const seen: Array<string> = []
    const it = browser("/o/r/pull/1")
    whenLocationChanges(it.target, (path) => seen.push(path))

    it.goTo("/o/r/pulls")
    it.announce("soft-nav:start")
    it.announce("soft-nav:end")
    it.popstate()
    it.tick()

    expect(seen).toEqual(["/o/r/pulls"])
  })

  test("notices a move GitHub announces before the interval comes round", () => {
    const seen: Array<string> = []
    const it = browser("/o/r/pull/1")
    whenLocationChanges(it.target, (path) => seen.push(path))

    it.goTo("/o/r/pull/9")
    it.announce("turbo:load")

    expect(seen).toEqual(["/o/r/pull/9"])
  })

  test("stops when told to", () => {
    const seen: Array<string> = []
    const it = browser("/o/r/pull/1")
    const stop = whenLocationChanges(it.target, (path) => seen.push(path))

    stop()
    it.goTo("/o/r/pull/2")
    it.tick()
    it.announce("soft-nav:end")

    expect(seen).toEqual([])
  })
})
