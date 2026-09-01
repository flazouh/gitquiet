import { Effect } from "effect"
import type { Commit, Range } from "../domain/blame"
import { BlameRoute, FileLines } from "./wire"
import { whereverAmong } from "./wherever"

const findBlame = whereverAmong(BlameRoute)
const findLines = whereverAmong(FileLines)

/** What one page of blame is drawn from, once decoded. */
export type Blamed = {
  readonly ranges: ReadonlyArray<Range>
  readonly commits: ReadonlyMap<string, Commit>
  readonly ignoreRevsPresent: boolean
  readonly lines: ReadonlyArray<string>
}

/**
 * `ranges` in ascending line order, out of the object GitHub keys it by.
 *
 * A JSON object whose keys are all integer-like strings is already ordered
 * ascending by the language's own rule for such keys, so `Object.values`
 * reads them in line order for nothing. Sorted here anyway, explicitly,
 * because that rule is not a thing a reader of this file should have to know
 * to trust the order `spansOf` receives.
 */
const rangesInOrder = (
  ranges: Record<string, { readonly start: number; readonly end: number; readonly commitOid: string }>
): ReadonlyArray<Range> =>
  Object.values(ranges)
    .map(({ start, end, commitOid }) => ({ start, end, commitOid }))
    .sort((one, two) => one.start - two.start)

/**
 * One page's blame, out of the payloads of the document GitHub renders for
 * it.
 *
 * Two searches in the one document, as `openedFrom` in `./file.ts` already
 * does for a plain file: the blame route and the file's own lines are two of
 * GitHub's payloads sitting side by side in one script tag.
 */
export const blamedFrom = (payloads: ReadonlyArray<unknown>): Effect.Effect<Blamed, unknown> =>
  Effect.all([findBlame(payloads), findLines(payloads)]).pipe(
    Effect.map(([{ blame }, lines]) => ({
      ranges: rangesInOrder(blame.ranges),
      commits: new Map(Object.entries(blame.commits)),
      ignoreRevsPresent: blame.ignoreRevs.present,
      lines: lines.rawLines ?? []
    }))
  )
