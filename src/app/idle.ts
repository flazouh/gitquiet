import { Effect } from "effect"

/**
 * How long work may wait for a quiet moment before it is done anyway, in
 * milliseconds.
 *
 * A judgement rather than a measurement. GitHub's own page keeps the main
 * thread busy for seconds after a press, so "when idle" on its own can mean
 * "not while the reader is here"; two seconds is long enough to miss the press
 * this is dodging and short enough that a reader who scrolls straight to the
 * waiting thing is not left looking at a placeholder.
 */
const BY = 2_000

/**
 * Runs the work when the browser has nothing better to do, and hands back the
 * way to call it off.
 *
 * The fallback is a timer rather than nothing, because a platform without an
 * idle queue still has the reader: two hundred milliseconds is past the paint
 * the wait is protecting. Zero would not be — a task queued at zero can run
 * before the next frame, which is the whole thing this avoids.
 */
export const whenIdle = (act: () => void, by: number = BY): (() => void) => {
  const later = globalThis.requestIdleCallback
  if (later === undefined) {
    const soon = setTimeout(act, 200)
    return () => clearTimeout(soon)
  }

  const asked = later(() => act(), { timeout: by })
  return () => globalThis.cancelIdleCallback?.(asked)
}

/**
 * Runs each act in its own quiet moment, in order, and hands back the way to
 * call off whatever has not run yet.
 *
 * For work that is heavy per piece: several pieces in one callback are one
 * long task, felt as a hitch by a reader who is scrolling by the time the
 * deadline forces it. Acts that already ran stay run — the canceller only
 * stops the ones still waiting.
 */
export const eachIdle = (acts: ReadonlyArray<() => void>, by?: number): (() => void) => {
  let cancel: () => void = () => {}
  const run = (at: number): void => {
    const act = acts[at]
    if (act === undefined) return
    cancel = whenIdle(() => {
      act()
      run(at + 1)
    }, by)
  }
  run(0)
  return () => cancel()
}

/**
 * Runs the work after the next painted frame, and hands back the way to call
 * it off.
 *
 * For heavy work an interaction asked for directly: run inside the
 * interaction's own commit it holds the visible answer hostage, and an idle
 * wait is too patient for something the reader is looking at. A frame callback
 * runs before its paint, so the zero timer scheduled inside one runs just
 * after it — the answer is on screen, then the work runs. The `by` timer is
 * for pages that paint no frames at all, a tab opened in the background being
 * the one that matters: there the work simply happens soon instead, so the tab
 * is ready by the time it is brought forward.
 */
export const afterPaint = (act: () => void, by = 250): (() => void) => {
  let frame: number | null = null
  let beat: ReturnType<typeof setTimeout> | null = null
  let done = false

  const stop = (): void => {
    if (frame !== null) cancelAnimationFrame(frame)
    if (beat !== null) clearTimeout(beat)
    clearTimeout(anyway)
  }
  const run = (): void => {
    if (done) return
    done = true
    stop()
    act()
  }
  const anyway = setTimeout(run, by)
  if (typeof requestAnimationFrame === "function") {
    frame = requestAnimationFrame(() => {
      frame = null
      beat = setTimeout(run, 0)
    })
  }
  return () => {
    done = true
    stop()
  }
}

/**
 * The same wait, in front of an Effect, for work a fiber already owns.
 *
 * Interrupting the fiber calls the wait off and the work never starts. Which is
 * the reason to say it this way rather than in a component: a caller that
 * schedules a callback itself has to remember both to cancel the wait and to
 * ignore a callback that arrives after it, and forgetting the second one costs
 * the whole of the work on a page the reader has already left.
 */
export const afterIdle = <A, E, R>(work: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.callback<void>((resume) => {
    const stop = whenIdle(() => resume(Effect.void))
    return Effect.sync(stop)
  }).pipe(Effect.flatMap(() => work))
