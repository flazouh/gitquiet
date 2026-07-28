import { Option } from "effect"
import type { DiffSide, Note } from "../diff/engine"
import type { ReviewThread, ThreadAnchor } from "../domain/PullRequest"

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

/** Every thread hung off a line of this file, in the order they arrived. */
export const threadsIn = (
  threads: ReadonlyArray<ReviewThread>,
  path: string
): ReadonlyArray<AnchoredThread> =>
  threads.flatMap((thread) =>
    Option.isSome(thread.at) && thread.at.value.path === path
      ? [{ thread, at: thread.at.value }]
      : []
  )

/**
 * Where the renderer should open a row for each of this file's threads.
 *
 * Off the last line of a range rather than the first, which is where GitHub
 * draws it: a remark about lines 137 to 140 opened above 137 separates the
 * reader from the code it is about by the whole of the block.
 */
export const threadNotes = (
  threads: ReadonlyArray<ReviewThread>,
  path: string
): ReadonlyArray<Note> =>
  threadsIn(threads, path).map(({ thread, at }) => ({
    key: threadKey(thread),
    side: sideOf(at.side),
    line: at.line
  }))
