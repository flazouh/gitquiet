import type { ChangedFile } from "../domain/PullRequest"
import { TINT } from "./dress"

const total = (files: ReadonlyArray<ChangedFile>, of: "linesAdded" | "linesDeleted"): number =>
  files.reduce((sum, file) => sum + file[of], 0)

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
    <span
      aria-hidden
      title={`${proof} of the ${added} added lines are tests`}
      className={`hidden h-1 w-10 shrink-0 overflow-hidden rounded-full ${TINT} @[40rem]/band:block`}
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
 * The numbers are the numbers of what the rail is showing, so they never
 * disagree with the rows beneath them. Beside them, where there is proof to
 * speak of, is the share of the added lines that is proof — a fact about the
 * pull request rather than about the rail, which is why it stays put while the
 * numbers change.
 */
export const Counts = ({
  onRail,
  code,
  tests
}: {
  /** What the rail is drawing now, which is what the numbers are about. */
  readonly onRail: ReadonlyArray<ChangedFile>
  readonly code: ReadonlyArray<ChangedFile>
  readonly tests: ReadonlyArray<ChangedFile>
}) => (
  <span className="hidden shrink-0 items-center gap-2 @[36rem]/band:flex">
    {/* Whole or not at all. Truncated, this reads "2.." — a number cut in half
        is worse than the same number left out, since a reader cannot tell 2
        files from 24. */}
    <span className="shrink-0 text-xs text-ink-muted tabular-nums">
      {`${onRail.length} changed`} <span className="text-pass">+{total(onRail, "linesAdded")}</span>{" "}
      <span className="text-fail">−{total(onRail, "linesDeleted")}</span>
    </span>
    {code.length > 0 && tests.length > 0 ? (
      <Ratio change={total(code, "linesAdded")} proof={total(tests, "linesAdded")} />
    ) : null}
  </span>
)
