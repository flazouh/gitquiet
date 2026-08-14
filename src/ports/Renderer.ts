/**
 * What a diff renderer is, said without any of the four and a half megabytes.
 *
 * The interface draws a pane around a renderer, and the renderer draws the code
 * inside it. Both halves need the same words for what they hand each other — a
 * side, a marked range, a row hung under a line — and neither should have to
 * import the other to get them. This is that vocabulary and nothing else: no
 * DOM is touched here, no module is fetched, and `@pierre/diffs` is not
 * mentioned.
 *
 * Which is what lets the pane be written against a renderer that does not exist
 * yet. A desktop build with its own highlighter satisfies these types, and the
 * pane cannot tell the difference.
 */

import { Data } from "effect"
import type { DiffChoices } from "../domain/choices"
import type { Pack } from "../domain/theme"

/** Which half of a diff a line belongs to: the old file, or the new one. */
export type DiffSide = "additions" | "deletions"

/** Lines the reader marked out, to say something about. */
export type Picked = {
  readonly side: DiffSide
  readonly from: number
  readonly to: number
}

/**
 * A row hung under a line of the diff: a comment box, a thread, an answer.
 *
 * The key is what the row is, not where it is — move a note to another line and
 * whatever is inside it, half-typed comment included, moves with it.
 */
export type Note = {
  readonly key: string
  readonly side: DiffSide
  readonly line: number
}

export type DiffHandle = {
  /** Renders again after the theme flips, since the colours are baked into the DOM. */
  readonly onThemeChange: (theme: "light" | "dark") => void
  /** Hangs a different set of rows under the code, leaving the code alone. */
  readonly showNotes: (notes: ReadonlyArray<Note>) => void
  /** Lets go of the marked lines, without waiting for a click elsewhere. */
  readonly unpick: () => void
  readonly destroy: () => void
}

export type DiffRequest = {
  /** A unified diff, as GitHub gives it: `@@` hunks and their context. */
  readonly patch: string
  readonly path: string
  readonly theme: "light" | "dark"
  /**
   * The colour pack the screens are wearing.
   *
   * The syntax knob can follow this (`match`) rather than One Dark or GitHub.
   * Absent only in tests that never ask about colours.
   */
  readonly pack?: Pack
  /** Everything the reader has chosen about how a diff is drawn. */
  readonly choices: DiffChoices
  /** Lines were dragged out, or the gutter's plus was clicked. Null on letting go. */
  readonly onPick?: (picked: Picked | null) => void
  /** The rows to hang under the code, in the order they should be created. */
  readonly notes?: ReadonlyArray<Note>
  /** Fills one row. Called per key; the element it returns is kept and reused. */
  readonly fillNote?: (key: string) => HTMLElement | undefined
}

/**
 * The renderer itself: one call, one handle back.
 *
 * Named here so the pane can hold one without knowing where it came from — an
 * extension URL, a bundle beside the page, a stub in a test.
 */
/**
 * The sheet the code is printed on, named so a container can change it.
 *
 * The page's own canvas unless something above the diff sets this, which is what
 * keeps a pull request's files sitting in the page rather than on it. The file
 * pane on a repository's front page does set it: a file being read there is a
 * document on the reading surface, beside a README and a tree that are not.
 *
 * A CSS variable rather than a field on the request, because the renderer writes
 * its colours onto its own host as inline styles, and an inline style is the one
 * thing a container cannot overrule. Inherited, it can.
 */
export const PAPER = "--diffs-paper"

export type DiffEngine = {
  readonly renderDiff: (container: HTMLElement, request: DiffRequest) => DiffHandle
}

/**
 * No renderer to be had.
 *
 * A real possibility rather than a formality: whoever loads it is fetching a
 * separately-built chunk over something, and a browser that declines leaves the
 * pane to say so rather than to hang on a spinner.
 */
export class DiffEngineUnavailable extends Data.TaggedError("DiffEngineUnavailable")<{
  readonly cause: unknown
}> {}
