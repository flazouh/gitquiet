import { describe, expect, test } from "bun:test"
import { Deferred, Effect } from "effect"
import { readingAhead } from "./readAhead"

/** A read that goes on until it is let go, and remembers how it ended. */
const held = () => {
  const gate = Effect.runSync(Deferred.make<void>())
  const marks = { started: 0, ended: 0, called: 0 }

  const read = Effect.suspend(() => {
    marks.started += 1
    return Deferred.await(gate)
  }).pipe(
    Effect.onInterrupt(() =>
      Effect.sync(() => {
        marks.called += 1
      })
    ),
    Effect.tap(() =>
      Effect.sync(() => {
        marks.ended += 1
      })
    )
  )

  return { read, marks, land: () => Effect.runSync(Deferred.succeed(gate, undefined)) }
}

/** Long enough for a fiber to have got wherever it was going. */
const settle = () => new Promise((rest) => setTimeout(rest, 30))

const anySecond: Parameters<ReturnType<typeof readingAhead>["pressed"]>[1] = {
  there: () => false,
  by: performance.now() + 1_000
}

describe("reading pages nobody has asked for", () => {
  test("reads the page it is offered", async () => {
    const ahead = readingAhead()
    const page = held()

    ahead.offer("a", page.read)
    await settle()

    expect(page.marks.started).toBe(1)
    expect(ahead.already("a")).toBe(true)
    expect(ahead.read()).toBe(1)
  })

  test("one at a time, holding the newest offer until the read in the air is done", async () => {
    // A reader sweeping a list would otherwise have every route they passed over in
    // flight at once, and GitHub is entitled to think less of us for it.
    const ahead = readingAhead()
    const first = held()
    const second = held()
    const third = held()

    ahead.offer("a", first.read)
    ahead.offer("b", second.read)
    ahead.offer("c", third.read)
    await settle()

    expect(first.marks.started).toBe(1)
    expect(second.marks.started).toBe(0)
    // The newest, because a reader who has moved on has moved on.
    expect(third.marks.started).toBe(0)

    first.land()
    await settle()

    expect(third.marks.started).toBe(1)
    expect(second.marks.started).toBe(0)
  })

  test("the held page is read rather than dropped, which is why it is held", async () => {
    // The drop used to happen after the page had been written down as asked for, so a
    // page offered while another was in flight was never read and never offered again.
    const ahead = readingAhead()
    const first = held()
    const second = held()

    ahead.offer("a", first.read)
    ahead.offer("b", second.read)
    first.land()
    await settle()

    expect(second.marks.started).toBe(1)
    expect(ahead.read()).toBe(2)
  })
})

describe("getting out of the reader's way when they press", () => {
  test("calls off a read for anywhere but the page they asked for", async () => {
    const ahead = readingAhead()
    const page = held()

    ahead.offer("a", page.read)
    await settle()

    ahead.pressed("somewhere-else", anySecond)
    await settle()

    expect(page.marks.called).toBe(1)
  })

  test("spares the read for the page being opened, which is the one it paid for", async () => {
    // It lands in the store and the screen draws that store before GitHub has answered
    // anything. Calling it off cost what it was worth: 238ms rested became 1,256ms.
    const ahead = readingAhead()
    const page = held()

    ahead.offer("a", page.read)
    await settle()

    ahead.pressed("a", anySecond)
    await settle()

    expect(page.marks.called).toBe(0)
  })

  test("a press with nothing of ours behind it calls off everything", async () => {
    /*
     * `null` and "no read is in the air" were the same value once, so a moment where the
     * key was missing read as "this is the page they asked for" and spared the read it
     * was called to stop.
     */
    const ahead = readingAhead()
    const page = held()

    ahead.offer("a", page.read)
    await settle()

    ahead.pressed(null, anySecond)
    await settle()

    expect(page.marks.called).toBe(1)
  })

  test("reads nothing at all while the page they pressed for is on its way", async () => {
    const ahead = readingAhead()
    const page = held()

    ahead.pressed(null, anySecond)
    ahead.offer("a", page.read)
    await settle()

    expect(page.marks.started).toBe(0)
    expect(ahead.already("a")).toBe(false)
  })

  test("reads again once that page is up", async () => {
    const ahead = readingAhead()
    const page = held()
    let up = false

    ahead.pressed(null, { there: () => up, by: performance.now() + 1_000 })
    up = true

    expect(ahead.waiting(performance.now())).toBe(false)

    ahead.offer("a", page.read)
    await settle()

    expect(page.marks.started).toBe(1)
  })

  test("reads again at the deadline, for a press that never became a navigation", async () => {
    const ahead = readingAhead()
    const page = held()
    const by = performance.now() + 1_000

    ahead.pressed(null, { there: () => false, by })

    expect(ahead.waiting(by - 1)).toBe(true)
    expect(ahead.waiting(by + 1)).toBe(false)

    ahead.offer("a", page.read)
    await settle()

    expect(page.marks.started).toBe(1)
  })

  test("stops asking whether the screen is up once the deadline has passed", () => {
    // The press was swallowed, the answer cannot change, and asking every frame for the
    // rest of the session is a listener nobody turned off.
    const ahead = readingAhead()
    let asked = 0
    const by = performance.now() + 1_000

    ahead.pressed(null, {
      there: () => {
        asked += 1
        return false
      },
      by
    })

    ahead.waiting(by + 1)
    asked = 0
    ahead.waiting(by + 2)

    expect(asked).toBe(0)
  })
})

describe("a read that was called off but has not finished dying", () => {
  test("keeps the one place until it is really gone, so nothing starts beside it", async () => {
    /*
     * An interrupt is asked for, not done, and a read inside a region that cannot be cut
     * goes on running after the press that called it off. This is the invariant that
     * keeps the read in the air, the key naming it and the one-at-a-time flag owned by a
     * single read at a time: the flag is put down by that read's own ending, never by the
     * press, so the next read cannot begin until the last one has actually stopped.
     *
     * Worth pinning because it is not obvious, and because everything in `readAhead`
     * holding a single slot depends on it. The generation check in `start` is what
     * catches the day this stops being true.
     */
    const ahead = readingAhead()
    const stubborn = Effect.uninterruptible(Effect.sleep("120 millis"))
    const next = held()

    ahead.offer("a", stubborn)
    await settle()

    ahead.pressed(null, { there: () => true, by: performance.now() + 1_000 })
    // The screen the press asked for is up, so reading is allowed again — well before
    // the called-off read has finished dying.
    expect(ahead.waiting(performance.now())).toBe(false)

    ahead.offer("b", next.read)
    await settle()

    expect(next.marks.started).toBe(0)

    await new Promise((rest) => setTimeout(rest, 150))

    // And it is read, rather than lost, the moment the place is free.
    expect(next.marks.started).toBe(1)
  })

  test("the read that took its place is the one a later press calls off", async () => {
    const ahead = readingAhead()
    const stubborn = Effect.uninterruptible(Effect.sleep("120 millis"))
    const next = held()

    ahead.offer("a", stubborn)
    await settle()

    ahead.pressed(null, { there: () => true, by: performance.now() + 1_000 })
    ahead.waiting(performance.now())
    ahead.offer("b", next.read)

    await new Promise((rest) => setTimeout(rest, 150))
    expect(next.marks.started).toBe(1)

    ahead.pressed(null, anySecond)
    await settle()

    expect(next.marks.called).toBe(1)
  })
})
