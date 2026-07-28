import type { Chord } from "../keys/commands"

/** `Escape` is what the browser calls it and `Esc` is what a key cap says. */
const capOf = (chord: Chord): string => (chord === "Escape" ? "Esc" : chord)

/**
 * A key, drawn as one.
 *
 * On a button as well as in the sheet: a shortcut nobody is told about is a
 * shortcut nobody uses, and the moment to learn that `j` moves on is while
 * reaching for the button that does it. The cap is quiet enough to skip and
 * close enough to read, so the button still says what it does first.
 *
 * `onEmphasis` for a cap sitting on a filled button, where the sheet's borders
 * would disappear into the fill: a darkening of what is underneath reads as an
 * inset key on any colour, which the same grey does not.
 */
export const Cap = ({
  chord,
  tone = "plain"
}: {
  readonly chord: Chord
  readonly tone?: "plain" | "onEmphasis"
}) => (
  <kbd
    className={`rounded-xs px-1 py-0.5 font-mono text-[0.6875rem] leading-none ${
      tone === "onEmphasis"
        ? "bg-black/20 text-ink-on-emphasis"
        : "border border-line bg-surface text-ink"
    }`}
  >
    {capOf(chord)}
  </kbd>
)
