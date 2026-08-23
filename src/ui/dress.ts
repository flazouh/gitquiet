/**
 * How a small control is dressed, in one place, with no line anywhere in it.
 *
 * Borderless is the paradigm both shells already spend a file on — `src/ui/quiet.css`
 * on GitHub's page and `desktop/src/view/style.css` in the window, each taking
 * borders off components that shipped with them. Those files can only ever catch
 * what they know about, and every chip and field added since was written with an
 * outline and then quietly overridden twice. What separates things instead is a
 * fill, a corner and space, which is what these strings are.
 *
 * Dress only: no width, no height, no font size. Those belong to the place the
 * control stands, and a field in the Rail is not the size of a field on Home.
 *
 * The colours are the pack tokens rather than values, so a chip follows the reader
 * into dark, dimmed and every other pack without this file naming one.
 */

/**
 * The tint itself: what a control wears instead of an outline.
 *
 * One step of the pack's own ladder, so it is the same amount darker on white as it
 * is lighter in the dark. Everything below is this plus a shape.
 */
export const TINT = "bg-hover"

/** Somewhere a cursor goes: the tint says it is a place to type without drawing a box. */
export const FIELD = `rounded-md ${TINT} text-ink placeholder:text-ink-muted`

/**
 * A fact standing beside something larger: a count, a share, a release name.
 *
 * Size and leading together, which is the part that cannot be left to inherit.
 * The About row had a description at fourteen pixels, a fork count at the root's
 * sixteen and a contributor total at twelve, and three sizes on one line do not
 * read as a line. The twenty-pixel line box is what a face is tall, so text and
 * faces sit on one centre without either being nudged.
 */
export const ASIDE = "text-xs leading-5 text-ink-muted"

/** A word about the thing beside it — a branch, a state — held in a soft rectangle. */
export const CHIP = `rounded-md ${TINT} px-1.5 py-0.5`

/** The same, rounded all the way, for a word that is a label rather than a value. */
export const PILL = `rounded-full ${TINT} px-2 py-0.5`

/**
 * Where the reader is, or what they have switched on.
 *
 * The next step of the same ladder, not the accent. Every one of these states used to be a
 * saturated tint with a saturated word on it — `bg-accent-muted` under `text-ink-accent` — which
 * is the same claim made twice, and on a pack whose accent is a bright blue the current
 * destination read as a chip borrowed from another product. One tint says "you could press this",
 * the next says "this is the one", and full-strength ink separates them again: nothing under a
 * pointer is ever this dark.
 *
 * The accent is left to mean what it means everywhere else — a link, a notice, a number worth
 * reading — and a colour that marks one thing is worth more than a colour that marks six.
 *
 * Weight is the call site's: the Rail wants medium, the bar's tabs want semibold, and a badge
 * wants neither.
 */
export const HERE = "bg-active text-ink"

/**
 * The well a set of ways sits in, with the one in use filled.
 *
 * Two steps of the ladder above, in the arrangement this interface uses wherever
 * it offers one question with two or three answers: `TINT` for the well, `HERE`
 * for the answer. The shape was written out at each switch, and the switches
 * drifted — see `Ways.tsx`, which is the same argument about the glyphs inside
 * them. What each way says is the call site's, since a glyph, a word and a word
 * with a number beside it are all ways; the trough they sit in is not.
 */
export const TROUGH = `flex shrink-0 items-center overflow-hidden rounded-md ${TINT}`

/** What a way in that trough wears, filled or not. */
export const wayIn = (chosen: boolean): string =>
  chosen ? HERE : "text-ink-muted hover:text-ink"

/**
 * The section the reader is in, one step short of the page they are on.
 *
 * No fill, and that is the whole of the argument: both fills are spoken for. `TINT` is what
 * anything takes under a pointer and `HERE` is the page being read, so a third fill would have
 * to sit between two steps of a two-step ladder — and a reader would be comparing two greys a
 * centimetre apart to learn whether pressing this goes anywhere. The bar's tabs proved the cost
 * of not having this state: `HERE` on the Pull requests tab while the reader was on one pull
 * request read as a selection, and somebody asked why the list was highlighted.
 *
 * So the ink carries it instead. The tabs a reader is not in are muted, this one is at full
 * strength, and nothing filled means nothing claiming to be the page. GitHub marks the
 * containing section with a line under the word, which is the right idea in a material this
 * interface does not have: the top of this file exists to keep lines out, and a rule under one
 * tab would be the only one left in the strip.
 *
 * Weight is the call site's, as it is for `HERE`. Said aloud as well as painted, and not with
 * the same word: `aria-current="location"` is a link to the section holding the page, where
 * `page` is a link to the page itself.
 */
export const INSIDE = "text-ink"

/**
 * Something to press that is not the main move on the screen.
 *
 * No hover in here on purpose: it is `hover:bg-active` on a control that is always
 * live, and `enabled:hover:bg-active` on one that can be disabled, and a disabled
 * button that deepens under the pointer is a button promising something it will not
 * do. The call site knows which it is; this file does not.
 */
export const PRESSABLE = `rounded-md ${TINT}`

/**
 * The same, wearing nothing until it is pointed at.
 *
 * For a control standing inside something that is already a fill: a card's own inset,
 * a strip, a well. The tint is one step of the pack's ladder, and a step taken twice
 * in the same place is a second panel rather than a button — the copy button in a pull
 * request's header sat on the card's fill as a small raised square, which is a box on
 * an interface that spends this file avoiding them.
 *
 * The hover is the call site's, as it is above: the same string dresses an anchor,
 * where `enabled:` matches nothing.
 */
export const GHOST = "rounded-md"
