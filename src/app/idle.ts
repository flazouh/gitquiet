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
