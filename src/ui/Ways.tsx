import { type ArtName, useArt } from "./art"
import { TROUGH, wayIn } from "./dress"

/** One of the ways, as the switch needs it said. */
export type Way<Name extends string> = {
  /** What the call site calls this way, and what comes back when it is pressed. */
  readonly name: Name
  /**
   * The word for it, which is its label and its tooltip both.
   *
   * The one thing a glyph cannot say. It is the accessible name of the button
   * and the title a pointer resting on it reveals, so nothing about this switch
   * depends on a reader recognising a drawing.
   */
  readonly said: string
  readonly art: ArtName
}

export type WaysProps<Name extends string> = {
  readonly ways: ReadonlyArray<Way<Name>>
  readonly on: Name
  readonly onPick: (name: Name) => void
  /** What the group is choosing between, for a reader who arrives on it by key. */
  readonly label: string
}

/**
 * The two ways to look at the same thing, wherever this interface offers them.
 *
 * Three screens had written this switch three times and no two of them agreed.
 * The repository's file pane said Rendered and Source in a `bg-active` pair, the
 * file browser said Diff and Preview as filled buttons in a trough, and the
 * comment box said Write and Preview as raised tabs with a shadow. One question
 * — do you want the document or the text it is made of — asked in three shapes,
 * so a reader who learnt it in one place learnt nothing about the other two.
 *
 * Glyphs rather than words, which is what makes one switch fit all three. The
 * words could not be shared: a diff is not a source file and writing is not
 * reading, so each screen had its own pair and the pairs would not reduce. The
 * meanings do reduce, to two — the thing as it reads, and the thing as it is
 * written — and a glyph says a meaning. `eye` is the reading half in all three
 * places; `code`, `diff` and `write` are what the other half is on each screen.
 * The words survive as the label and the tooltip, so nothing is lost but width.
 *
 * A trough with the chosen one filled, which is the pack's own ladder rather
 * than a shape: `TINT` is one step up from the card for the well, `HERE` is the
 * next step for the answer. Neither is a colour and neither is a line, so this
 * follows a reader into every pack without naming a value.
 */
export const Ways = <Name extends string>({ ways, on, onPick, label }: WaysProps<Name>) => {
  const art = useArt()

  return (
    <div
      role="group"
      aria-label={label}
      className={TROUGH}
    >
      {ways.map((way) => {
        const Mark = art[way.art]
        const chosen = way.name === on

        return (
          <button
            key={way.name}
            type="button"
            aria-pressed={chosen}
            aria-label={way.said}
            title={way.said}
            onClick={() => onPick(way.name)}
            className={`flex h-6 w-7 items-center justify-center ${wayIn(chosen)}`}
          >
            <Mark size={14} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
