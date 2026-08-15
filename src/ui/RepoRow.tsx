/**
 * One repository as one line, and the columns every such line stands in.
 *
 * Shared by the two screens that list somebody's repositories — their tab and the band
 * at the foot of their profile — because the same repository on two pages of one person
 * must read as the same thing. A second copy of this drifts within a week.
 */

import { Option } from "effect"
import type { ListedRepository } from "../domain/life"
import { ASIDE, PILL } from "./dress"
import { dayOf, momentOf } from "./when"

/**
 * How wide each of a row's columns is, in the order a row draws them.
 *
 * Fixed tracks rather than a line of flexbox, which is the same repair the Working Set
 * documents and the same reason: read one row at a time, contents-sized cells are right,
 * and a list is not read one row at a time. Sized to the widest thing each column holds
 * in a real list — thirty rows of `sindresorhus` and thirty of `tj` — with the
 * description taking whatever is left, because it is the part worth the width.
 */
const TRACK = {
  name: "14rem",
  said: "minmax(0,1fr)",
  language: "7rem",
  stars: "5.5rem",
  forks: "5rem",
  when: "5.5rem"
} as const

/**
 * Which of the columns a list reserves room for.
 *
 * Over every row rather than each one, so a fact three rows have does not push the
 * other twenty-seven out of line. Over the whole list rather than the found rows, so
 * that typing in the field does not walk the columns sideways under the reader's eyes:
 * the Working Set settled both of these and this is the same list one page along.
 */
export type Columns = {
  readonly language: boolean
  readonly stars: boolean
  readonly forks: boolean
}

export const columnsIn = (rows: ReadonlyArray<ListedRepository>): Columns => {
  let language = false
  let stars = false
  let forks = false

  for (const one of rows) {
    if (Option.isSome(one.language)) language = true
    if (one.stars > 0) stars = true
    if (one.forks > 0) forks = true
    if (language && stars && forks) break
  }

  return { language, stars, forks }
}

const tracksOf = (columns: Columns): string =>
  [
    TRACK.name,
    TRACK.said,
    ...(columns.language ? [TRACK.language] : []),
    ...(columns.stars ? [TRACK.stars] : []),
    ...(columns.forks ? [TRACK.forks] : []),
    TRACK.when
  ].join(" ")

/**
 * One repository, as a row of the group it belongs to.
 *
 * One line, and every fact on it in the same column as the row above's. Their own rows
 * are five lines tall — name, description, topics as chips, language, stars, licence and
 * a date — which is how thirty repositories become a page nobody scrolls to the end of.
 * The topics are still how a reader finds one; they are read by the find box above
 * rather than printed on every row.
 *
 * The name is the link and the row is not, the way a Change's row is: a reader who wants
 * to select a repository's name should not have to open it to do that.
 */
export const Row = ({
  one,
  columns,
  at,
  now
}: {
  readonly one: ListedRepository
  readonly columns: Columns
  /** Where in the group it is, for the entrance. Absent where nothing should animate. */
  readonly at?: number
  readonly now: Date
}) => {
  const language = Option.getOrUndefined(one.language)
  const pushed = Option.getOrUndefined(one.pushedAt)
  /*
   * What it is, or where it came from where it is somebody else's work and says nothing
   * of its own. One sentence either way rather than one of two, so the line and the
   * tooltip over it cannot say different things about the same cell.
   */
  const says = Option.getOrUndefined(
    Option.orElse(one.description, () =>
      Option.map(one.forkedFrom, (from) => `forked from ${from}`)
    )
  )

  return (
    <li
      data-row=""
      className={`grid min-w-0 items-center gap-2 px-3 py-1.5 hover:bg-hover ${
        at === undefined ? "" : "t-row-in"
      }`}
      style={
        {
          gridTemplateColumns: tracksOf(columns),
          ...(at === undefined ? {} : { "--row-at": String(at) })
        } as React.CSSProperties
      }
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <a
          href={`/${one.nameWithOwner}`}
          className="min-w-0 truncate font-semibold text-ink text-sm no-underline hover:underline"
        >
          {one.repo}
        </a>
        {one.isPrivate ? (
          <span className={`${PILL} shrink-0 text-ink-muted text-[11px]`}>Private</span>
        ) : null}
      </span>

      {/* One cell either way, so the columns past it stay straight. */}
      <span className={`min-w-0 truncate ${ASIDE}`} title={says}>
        {says}
      </span>

      {columns.language ? (
        <span className={`flex min-w-0 items-center gap-1.5 ${ASIDE}`}>
          {language === undefined ? null : (
            <>
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: language.colour }}
              />
              <span className="truncate">{language.name}</span>
            </>
          )}
        </span>
      ) : null}

      {/* The counts in their own tracks, held open on the rows that have none of them:
          an empty cell costs nothing and is what keeps the cells either side in line. */}
      {columns.stars ? (
        <span className={`text-right tabular-nums ${ASIDE}`}>
          {one.stars === 0 ? null : `${one.stars.toLocaleString()} ${one.stars === 1 ? "star" : "stars"}`}
        </span>
      ) : null}

      {columns.forks ? (
        <span className={`text-right tabular-nums ${ASIDE}`}>
          {one.forks === 0 ? null : `${one.forks.toLocaleString()} ${one.forks === 1 ? "fork" : "forks"}`}
        </span>
      ) : null}

      {/* A date and never a distance: "2 years ago" under "3 years ago" is the same
          three words to somebody scanning thirty rows. See `dayOf`. */}
      <span className={`text-right tabular-nums ${ASIDE}`}>
        {pushed === undefined ? (
          /* One word in a column this width, and the sentence said aloud beside it: a
             reader being read to gets "never pushed to", which is the whole fact. */
          <span role="img" aria-label="never pushed to" title="never pushed to">
            never
          </span>
        ) : (
          <span title={momentOf(pushed)}>{dayOf(pushed, now)}</span>
        )}
      </span>
    </li>
  )
}
