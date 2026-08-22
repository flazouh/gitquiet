import { describe, expect, test } from "bun:test"
import { whenLocationChanges, whenTheyStayPut, whenTraversalStarts } from "./navigation"

/**
 * Enough of a window to navigate in: the address is writable, GitHub's events
 * can be fired at the document, and time is a number this test advances.
 */
const browser = (path: string, withNavigation = true) => {
  const page = document.implementation.createHTMLDocument("github")
  const listeners = new Set<() => void>()
  const timers = new Set<() => void>()
  const entries = new Set<() => void>()
  let now = path

  const target = {
    location: { get pathname() { return now } },
    document: page,
    navigation: withNavigation
      ? {
          addEventListener: (_: string, run: () => void) => entries.add(run),
          removeEventListener: (_: string, run: () => void) => entries.delete(run)
        }
      : undefined,
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
    },
    /** What the browser itself says, the moment the entry becomes the current one. */
    entered: () => {
      for (const run of [...entries]) run()
    },
    watching: () => ({ entries: entries.size, timers: timers.size })
  }
}

describe("noticing GitHub navigate without loading a page", () => {
  test("reports a traversal destination before its address commits", () => {
    const listeners = new Set<(event: Event) => void>()
    const target = {
      location: { origin: "https://github.com" },
      navigation: {
        addEventListener: (_name: string, listener: (event: Event) => void) =>
          listeners.add(listener),
        removeEventListener: (_name: string, listener: (event: Event) => void) =>
          listeners.delete(listener)
      }
    } as unknown as Window
    const seen: Array<string> = []
    whenTraversalStarts(target, (path) => seen.push(path))

    for (const listener of listeners) {
      listener({
        navigationType: "traverse",
        destination: { url: "https://github.com/o/r/pull/2?tab=files" }
      } as unknown as Event)
    }

    expect(seen).toEqual(["/o/r/pull/2?tab=files"])
  })

  test("starts timing a browser Back or Forward traversal", () => {
    const page = document.implementation.createHTMLDocument("github")
    const listeners = new Set<(event: Event) => void>()
    const target = {
      location: { origin: "https://github.com" },
      document: page,
      performance: { now: () => 42 },
      navigation: {
        addEventListener: (_name: string, listener: (event: Event) => void) =>
          listeners.add(listener),
        removeEventListener: (_name: string, listener: (event: Event) => void) =>
          listeners.delete(listener)
      }
    } as unknown as Window
    whenTraversalStarts(target, () => {})

    for (const listener of listeners) {
      listener({
        navigationType: "traverse",
        destination: { url: "https://github.com/pulls/inbox" }
      } as unknown as Event)
    }

    expect(page.documentElement.getAttribute("data-gitquiet-navigation-started")).toBe("42")
  })

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

  test("takes the browser's own word for it, without waiting for a tick", () => {
    /*
     * The interval was up to two hundred milliseconds of the interface standing
     * over the wrong page, on every soft navigation — and none of GitHub's own
     * events are contractual, so the interval was what could be relied on. The
     * browser will say when the address changes, whoever changed it.
     */
    const seen: Array<string> = []
    const it = browser("/o/r/pull/1")
    whenLocationChanges(it.target, (path) => seen.push(path))

    it.goTo("/o/r/pull/7")
    it.entered()

    expect(seen).toEqual(["/o/r/pull/7"])
  })

  test("keeps looking on its own where the browser will not say", () => {
    const seen: Array<string> = []
    const it = browser("/o/r/pull/1", false)
    whenLocationChanges(it.target, (path) => seen.push(path))

    it.goTo("/o/r/pull/2")
    it.tick()

    expect(seen).toEqual(["/o/r/pull/2"])
  })

  test("stops listening to the browser as well when told to", () => {
    const it = browser("/o/r/pull/1")
    const stop = whenLocationChanges(it.target, () => {})

    expect(it.watching().entries).toBe(1)
    stop()

    expect(it.watching()).toEqual({ entries: 0, timers: 0 })
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

/**
 * A window that can be asked to go somewhere, and a clock this test turns by hand.
 *
 * Separate from the one above because these are the other half of the same
 * question: that harness watches an address change on its own, this one watches
 * an address that refuses to.
 */
const pressing = (path: string) => {
  const page = document.implementation.createHTMLDocument("github")
  let now = path
  const asked: Array<string> = []
  const waiting = new Map<number, () => void>()
  let next = 1

  const target = {
    location: {
      get pathname() {
        return now
      },
      assign: (to: string) => asked.push(to)
    },
    document: page,
    setTimeout: (run: () => void) => {
      waiting.set(next, run)
      return next++
    },
    clearTimeout: (which: number) => {
      waiting.delete(which)
    }
  } as unknown as Window

  return {
    target,
    asked,
    goTo: (to: string) => {
      now = to
    },
    /** GitHub saying they have taken the press. */
    announce: (name: string) => {
      page.dispatchEvent(new Event(name))
    },
    /** What the deadline does, without waiting for it. */
    deadline: () => {
      for (const run of [...waiting.values()]) run()
    }
  }
}

describe("going where the reader asked when GitHub does not", () => {
  test("carries out a press their own router dropped in silence", () => {
    /*
     * The case this exists for, and it is theirs. Walking a repository's tabs,
     * roughly every other press is dead: no announcement, no request, and the
     * same address ten seconds later.
     */
    const it = pressing("/react/react/issues")
    whenTheyStayPut(it.target, "/react/react")

    it.deadline()

    expect(it.asked).toEqual(["/react/react"])
  })

  test("is not called off by them saying they took it, only by them moving", () => {
    /*
     * Their announcement is eight milliseconds after a press they take, which
     * looked like a way to cut the deadline to a fifth. It is not one: they also
     * navigate without ever announcing it, arriving 1758 milliseconds later, and
     * a deadline on the announcement reloads that page every time.
     */
    const it = pressing("/react/react/pulls")
    whenTheyStayPut(it.target, "/react/react/issues")

    it.announce("soft-nav:start")
    it.deadline()

    expect(it.asked).toEqual(["/react/react/issues"])
  })

  test("leaves a press their router acted on alone, announced or not", () => {
    const it = pressing("/react/react/issues")
    whenTheyStayPut(it.target, "/react/react")

    it.goTo("/react/react")
    it.deadline()

    expect(it.asked).toEqual([])
  })

  test("leaves the reader alone where they went somewhere else instead", () => {
    // Two presses in a second: the first one's deadline must not drag the reader
    // back to a page they changed their mind about.
    const it = pressing("/react/react/issues")
    whenTheyStayPut(it.target, "/react/react")

    it.goTo("/react/react/pulls")
    it.deadline()

    expect(it.asked).toEqual([])
  })

  test("says nothing at all about the page already on the screen", () => {
    const it = pressing("/react/react")
    whenTheyStayPut(it.target, "/react/react")

    it.deadline()

    expect(it.asked).toEqual([])
  })

  test("stops when told to", () => {
    const it = pressing("/react/react/issues")
    const stop = whenTheyStayPut(it.target, "/react/react")

    stop()
    it.deadline()

    expect(it.asked).toEqual([])
  })
})
