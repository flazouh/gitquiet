import type { Art } from "./art"

const SIDES = { small: 16, medium: 24, large: 32 } as const

/**
 * The Command key, drawn as the key.
 *
 * Octicons has no glyph for it. What it has is `CommandPaletteIcon`, a prompt and a caret, and
 * that is what the bar's badge was wearing: `>_K` where a reader's hand is looking for `⌘K`.
 * Close enough to pass a code review and wrong to anybody holding the keyboard — the icon names
 * the thing the key opens, not the key.
 *
 * Its own module for the reason `spinner.tsx` gives: the set that needs it is imported by
 * `art.tsx`, so a glyph defined there and read from the Octicons table is read before it exists.
 *
 * The loop rather than the character. `⌘` is a font's opinion, and in a cap beside a `K` it
 * lands a pixel low and a shade lighter than the letter next to it, because a text glyph carries
 * its own metrics into a box eighteen pixels tall. A stroke in `currentColor` is the same weight
 * as everything around it at every size.
 *
 * Saint John's Arms, which is what this shape is called: four loops around a square, the sign
 * for a place of interest on a Nordic map before Susan Kare put it on a keyboard.
 */
export const CommandKeyIcon: Art = ({ size = 16, className, "aria-label": label }) => {
  const side = typeof size === "number" ? size : SIDES[size]

  return (
    <svg
      // `img` with a label, because in a cap it is the only thing saying which key: a reader
      // hearing "K" alone would be told the wrong shortcut.
      role="img"
      aria-label={label ?? "Command"}
      width={side}
      height={side}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
    </svg>
  )
}
