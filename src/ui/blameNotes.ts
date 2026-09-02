import type { Span } from "../domain/blame"
import type { Note } from "../ports/Renderer"

/**
 * Where a Span's own heading hangs, in the renderer's terms.
 *
 * A row hangs *under* a line, so a heading for the Span that starts at line
 * `start` hangs under `start - 1`, the last line of whatever came before it.
 * The first Span has no line to hang under — nothing precedes line one — so
 * it is left out here and drawn as a static header above the renderer
 * instead. See `BlameScreen`.
 */
export const noteFor = (span: Span): Note | null =>
  span.start <= 1
    ? null
    : { key: keyOf(span), side: "additions", line: span.start - 1 }

/** A key stable across a redraw of the same Span, for the row the renderer keeps. */
export const keyOf = (span: Span): string => `span-${span.commit.oid}-${span.start}`

/** Every Span past the first, as the rows the renderer is told to hang. */
export const notesOf = (spans: ReadonlyArray<Span>): ReadonlyArray<Note> =>
  spans.map(noteFor).filter((note): note is Note => note !== null)
