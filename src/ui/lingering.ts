/**
 * How much of a reader's attention one link has had, and when that is enough to read it.
 *
 * The thing being measured is not a rest. It is the time the pointer spends in and around
 * a link, which is what somebody deciding to press it actually does: they slow down as
 * they arrive, they land, they drift a few pixels, and only then do they press. A timer
 * started fresh on arrival throws away the approach, and a timer cleared on every stray
 * pixel throws away the drift — so the reader most sure of where they were going was the
 * one least likely to have their page read ahead.
 *
 * So: credit, earned per frame, at a rate set by how close the pointer is. Nearer earns
 * faster, distance still earns something, and a link the pointer has abandoned loses what
 * it had. A page is read when one link has earned {@link RIPE} of it.
 *
 * Pure, and separate from the content script for the usual reason: what is worth testing
 * is which pointer paths lead to a read and which do not, and none of that is testable
 * inside a listener.
 */

import { AHEAD } from "./linkNear"

/**
 * What the pointer is near this frame, where it is near anything at all.
 *
 * `page` is carried rather than looked up again: credit is kept under a name, and the
 * caller gets back the thing it attached to that name instead of a key it has to resolve
 * a second time. Which also means a ripe answer is proof there was something to read,
 * rather than a key beside a separate value the reader has to check for null.
 */
export type Seen<Page> = {
  readonly key: string
  readonly reach: number
  readonly page: Page
}

/** What every link in reach has earned so far, in credit. */
export type Lingering = ReadonlyMap<string, number>

export const NOTHING: Lingering = new Map()

/**
 * The credit one link needs before its page is read.
 *
 * Expressed in milliseconds of a pointer sitting directly on it, which is the same figure
 * the interface used when resting was the only thing that counted. An approach spends
 * part of it before the pointer lands, so a reader who moves towards a link deliberately
 * reaches it sooner than one whose pointer appears on it from a scroll.
 */
export const RIPE = 150

/**
 * The most one frame is ever worth.
 *
 * A tab woken after a minute hands the first frame the whole minute, and a page that
 * fetched whatever the pointer was left sitting over would be reading something nobody
 * asked for. Four frames is longer than any stutter worth crediting and shorter than
 * anything that could ripen a link on its own.
 */
export const STALL = 64

/**
 * How fast credit is earned at a given distance, per millisecond.
 *
 * Full rate on the link itself, and a little under a third of it at the far edge of the
 * reach. Sloped rather than stepped because the pointer crosses those distances on its
 * way in, and the slope is what makes the approach count for more the closer it gets.
 */
export const rateAt = (reach: number): number => {
  const part = Math.min(Math.max(reach, 0), AHEAD) / AHEAD
  return 1 - 0.7 * part
}

/**
 * One frame of attention, and the link it was enough for.
 *
 * The caller must stop offering a key once it is returned as ripe: this drops what that
 * key earned, so a caller that kept offering it would read the same page again every
 * {@link RIPE} milliseconds.
 */
export const lingerFor = <Page>(
  before: Lingering,
  seen: Seen<Page> | null,
  elapsed: number
): { readonly lingering: Lingering; readonly ripe: Page | null } => {
  const spent = Math.min(Math.max(elapsed, 0), STALL)
  const lingering = new Map<string, number>()

  // Everything the pointer is not on loses at the rate the link itself gains, so a
  // glance costs as much as it bought. Dropped at zero rather than kept, because a map
  // holding every link a reader has passed is a leak with a slow fuse.
  for (const [key, earned] of before) {
    if (key === seen?.key) continue
    const left = earned - spent
    if (left > 0) lingering.set(key, left)
  }

  if (seen === null) return { lingering, ripe: null }

  const earned = (before.get(seen.key) ?? 0) + spent * rateAt(seen.reach)
  if (earned >= RIPE) return { lingering, ripe: seen.page }

  lingering.set(seen.key, earned)
  return { lingering, ripe: null }
}
