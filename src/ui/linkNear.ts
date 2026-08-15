/**
 * The link the pointer is about to reach, anywhere on GitHub's page.
 *
 * Split from `near.ts`, which is a React hook module: this one is imported by the content
 * script that runs on every page of GitHub, and the hook beside it shares nothing with it
 * but the shape of a point. A type import is erased, so nothing of React reaches that
 * bundle.
 */

import type { Point } from "./near"

/**
 * How far in front of the pointer the shell looks for the next page to read.
 *
 * Ninety-six pixels is about three rows of a list, or the width of a name in a row. Far
 * enough to be reading before the pointer arrives; near enough that a reader crossing the
 * page on the way to their own header does not start a read of everything they pass.
 */
export const AHEAD = 96

/** How many directions are sampled at each distance. */
const AROUND = 8

/**
 * The points to test, nearest first: the pointer itself, then a ring at half the reach,
 * then a ring at the whole of it.
 *
 * Nearest first because the answer is the first link found, and the nearest link is the
 * one the pointer is most likely headed for. Computed once, as offsets.
 */
const RING: ReadonlyArray<Point> = [
  { x: 0, y: 0 },
  ...[AHEAD / 2, AHEAD].flatMap((reach) =>
    Array.from({ length: AROUND }, (_, step) => {
      const turn = (step / AROUND) * 2 * Math.PI
      return { x: Math.round(Math.cos(turn) * reach), y: Math.round(Math.sin(turn) * reach) }
    })
  )
]

/** What is under one point of the page. Only a test ever passes one. */
export type Pick = (x: number, y: number) => Element | null

const onThePage: Pick = (x, y) => document.elementFromPoint(x, y)

/**
 * The nearest link to a point, anywhere on the page, or nothing where there is none
 * within reach.
 *
 * The hook above is the same idea inside one component, where the container knows which
 * of its children are worth warming and marks them. This is the shell's version, and it
 * has no such list: the links worth reading ahead are anywhere on GitHub's page as well as
 * on ours, and a reader passes hundreds of them.
 *
 * So hit tests rather than rectangles. Measuring every anchor on a busy list is a layout
 * read per link per frame; the browser already knows what is at a point, and answers
 * seventeen of those in a fraction of a millisecond whatever the page is.
 */
export const linkNear = (at: Point, pick: Pick = onThePage): HTMLAnchorElement | null => {
  for (const offset of RING) {
    const found = pick(at.x + offset.x, at.y + offset.y)
    const link = found === null ? null : found.closest("a")

    if (link instanceof HTMLAnchorElement && link.href !== "") return link
  }

  return null
}
