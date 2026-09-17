import { HOST_ID } from "./theHost"

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
  /*
   * Read off the host, which is the one element that always carries the scale.
   *
   * The durations are declared on `#gitquiet-root, [data-gitquiet-outside]`, and
   * the host carries the outside mark — so it has every one of them, and there is
   * exactly one host in a document. That last part is the whole reason it is the
   * host and not the root: a suite is one document, and a test that plants
   * durations while a screen stands its own root is two roots and a coin toss
   * about which one a lookup answers with.
   *
   * It was `document.getElementById("gitquiet-root")`, which found nothing at all
   * once the interface moved into a shadow root: every duration in the interface
   * had quietly fallen back to the number written beside it in JavaScript, and the
   * stylesheet had stopped owning the timing it is meant to own. Nothing looked
   * broken, because the fallbacks are production's numbers — they are simply no
   * longer the ones in `motion.css`, and retuning that file moved nothing.
   *
   * `tests/paced.ts` writes onto the same element, because a seam with two ends
   * has to have both of them in the same place. It did not, and the disagreement
   * cost two CI runs.
   */
  const root = document.getElementById(HOST_ID)
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
