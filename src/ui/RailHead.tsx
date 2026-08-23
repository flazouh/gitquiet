import { HERE, TINT } from "./dress"

/**
 * Which files the rail is holding: the pull request, the change it makes, or the
 * cases that prove it.
 *
 * Three rather than two because reading a change and reading its proof are two
 * passes, and only one of them had a home. A reader checking that a fix is
 * covered used to scroll past nine files to reach four; this is that pass,
 * named. Which files are tests is read off their paths, and `domain/testing.ts`
 * says what that can and cannot see.
 */
export type Kept = "all" | "code" | "tests"

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
 * shape this interface uses everywhere else for two ways of reading one thing.
 *
 * A pull request with no tests, or with nothing but tests, has one way to read
 * it and no head at all: a control that cannot change anything is a control
 * that costs a row and teaches nothing.
 */
export const RailHead = ({
  code,
  tests,
  kept,
  onPick
}: {
  readonly code: number
  readonly tests: number
  readonly kept: Kept
  readonly onPick: (kept: Kept) => void
}) => {
  if (code === 0 || tests === 0) return null

  const ways: ReadonlyArray<{ readonly kept: Kept; readonly said: string; readonly held: number }> =
    [
      { kept: "all", said: "All", held: code + tests },
      { kept: "code", said: "Code", held: code },
      { kept: "tests", said: "Tests", held: tests }
    ]

  return (
    <div
      role="group"
      aria-label="Which files are in the rail"
      className={`mx-1 mb-1 flex shrink-0 items-center overflow-hidden rounded-md ${TINT}`}
    >
      {ways.map((one) => (
        <button
          key={one.kept}
          type="button"
          aria-pressed={kept === one.kept}
          // The word and the number are one label: "Code, 5 files" heard aloud is
          // what pressing it leaves, which is the whole of what this control does.
          aria-label={`${one.said}, ${one.held} ${one.held === 1 ? "file" : "files"}`}
          onClick={() => onPick(one.kept)}
          className={`flex flex-1 items-center justify-center gap-1 px-1 py-0.5 text-xs tabular-nums ${
            kept === one.kept ? HERE : "text-ink-muted hover:text-ink"
          }`}
        >
          {one.said}
          <span className="text-ink-muted">{one.held}</span>
        </button>
      ))}
    </div>
  )
}
