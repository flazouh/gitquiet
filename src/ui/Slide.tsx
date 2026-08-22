import type { Knob } from "../domain/Settings"

/**
 * A knob whose choices are a run of sizes, as one handle and the size it is on.
 *
 * The handle moves along the choices by their position in the list rather than
 * by their value, so the steps do not have to be evenly spaced and nothing here
 * has to parse what a choice means. Both places a setting is offered draw this;
 * each supplies its own frame, because a row in a dialog and a panel hanging off
 * a menu are not the same shape.
 */
export const Slide = ({
  knob,
  held,
  onPick,
  onPeek
}: {
  readonly knob: Knob<string, string>
  readonly held: string
  readonly onPick: (key: string, value: string) => void
  /**
   * What is being pointed at on the way past, for the picture beside it.
   *
   * Only the dialog has a picture; the menu has the handle and nothing to
   * update, so it leaves this out.
   */
  readonly onPeek?: (value: string) => void
}) => {
  const at = Math.max(
    0,
    knob.choices.findIndex((choice) => choice.value === held)
  )
  const now = knob.choices[at]

  return (
    <>
      <input
        type="range"
        aria-label={knob.label}
        min={0}
        max={knob.choices.length - 1}
        step={1}
        value={at}
        onChange={(event) => {
          const moved = knob.choices[Number(event.target.value)]
          if (moved === undefined) return
          onPick(knob.key, moved.value)
          onPeek?.(moved.value)
        }}
        className="h-1 min-w-0 flex-1 accent-accent-emphasis"
      />
      {/* The number stays put while the handle moves, and in figures of one
          width, so the row does not twitch as it is dragged. */}
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink">
        {now?.label}
      </span>
    </>
  )
}
