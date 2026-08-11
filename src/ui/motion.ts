/**
 * How long the stylesheet says a piece of motion takes.
 *
 * Read rather than restated, so that retuning `motion.css` retunes the timers in
 * the components too. Every transition that has to be taken off the page after it
 * has finished leaving needs this: the CSS owns the duration, and a JavaScript
 * copy of it is a second source of truth that goes stale the first time somebody
 * tunes the first one.
 */
export const millisOf = (name: string, fallback: number): number => {
  const root = document.getElementById("gitquiet-root")
  if (root === null) return fallback

  const said = /^\s*([\d.]+)(ms|s)\s*$/.exec(getComputedStyle(root).getPropertyValue(name))
  return said === null ? fallback : Number(said[1]) * (said[2] === "s" ? 1000 : 1)
}

/** The shortest wait worth drawing, which is the same value a close takes. */
const SEEN = 150

/**
 * How long something has to be happening before it is worth telling anybody.
 *
 * A remembered list answers in tens of milliseconds, and most of them are
 * remembered. Anything drawn for something that short — a wait in the middle of
 * the screen, a toast at the top of it — appears and is gone before it can be
 * read, which the reader sees as the page flickering rather than as an
 * explanation of anything.
 *
 * One number, spent by the wait and by the sentence that says a read is running,
 * because the two are answers to the same question and must not disagree.
 */
export const seenIn = (): number => millisOf("--duration-quick", SEEN)
