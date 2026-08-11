import { Option } from "effect"
import { useState } from "react"
import type { Kept } from "../app/kept"
import { isChore, theWork } from "../domain/checks"
import type { Check, JobStep } from "../domain/PullRequest"
import { useArt } from "./art"
import { type CheckLogs, logKey, type LogReach } from "./checkReads"
import { CHECK_TONE, checkArt } from "./Icon"
import { LogPanel } from "./LogPanel"
import { useReading } from "./reading"

/** A check's steps, held under the check's name. */
export type CheckSteps = Kept<string, ReadonlyArray<JobStep>>

/**
 * How long a step took, in the units their own view prints it in.
 *
 * Seconds up to a minute and minutes after that, because the question a duration
 * answers here is which step the job spends its time in, and "117s" makes that
 * arithmetic the reader's problem.
 */
const said = (seconds: number): string =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`

/**
 * What the job amounts to, counted over the work rather than the rows.
 *
 * Six rows and three steps is the ordinary case, not an odd one: the runner's
 * setup and teardown are half of every job's list. Counting them would make
 * every job look bigger than it is and every failure rarer than it is.
 */
const headline = (steps: ReadonlyArray<JobStep>): string => {
  const work = theWork(steps)
  const failed = work.filter((step) => step.state === "failed").length
  const counted = `${work.length} ${work.length === 1 ? "step" : "steps"}`

  return failed === 0 ? counted : `${counted}, ${failed} failed`
}

/** The log of one step, read only once its row has been opened. */
const StepLog = ({
  check,
  step,
  logs,
  reach
}: {
  readonly check: Check
  readonly step: JobStep
  readonly logs?: CheckLogs
  readonly reach?: LogReach
}) => {
  const reading = useReading(logs, logKey(check, step.number))

  if (logs === undefined) return null
  if (reading.step === "loading") return <p className="px-3 py-2 text-xs text-ink-muted">Reading the log…</p>
  if (reading.step === "failed") {
    return <p className="px-3 py-2 text-xs text-ink-muted">That log could not be read from here.</p>
  }
  if (reading.value.length === 0) {
    return <p className="px-3 py-2 text-xs text-ink-muted">GitHub keeps no log for this step.</p>
  }

  return (
    <div className="px-2 pb-2">
      <LogPanel lines={reading.value} {...reach} />
    </div>
  )
}

const StepRow = ({
  check,
  step,
  open,
  onToggle,
  logs,
  reach
}: {
  readonly check: Check
  readonly step: JobStep
  readonly open: boolean
  readonly onToggle: () => void
  readonly logs?: CheckLogs
  readonly reach?: LogReach
}) => {
  const art = useArt()
  const ChevronRight = art["chevron-right"]
  const Art = checkArt(art, step.state)
  const chore = isChore(step)

  return (
    // Nothing ruled between the steps: they are one per line at a fixed height, and
    // the hover answers where one ends at the only moment a reader asks.
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        {...(chore ? { "data-chore": "" } : {})}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-hover ${
          chore ? "text-ink-muted" : ""
        }`}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 text-ink-muted transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] ${open ? "rotate-90" : ""}`}
        />
        <Art
          size={12}
          className={`shrink-0 ${CHECK_TONE[step.state]}`}
          // Named only while it is turning. A finished step's outcome is in the
          // words beside it; a running one's is the icon, and nothing else says so.
          {...(step.state === "running" ? { "aria-label": `${step.name} is still running` } : {})}
        />
        <span className={`min-w-0 flex-1 truncate text-xs ${chore ? "" : "font-semibold"}`}>
          {step.name}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-ink-muted">
          {Option.getOrElse(Option.map(step.seconds, said), () => "")}
        </span>
      </button>
      {open ? <StepLog check={check} step={step} logs={logs} reach={reach} /> : null}
    </div>
  )
}

/**
 * A check as the steps it ran as, the way the Actions view lists them.
 *
 * A job is twelve named steps and one of them is the reason the check is red, so
 * this opens that one and leaves the rest shut — which is the difference between
 * this and the native view, where a failing job still opens as a wall of the
 * runner's own chatter and the reader does the finding.
 *
 * Nothing is read until a row is open. Ten steps is ten logs, the failing one is
 * the only log anybody wants, and fetching the other nine to hide them is nine
 * requests spent on nothing.
 */
export const CheckSteps = ({
  check,
  steps,
  logs,
  reach,
  shown
}: {
  readonly check: Check
  readonly steps: ReadonlyArray<JobStep>
  readonly logs?: CheckLogs
  readonly reach?: LogReach
  /** Steps whose log is already on screen above, so a row does not repeat it. */
  readonly shown?: ReadonlyArray<number>
}) => {
  const failed = steps.find((step) => step.state === "failed")
  const [opened, setOpened] = useState<ReadonlySet<number>>(
    () =>
      new Set(
        failed === undefined || shown?.includes(failed.number) === true ? [] : [failed.number]
      )
  )

  return (
    <div className="flex flex-col overflow-hidden rounded-md bg-canvas">
      {/* The count of steps, on the lighter surface it heads. The fill is the join,
          which keeps working while the list under it scrolls. */}
      <p className="bg-surface px-3 py-1.5 text-xs text-ink-muted">
        {headline(steps)}
      </p>
      {steps.map((step) => (
        <StepRow
          key={step.number}
          check={check}
          step={step}
          open={opened.has(step.number)}
          onToggle={() =>
            setOpened((held) => {
              const next = new Set(held)
              if (held.has(step.number)) next.delete(step.number)
              else next.add(step.number)
              return next
            })
          }
          logs={logs}
          reach={reach}
        />
      ))}
    </div>
  )
}
