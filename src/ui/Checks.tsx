import { AlertFillIcon, CheckCircleFillIcon, ChevronRightIcon } from "@primer/octicons-react"
import { useState } from "react"
import { failing, howTheRunStands, isGreen, type RunStanding } from "../domain/checks"
import type { Check } from "../domain/PullRequest"
import {
  CheckDialog,
  type CheckLogs,
  type CheckNotes,
  type CheckTails,
  type LogReach
} from "./CheckDialog"
import { CHECK_TONE, checkArt } from "./Icon"
import { NEAR, useNearby } from "./near"
import { Section } from "./Section"

/**
 * The one line above the checks, which is the standing put into words.
 *
 * A branch per standing and nothing else: which of them applies is no longer a
 * question this file answers. It used to be, and it answered wrong — a run with
 * ten of its twelve checks still going read "All 12 checks passed" because the
 * only thing counted here was how many had failed.
 */
const ChecksSummary = ({ standing }: { readonly standing: RunStanding }) => {
  switch (standing.kind) {
    case "red":
      return (
        <span className={`flex items-center gap-1.5 ${CHECK_TONE.failed}`}>
          <AlertFillIcon size={12} />
          {`CI is red — ${standing.failed} of ${standing.total} failing`}
        </span>
      )
    case "running": {
      // Turning only while something is actually turning. A run whose every
      // check is merely queued has not begun, and a spinner over it is the same
      // kind of small lie as calling it passed.
      const Art = checkArt(standing.started ? "running" : "queued")
      return (
        <span className={`flex items-center gap-1.5 ${CHECK_TONE.running}`}>
          {/* Named apart from the rows' own spinners: this one stands for the
              whole run, and sharing their label would make the section read as
              having one more running check than it has. */}
          <Art size={12} aria-label="Checks still running" />
          {`${standing.waiting} of ${standing.total} still running`}
        </span>
      )
    }
    case "passed":
      return (
        <span className="flex items-center gap-1.5">
          <CheckCircleFillIcon size={12} className={CHECK_TONE.succeeded} />
          {`All ${standing.total} ${standing.total === 1 ? "check" : "checks"} passed`}
        </span>
      )
    case "stopped":
      return (
        <span className="flex items-center gap-1.5">
          <CheckCircleFillIcon size={12} />
          {`${standing.green} of ${standing.total} passed, none failing`}
        </span>
      )
  }
}

const CheckRow = ({ check, onOpen }: { readonly check: Check; readonly onOpen: () => void }) => {
  const Art = checkArt(check.state)

  return (
    <button
      type="button"
      onClick={onOpen}
      {...{ [NEAR]: check.name }}
      className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-hover"
    >
      <Art size={12} className={`shrink-0 translate-y-0.5 ${CHECK_TONE[check.state]}`} />
      <span className="shrink-0 text-xs font-semibold">{check.name}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{check.summary}</span>
    </button>
  )
}

/**
 * Whether the build is red, said in the first four words.
 *
 * Only the failures are listed. Twenty-nine green checks are worth one line
 * saying they are green; the two red ones are the reason anyone opened this.
 */
export const Checks = ({
  checks,
  library,
  logs,
  tails,
  reach
}: {
  readonly checks: ReadonlyArray<Check>
  /** Reads what GitHub wrote against a check, when anything is wired to. */
  readonly library?: CheckNotes
  /** Reads the log a note points into, when anything is wired to. */
  readonly logs?: CheckLogs
  /** Reads the end of a whole log, for checks no note points into. */
  readonly tails?: CheckTails
  /** What a file named in a log can be opened as. */
  readonly reach?: LogReach
}) => {
  const [opened, setOpened] = useState<Check | undefined>(undefined)

  // Read on the way past. A red check is nearly always clicked once the eye
  // reaches it, and the reading takes about as long as that decision does.
  const nearby = useNearby<string>({
    onNear: (name) => library?.warm(name),
    enabled: library !== undefined
  })

  const standing = howTheRunStands(checks)
  const red = failing(checks)
  const rest = checks.filter((check) => check.state !== "failed")
  // Counted with the domain's own predicate, so the fold and the line above it
  // cannot come to two answers about the same checks. They used to.
  const passed = rest.filter(isGreen).length

  if (checks.length === 0) {
    return (
      <Section name="Checks">
        <p className="px-3 py-2 text-sm text-ink-muted">Nothing has run yet</p>
      </Section>
    )
  }

  return (
    <Section
      name="Checks"
      tone={standing.kind === "red" ? "bad" : "plain"}
      summary={<ChecksSummary standing={standing} />}
    >
      <div ref={nearby}>
      {/* Failures open, everything else behind one line: a green check has
          nothing to say, and thirty of them said at once are a wall. */}
      {red.map((check) => (
        <CheckRow key={check.name} check={check} onOpen={() => setOpened(check)} />
      ))}
      {rest.length === 0 ? null : (
        <details className="group border-t border-line-muted first:border-t-0">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs text-ink-muted hover:bg-hover [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon
              size={12}
              className="shrink-0 transition-transform duration-150 group-open:rotate-90"
            />
            {passed === rest.length
              ? `${passed} passed`
              : `${passed} passed, ${rest.length - passed} other`}
          </summary>
          {rest.map((check) => (
            <CheckRow key={check.name} check={check} onOpen={() => setOpened(check)} />
          ))}
        </details>
      )}
      </div>
      {opened === undefined ? null : (
        <CheckDialog
          check={opened}
          library={library}
          logs={logs}
          tails={tails}
          reach={reach}
          onClose={() => setOpened(undefined)}
          // A dialog for another check is another reading, and holding the
          // first one's state through the swap would show its notes under the
          // second one's name.
          key={opened.name}
        />
      )}
    </Section>
  )
}
