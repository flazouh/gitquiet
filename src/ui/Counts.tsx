import type { Apart, Held } from "../domain/testing"
import { sizeOf } from "../domain/workingSet"
import { TINT } from "./dress"

/**
 * How much of what was added is proof, drawn rather than counted.
 *
 * A pull request of nine hundred lines where seven hundred are a table of cases
 * is a small change and a long proof, and two numbers make the reader do
 * arithmetic before they know which they are looking at. A run along a track
 * says it at a glance: a short run means most of this is cases, and the change
 * itself is small enough to read now.
 *
 * The ink rather than a status colour. Green already means added, and it is on a
 * bar a few pixels along this same row where it counts how far through the
 * review a reader is; a second green bar meaning a different thing is a band
 * that has to be learnt twice. A share of a whole is not a status.
 */
const Ratio = ({ change, proof }: { readonly change: number; readonly proof: number }) => {
  const added = change + proof
  if (added === 0) return null

  return (
    // No width of its own to earn: forty pixels beside the numbers, shown
    // whenever they are. It had a second breakpoint at forty rem, and the band
    // in a normal window measures thirty-nine and a half — so the drawing that
    // was the reason for the numbers being here at all never appeared.
    <span
      aria-hidden
      className={`h-1 w-10 shrink-0 overflow-hidden rounded-full ${TINT}`}
    >
      <span
        className="block h-full bg-ink-muted"
        style={{ width: `${Math.round((change / added) * 100)}%` }}
      />
    </span>
  )
}

/**
 * How big the change is, at the start of the band.
 *
 * A fact about the whole set, first in the row that belongs to the whole set,
 * and the first thing a reader deciding whether to open this now asks for. It
 * says nothing and does nothing else: the switch that used to be folded into
 * these numbers is at the head of the rail, beside the list it changes.
 *
 * The numbers are the numbers of the list the rail is drawing, so they never
 * disagree with the rows beneath them. Beside them, where there is proof to
 * speak of, is the share of the added lines that is proof — a fact about the
 * pull request rather than about the rail, which is why it stays put while the
 * numbers change.
 *
 * The bar is drawn and the words are read: what it says lives in the title of
 * the whole line, so a reader who hovers anywhere over the counts is told, and a
 * reader who cannot see it is told the same thing rather than nothing.
 */
export const Counts = ({ split, kept }: { readonly split: Apart; readonly kept: Held }) => {
  const size = sizeOf(split[kept])
  const change = sizeOf(split.code).added
  const proof = sizeOf(split.tests).added

  return (
    <span
      title={
        proof > 0 && change + proof > 0
          ? `${proof} of the ${change + proof} added lines are tests`
          : undefined
      }
      className="hidden shrink-0 items-center gap-2 @[36rem]/band:flex"
    >
      {/* Whole or not at all. Truncated, this reads "2.." — a number cut in half
          is worse than the same number left out, since a reader cannot tell 2
          files from 24. */}
      <span className="shrink-0 text-xs text-ink-muted tabular-nums">
        {`${split[kept].length} changed`} <span className="text-pass">+{size.added}</span>{" "}
        <span className="text-fail">−{size.deleted}</span>
      </span>
      {split.code.length > 0 && split.tests.length > 0 ? (
        <Ratio change={change} proof={proof} />
      ) : null}
    </span>
  )
}
