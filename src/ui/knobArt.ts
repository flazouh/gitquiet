import type { KnobKey } from "../domain/Settings"
import type { ArtName } from "./art"

/**
 * The glyph each knob wears in the settings panel.
 *
 * A panel of thirty rows is a wall of words, and a reader going back for the one
 * knob they changed last week reads every label above it to find it. A glyph
 * gives the eye something to run down the left edge instead, and a reader who
 * has opened this twice finds Whitespace by its shape.
 *
 * Kept beside the panel rather than on the knob in `Settings.ts`, because a
 * picture is this window's business: the same settings under a different set of
 * drawings are the same settings.
 *
 * Every knob and no more, said by the type rather than by a test: a knob added
 * without a glyph will not compile, and a key left here after its knob is gone
 * will not either.
 */
export const KNOB_ART: Readonly<Record<KnobKey, ArtName>> = {
  // The keyboard.
  profile: "command",

  // Appearance.
  appearance: "light-dark",
  pack: "palette",
  art: "glyphs",

  // The diff.
  layout: "columns",
  longLines: "wrap",
  syntax: "code",
  textSize: "text-size",
  lineNumbers: "numbers",
  fill: "fill",
  withinLine: "highlight",
  whitespace: "whitespace",
  marks: "counts",
  separators: "fold",
  context: "unfold",
  expansion: "chevron-down",
  prose: "file",

  // The file list.
  density: "rows",
  indent: "indent",
  icons: "glyphs",
  width: "widen",
  counts: "counts",
  ticks: "tick",
  flatten: "fold",
  folders: "files",
  // The files that prove a change, held in the rail or set aside — the same
  // checks glyph the passes at the head of the rail wear.
  tests: "check-passed",
  search: "search",
  sticky: "pinned",

  // The rest of the sheet, which the panel does not show but the same table
  // answers for.
  view: "pull-request",
  destination: "home",
  rail: "columns",
  issues: "issue",
  byItself: "sign-out"
}
