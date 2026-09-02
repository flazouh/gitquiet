/**
 * When the interface has finished arriving, which is what the entrance animations
 * belong to.
 *
 * A fact about the document rather than about a screen. Every navigation of ours
 * closes the screen and stands a new one up, so anything a component remembers
 * starts again on every move — and the page replayed its arrival for somewhere the
 * reader was returning to. Kept out of `mount.ts` because standing a screen on a
 * page and deciding whether its panels may animate are two different questions,
 * and that file already answers plenty.
 */

/** The mark saying this document has already watched the interface arrive once. */
const LANDED_BEFORE = "data-gitquiet-arrived"

/**
 * Whether the reader has already seen one of our screens land in this document.
 *
 * The entrance animations belong to the arrival, and `Shell` holds a flag that says
 * when its own is over. That flag is a component's, and every navigation of ours
 * closes the screen and stands a new one up — so it started false again on every
 * move, and the page replayed its entrance for somewhere the reader was returning
 * to. Recorded at 120 frames a second, pressing Back onto a list: the rows arrived
 * at full strength and the filter bar above them faded in across the 183
 * milliseconds after, which is `t-panel-in` running on a panel nobody waited for.
 *
 * On the document rather than in a module, because each screen is built as its own
 * bundle and a move between two kinds shares no module with the screen it replaces.
 * A real page load empties the document and with it this, which is right: that is an
 * arrival, and the reader is watching the interface come up for the first time.
 */
export const hasLandedBefore = (target: Document): boolean =>
  target.documentElement.hasAttribute(LANDED_BEFORE)

export const markLanded = (target: Document): void => {
  target.documentElement.setAttribute(LANDED_BEFORE, "")
}

/**
 * How long an arrival may keep entering, in milliseconds.
 *
 * Past the last panel's stagger and its travel — five staggers of forty and a
 * quarter second of entrance is under half a second — so nothing is cut off
 * mid-arrival, and early enough that the first late read to land finds the page
 * already still. The same number `Shell` waits, held here because every screen
 * has to agree about it and only one of them is a pull request.
 */
export const LANDING = 700

/**
 * Says so once this screen's own arrival is over, and hands back the way to stop.
 *
 * Called by every screen rather than by one of them. `Shell` held this alone, and
 * `Shell` is the pull request's, so a reader who only ever walked between lists
 * marked nothing and watched every list enter again on the way back.
 */
export const landWhenArrived = (target: Document): (() => void) => {
  if (hasLandedBefore(target)) return () => {}
  const timer = setTimeout(() => markLanded(target), LANDING)
  return () => clearTimeout(timer)
}

/** Forgets it, for a test that must not land on what another test landed. */
export const forgetLanded = (target: Document): void => {
  target.documentElement.removeAttribute(LANDED_BEFORE)
}
