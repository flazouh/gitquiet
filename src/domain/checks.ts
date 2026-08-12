import type { Check, JobStep } from "./PullRequest"

/**
 * A check that is finished and is not a complaint.
 *
 * Skipped and neutral count with the succeeded because that is what GitHub's
 * own summary counts them as: a job the workflow decided not to run is not a
 * job anybody is waiting on. Cancelled is deliberately not among them — it is
 * finished and it did not pass, which is a third thing.
 *
 * Nor is a tolerated failure, for the same reason and the other way round: it
 * is finished, nobody owes it a move, and it did not pass either. Counting it
 * green would say a job that fell over went fine.
 */
export const isGreen = (check: Check): boolean =>
  check.state === "succeeded" || check.state === "skipped" || check.state === "neutral"

/** A check that has not reached a verdict: under way, or not yet begun. */
export const isUnfinished = (check: Check): boolean =>
  check.state === "running" || check.state === "queued"

/**
 * The checks that failed and count, which is what a red pull request is red for.
 *
 * A failure its Workflow was told to carry on past is not among them, and it is
 * kept out by being a state of its own rather than by a second condition here.
 * That is deliberate: a flag beside the state would have to be remembered at
 * every count in this file, and this one was already counted three ways.
 */
export const failing = (checks: ReadonlyArray<Check>): ReadonlyArray<Check> =>
  checks.filter((check) => check.state === "failed")

/** The checks that failed and were allowed to, which are shown and not counted. */
export const tolerated = (checks: ReadonlyArray<Check>): ReadonlyArray<Check> =>
  checks.filter((check) => check.state === "tolerated")

/**
 * A step the runner added rather than one the workflow asked for.
 *
 * Every job begins with "Set up job", ends with "Complete job", and unwinds each
 * action it used as a "Post …" step. On a job that does one thing — run the tests
 * — those outnumber the work four to one, which is why the native view's step
 * list reads as mostly noise. Named by their names, because that is all GitHub
 * gives: the steps route marks nothing as belonging to the runner.
 */
export const isChore = (step: JobStep): boolean =>
  step.name === "Set up job" ||
  step.name === "Complete job" ||
  step.name.startsWith("Post ") ||
  step.name.startsWith("Pre ")

/** The steps the workflow was written to run, which is what a job amounts to. */
export const theWork = (steps: ReadonlyArray<JobStep>): ReadonlyArray<JobStep> =>
  steps.filter((step) => !isChore(step))

export const stillRunning = (checks: ReadonlyArray<Check>): number =>
  checks.filter(isUnfinished).length

/**
 * What a run of checks amounts to, as the four things it can be.
 *
 * A union rather than a handful of counts, because the counts are what went
 * wrong: the checks panel worked out its own headline from "how many failed"
 * and read a zero there as everything having passed, so a run with ten checks
 * still going announced itself green directly above a fold that said only two
 * of them had finished. Two places counting the same checks came to two
 * answers. There is one answer here, and rendering it is all the panel does.
 */
export type RunStanding =
  /** Something failed, which is the answer whatever else is happening. */
  | { readonly kind: "red"; readonly failed: number; readonly total: number }
  /**
   * Nothing failed and something has not finished.
   *
   * `started` separates a run under way from one merely queued, which is the
   * difference between a spinner that means something and one that does not.
   */
  | {
    readonly kind: "running"
    readonly waiting: number
    readonly total: number
    readonly started: boolean
  }
  /** Every one of them finished green. The only standing that may say so. */
  | { readonly kind: "passed"; readonly total: number }
  /**
   * Finished, nothing failed that counts, and not all green either.
   *
   * Two things arrive here: a check somebody cancelled, and a check whose Workflow
   * was told to carry on past its failure. Neither is a pass and neither is owed a
   * move, so the line says how many passed and leaves the claim of "all clear"
   * alone.
   */
  | { readonly kind: "stopped"; readonly green: number; readonly total: number }

export const howTheRunStands = (checks: ReadonlyArray<Check>): RunStanding => {
  const failed = failing(checks).length
  if (failed > 0) return { kind: "red", failed, total: checks.length }

  const waiting = stillRunning(checks)
  if (waiting > 0) {
    return {
      kind: "running",
      waiting,
      total: checks.length,
      started: checks.some((check) => check.state === "running")
    }
  }

  const green = checks.filter(isGreen).length
  return green === checks.length
    ? { kind: "passed", total: checks.length }
    : { kind: "stopped", green, total: checks.length }
}
