import { Option } from "effect"
import type { DiffSide, Note } from "../ports/Renderer"
import type { DiffLine, ReviewThread, ThreadAnchor } from "../domain/PullRequest"

/**
 * A review thread that knows where it goes.
 *
 * The anchor is carried beside the thread rather than looked up again by every
 * caller: whether a thread has a line at all is a question worth answering
 * once, at the point the file's threads are gathered.
 */
export type AnchoredThread = {
  readonly thread: ReviewThread
  readonly at: ThreadAnchor
}

/**
 * The row a thread hangs in, named after the thread and not after its line.
 *
 * The renderer keeps a row's contents against this key, so a file redrawn at a
 * different font size does not throw away the thread that was open in it.
 */
export const threadKey = (thread: ReviewThread): string => `thread:${thread.id}`

/**
 * Our word for a side of the diff, in the renderer's.
 *
 * They number the two halves rather than name them: a remark on a line that
 * was removed belongs to the old file's numbering, and put on the new file's
 * it would land on whatever happens to sit at that number now.
 */
export const sideOf = (side: ThreadAnchor["side"]): DiffSide =>
  side === "before" ? "deletions" : "additions"

/**
 * The renderer's word for a side of the diff, in ours.
 *
 * The way back out, for lines the reader marked to say something about: what
 * the renderer hands over is the half of its own two the pointer was on, and
 * what a remark travels to GitHub as is the file that half is numbered in.
 */
export const anchorSideOf = (side: DiffSide): ThreadAnchor["side"] =>
  side === "deletions" ? "before" : "after"

/** Every thread hung off a line of this file, in the order they arrived. */
const threadsIn = (
  threads: ReadonlyArray<ReviewThread>,
  path: string
): ReadonlyArray<AnchoredThread> =>
  threads.flatMap((thread) =>
    Option.isSome(thread.at) && thread.at.value.path === path
      ? [{ thread, at: thread.at.value }]
      : []
  )

/**
 * The lines a file's diff holds, as its two halves number them.
 *
 * Both halves, because the two are numbered apart and a remark on a removed
 * line belongs to the old file's numbering. A set rather than the hunk bounds:
 * the lines are already carried on every {@link DiffLine} GitHub sent, so this
 * counts what is there rather than re-deriving it from the `@@` headers and
 * getting a second opinion about the same file.
 */
export type Drawn = {
  readonly before: ReadonlySet<number>
  readonly after: ReadonlySet<number>
}

export const drawnIn = (lines: ReadonlyArray<DiffLine>): Drawn => {
  const before = new Set<number>()
  const after = new Set<number>()

  for (const line of lines) {
    if (Option.isSome(line.beforeLine)) before.add(line.beforeLine.value)
    if (Option.isSome(line.afterLine)) after.add(line.afterLine.value)
  }

  return { before, after }
}

/**
 * This file's threads, split by whether the diff holds the line they hang on.
 *
 * The split exists because GitHub lets a reviewer comment on any line of a
 * changed file from their own Files changed page, expanded or not, while the
 * diff they send for that file still holds only its hunks. Such a thread
 * arrives in the payload like any other and names a line nothing here drew, so
 * there is no row for it to hang in. Handed to the renderer anyway it is a
 * remark nobody sees, and the file reads as though nobody said anything about
 * it. See `CONTEXT.md`, Out of Reach.
 *
 * Nothing is out of reach while `drawn` is null. The diff arrives after the
 * threads do, and a file whose content has not landed cannot be said to be
 * missing a line — the pane would accuse GitHub of hiding remarks for as long
 * as the fetch takes, and then take it back.
 */
export type OnFile = {
  readonly inReach: ReadonlyArray<AnchoredThread>
  readonly outOfReach: ReadonlyArray<AnchoredThread>
}

export const threadsOn = (
  threads: ReadonlyArray<ReviewThread>,
  path: string,
  drawn: Drawn | null
): OnFile => {
  const mine = threadsIn(threads, path)
  if (drawn === null) return { inReach: mine, outOfReach: [] }

  const inReach: Array<AnchoredThread> = []
  const outOfReach: Array<AnchoredThread> = []

  for (const hung of mine) {
    // The last line of the range, because that is the line the row hangs off.
    // A range whose first line was drawn and whose last was not has nowhere to
    // open, which is the same nowhere as a range drawn on neither.
    const half = hung.at.side === "before" ? drawn.before : drawn.after
    ;(half.has(hung.at.line) ? inReach : outOfReach).push(hung)
  }

  return { inReach, outOfReach }
}

/**
 * Where the renderer should open a row for each of this file's threads.
 *
 * Off the last line of a range rather than the first, which is where GitHub
 * draws it: a remark about lines 137 to 140 opened above 137 separates the
 * reader from the code it is about by the whole of the block.
 */
export const threadNotes = (hung: ReadonlyArray<AnchoredThread>): ReadonlyArray<Note> =>
  hung.map(({ thread, at }) => ({
    key: threadKey(thread),
    side: sideOf(at.side),
    line: at.line
  }))
