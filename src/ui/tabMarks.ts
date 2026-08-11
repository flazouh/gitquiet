import type { ArtName } from "./art"

/**
 * Which glyph one of their repository tabs wears.
 *
 * The tabs are read off GitHub's own row rather than written down — see `theirNav.ts` — so
 * this cannot be a list of nine names either. It matches on the first word, which is what
 * survives the renaming they already did once: "Security" became "Security and quality",
 * and a rule keyed to the whole string would have dropped that glyph on the day it landed.
 *
 * Three of the nine need nothing new. Issues is an issue, Pull requests is a pull request
 * and Discussions is the pair of speech marks the interface already draws beside a comment
 * count, which is the argument for naming a set by meaning rather than by picture.
 */
const MARKS: ReadonlyArray<readonly [RegExp, ArtName]> = [
  [/^code/i, "code"],
  [/^issue/i, "issue"],
  [/^pull/i, "pull-request"],
  [/^discussion/i, "comments"],
  [/^action/i, "actions"],
  [/^project/i, "projects"],
  [/^wiki/i, "wiki"],
  [/^security/i, "security"],
  [/^insight/i, "insights"],
  [/^setting/i, "settings"]
]

/**
 * A dot for a tab nobody here has met.
 *
 * Their row grows: a tenth tab arrives in the menu without a line of ours changing, and one
 * row out of six starting two glyphs to the left of the others reads as a rendering fault
 * rather than as a tab we have no picture for.
 */
const UNKNOWN: ArtName = "dot"

export const tabMark = (name: string): ArtName =>
  MARKS.find(([said]) => said.test(name.trim()))?.[1] ?? UNKNOWN
