import type { ChangedFile } from "../domain/PullRequest"

/** What a row in the tree says about itself besides its name. */
export type RowMark = {
  readonly added: number
  readonly deleted: number
  /** The file has been opened, or every file under this directory has. */
  readonly seen: boolean
}

/**
 * A line count in the space a narrow rail has: `842`, `1.4k`.
 *
 * Four digits beside a name in a two-hundred-pixel rail is four digits instead
 * of the name, and nobody reviewing a fourteen-hundred-line directory needs the
 * last two of them to know what they are in for.
 */
export const shortCount = (lines: number): string =>
  lines < 1000 ? String(lines) : `${(lines / 1000).toFixed(1).replace(/\.0$/, "")}k`

/**
 * Every file counted as read: the ones GitHub already has ticked, and the ones
 * opened here since the page loaded, less the ones the reader put back.
 *
 * GitHub's own Viewed checkboxes are the half worth keeping — they survive
 * closing the tab, and someone who ticked forty files off yesterday should not
 * be shown forty unread files today. Opening a file here adds to that set but
 * cannot yet write back to it, so the two are merged rather than one being
 * treated as the truth.
 *
 * `putBack` overrules both, which is the whole of its job. The most-repeated
 * complaint about GitHub's own checkboxes is not that they are hard to tick, it
 * is that a second review means unticking every one of them by hand: "it gets
 * very tedious marking all files as not-viewed", filed on Refined GitHub's
 * tracker and quoted on our own landing page. A mark a reader cannot take off
 * is a review they cannot start again.
 */
export const seenFiles = (
  files: ReadonlyArray<ChangedFile>,
  opened: ReadonlySet<string>,
  putBack: ReadonlySet<string> = new Set()
): ReadonlySet<string> =>
  new Set(
    [...files.filter((file) => file.readByViewer).map((file) => file.path), ...opened].filter(
      (path) => !putBack.has(path)
    )
  )

/** Every directory a path lies in, longest last: `a/b/c.ts` → `a`, `a/b`. */
const ancestors = (path: string): ReadonlyArray<string> => {
  const parts = path.split("/")
  return parts.slice(0, -1).map((_, at) => parts.slice(0, at + 1).join("/"))
}

/**
 * What to write beside every row of the tree, directories included.
 *
 * A directory carries the sum of what is under it and counts as seen only when
 * all of it has been: a folder marked off while a file inside it is still
 * unread would be a lie, and the whole point of the mark is to be able to trust
 * it and stop looking there.
 */
export const rowMarks = (
  files: ReadonlyArray<ChangedFile>,
  seen: ReadonlySet<string>
): ReadonlyMap<string, RowMark> => {
  const marks = new Map<string, RowMark>()

  const add = (path: string, file: ChangedFile) => {
    const held = marks.get(path)
    marks.set(path, {
      added: (held?.added ?? 0) + file.linesAdded,
      deleted: (held?.deleted ?? 0) + file.linesDeleted,
      seen: (held?.seen ?? true) && seen.has(file.path)
    })
  }

  for (const file of files) {
    add(file.path, file)
    for (const directory of ancestors(file.path)) add(directory, file)
  }

  return marks
}
