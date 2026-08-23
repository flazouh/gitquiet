import type { Apart, Held } from "../domain/testing"
import { splits } from "../domain/testing"
import { TROUGH, wayIn } from "./dress"

/**
 * The head of the rail: which of the three lists is under it.
 *
 * Above the files rather than in the band with the buttons, because it is about
 * the list and nothing else. In the band it had to be squeezed into the counts
 * themselves to stop the row moving under the hand on every press — the band is
 * one line, it does not get the window, and every word in it is a word taken off
 * Next and Seen. Here it is the width of the rail, it moves nothing when it is
 * pressed, and it sits where a reader looking for the missing files is already
 * looking.
 *
 * Each way wears the size of the list it would leave, so what a press does is
 * readable before it is pressed. A trough with the answer filled, which is the
 * shape this interface uses everywhere else for one question with a few answers.
 *
 * Where there is nothing to split there is no head at all, and `splits` is asked
 * rather than answered again here: the screen that decides which list to draw
 * asks the same question, and a control that disagrees with what it controls
 * leaves a reader on an empty rail with nothing to press.
 */
export const RailHead = ({
  split,
  kept,
  onPick
}: {
  readonly split: Apart
  readonly kept: Held
  readonly onPick: (kept: Held) => void
}) => {
  if (!splits(split)) return null

  const ways: ReadonlyArray<{ readonly held: Held; readonly said: string }> = [
    { held: "all", said: "All" },
    { held: "code", said: "Code" },
    { held: "tests", said: "Tests" }
  ]

  return (
    <div role="group" aria-label="Which files are in the rail" className={`${TROUGH} mx-1 mb-1`}>
      {ways.map((one) => {
        const held = split[one.held].length

        return (
          <button
            key={one.held}
            type="button"
            aria-pressed={kept === one.held}
            // The word and the number are one label: "Code, 5 files" heard aloud
            // is what pressing it leaves, which is the whole of what this does.
            aria-label={`${one.said}, ${held} ${held === 1 ? "file" : "files"}`}
            onClick={() => onPick(one.held)}
            className={`flex flex-1 items-center justify-center gap-1 px-1 py-0.5 text-xs tabular-nums ${wayIn(
              kept === one.held
            )}`}
          >
            {one.said}
            <span className="text-ink-muted">{held}</span>
          </button>
        )
      })}
    </div>
  )
}
