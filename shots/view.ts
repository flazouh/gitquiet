import { Effect, Option } from "effect"
import type { ReactNode } from "react"

/**
 * What a view has to be for the stage to photograph it.
 *
 * One entry per screen the extension has. The contract is deliberately small: a
 * name, a frame, and a function that returns the screen. Everything a screen needs
 * to be believable is the view's own business, and everything about capturing it is
 * the stage's.
 */
export type View = {
  /** Used in the URL, in the PNG's name, and nowhere a reader will see it. */
  readonly name: string
  /** Said on the landing page beside the picture. One sentence, no full stop needed. */
  readonly caption: string
  readonly width: number
  readonly height: number
  /**
   * Settings this view is photographed under, by their stored names.
   *
   * A screen whose picture depends on a choice — side-by-side diffs, a theme pack —
   * says so here rather than hoping the default happens to be right.
   */
  readonly chosen?: Record<string, unknown>
  /**
   * What has to be on the screen before the shutter opens, as a CSS selector.
   *
   * The stage's own check knows when a view is mounted, when the fonts are in and
   * when every image has settled. It cannot know that the thing worth photographing
   * arrived, and on the pull request that difference is the whole picture: the diff
   * engine is four and a half megabytes fetched after mount, so a screen that is
   * mounted, lettered and fully imaged is a photograph of a file pane with a header
   * and nothing under it. That capture was taken, twice, before this existed.
   *
   * Absent where a view has nothing that arrives late, which is most of them.
   */
  readonly ready?: string
  readonly draw: () => ReactNode
}

/**
 * The Chrome Web Store's own screenshot size.
 *
 * 1280 by 800 is one of the two they accept, and the larger. A view drawn at it
 * needs no scaling for the listing and is still sharp on the landing page, because
 * the capture is taken at double density and the store copy is reduced from that.
 */
export const STORE = { width: 1280, height: 800 } as const

/** A read that is already finished, which is every read on this stage. */
export const settled =
  <A,>(value: A) =>
  () =>
    Effect.succeed(value)

/** A screen asking what it remembered, told there is nothing, with no delay. */
export const nothingRemembered =
  <A,>() =>
  () =>
    Effect.succeed(Option.none<A>())

/** A screen asking what it remembered, handed the same thing the live read has. */
export const alreadyKnown =
  <A,>(value: A) =>
  () =>
    Effect.succeed(Option.some(value))
