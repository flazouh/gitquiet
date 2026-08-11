import { forwardRef } from "react"
import { type ArtName, useArt } from "./art"
import { FIELD } from "./dress"

/**
 * How much room the field takes, which is the one thing its place decides.
 *
 * Two, because there are two kinds of place: a menu or a panel header, where the
 * field is one control among several and 28px keeps the row a row, and a screen
 * of its own, where it is the control and 32px is what a hand expects to hit.
 * Anything between the two is a third size nobody asked for.
 */
export type Room = "tight" | "roomy"

const ROOM: Record<Room, string> = {
  tight: "h-7 text-xs",
  roomy: "h-8 text-sm"
}

/** Room for the glyph, where there is one, and the ordinary inset where there is not. */
const INSET: Record<Room, { readonly with: string; readonly without: string }> = {
  tight: { with: "pl-7 pr-2", without: "px-2" },
  roomy: { with: "pl-8 pr-3", without: "px-3" }
}

export type FieldProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  /** What it invites, said once: it is the placeholder and the label both. */
  readonly label: string
  /** The glyph inside the left edge. A field for searching should have one. */
  readonly art?: ArtName
  readonly room?: Room
  readonly autoFocus?: boolean
  /** Escape, after this has emptied itself. Where a field is a whole panel's filter. */
  readonly onDone?: () => void
  /**
   * Command-Enter, for a field that is part of something being sent rather than
   * something being narrowed.
   *
   * Its own prop rather than left to `useKeys`, and the note above the component
   * says why: this field stops every keystroke at the input so that GitHub's
   * single-letter bindings cannot fire while somebody types, and `useKeys` skips
   * fields in any case. So a form whose title box did not answer this key would be
   * a form the reader has to leave the title box to send. Named as `Writing` names
   * it, because the two boxes of one form must agree about the key.
   */
  readonly onSend?: () => void
  /**
   * Whether a tab can land here. Off while the surface holding it is leaving:
   * there is nothing in a fading ghost worth typing into.
   */
  readonly reachable?: boolean
  readonly className?: string
}

/**
 * Every field in this interface, so there is one of them rather than seven.
 *
 * It is one component for three reasons, and the third is the one that could not
 * be solved anywhere else.
 *
 * The dress: `FIELD` and a size, so a filter in a menu and a filter in a panel
 * are the same object at two scales rather than two controls that grew apart.
 * Six inputs wrote their own padding and three of them disagreed by a pixel.
 *
 * The space: the glyph sits inside the left edge and the text is inset past it,
 * which is a measurement, and a measurement belongs in one file.
 *
 * The keys: GitHub binds single letters across the whole document — `t` opens
 * their file finder, `s` their search, `g` starts a pair — and a keystroke of
 * ours reaches them by bubbling up out of our root. Their own guard is to skip
 * events whose target is a field, and it does not save us: our tree draws its
 * rows in a shadow root, so an event from a field inside one is retargeted to
 * the host element on the way out and reads to them as a keystroke on a plain
 * div. Typing `test` in the tree opened their file finder on the `t`. Stopping
 * the event here, at the field, is the fix that does not depend on what they do
 * next: it never leaves our interface, so nothing outside it can bind a letter
 * we are typing. Our own keys are unaffected — `useKeys` listens in the capture
 * phase, on the way down, and skips anything typed into a field anyway.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(
  (
    {
      value,
      onChange,
      label,
      art,
      room = "roomy",
      autoFocus,
      onDone,
      onSend,
      reachable = true,
      className = ""
    },
    ref
  ) => {
    const Mark = useArt()[art ?? "search"]
    const inset = art === undefined ? INSET[room].without : INSET[room].with

    return (
      <div className={`relative flex min-w-0 items-center ${className}`}>
        {art === undefined ? null : (
          <Mark
            size={room === "tight" ? 12 : 14}
            aria-hidden="true"
            className={`pointer-events-none absolute ${
              room === "tight" ? "left-2" : "left-2.5"
            } text-ink-muted`}
          />
        )}
        <input
          ref={ref}
          type="text"
          value={value}
          aria-label={label}
          placeholder={label}
          // biome-ignore lint/a11y/noAutofocus: a picker exists to be typed into
          autoFocus={autoFocus}
          tabIndex={reachable ? undefined : -1}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Ours, and nobody else's. See the note above the component.
            event.stopPropagation()
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              onSend?.()
              return
            }
            if (event.key !== "Escape") return
            if (value !== "") onChange("")
            onDone?.()
          }}
          className={`${FIELD} ${ROOM[room]} ${inset} w-full min-w-0 outline-none`}
        />
      </div>
    )
  }
)

Field.displayName = "Field"
