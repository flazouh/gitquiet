import { Option } from "effect"
import type { Check, CheckState } from "../domain/PullRequest"
import { runIn } from "./steps"

/**
 * The runs a pull request's failing checks belong to.
 *
 * Only the failing ones, because this exists to answer one question and a check
 * that passed cannot have been tolerated. Distinct, because a workflow of twelve
 * jobs arrives as twelve checks under one run and the outcome is a property of
 * the run: the difference is twelve reads of a half-megabyte page or one.
 *
 * Anything not addressed as a job of a run is left out. A check from Netlify or
 * from an app has no Actions run behind it, so there is nothing to ask and no
 * `continue-on-error` in the world that could have produced it.
 */
export const runsBehind = (checks: ReadonlyArray<Check>): ReadonlyArray<string> => {
  const runs: Array<string> = []

  for (const check of checks) {
    if (check.state !== "failed") continue

    const run = runIn(check.url)
    if (Option.isNone(run) || runs.includes(run.value)) continue

    runs.push(run.value)
  }

  return runs
}

/**
 * The checks again, with a failure its own run carried on past said as tolerated.
 *
 * The whole signal, and it is a comparison rather than a field: GitHub reports a
 * job carrying `continue-on-error: true` as a `failure` conclusion exactly like
 * any other, and concludes the run around it a `success`. A run cannot succeed
 * with a job in it that actually failed, so a failing check under a run GitHub
 * called a success is a failure somebody wrote a workflow to carry on past.
 *
 * A run still going says nothing either way — its jobs have not been weighed yet —
 * and a run nothing came back for says nothing at all. Both leave the check as
 * GitHub reported it, which is the answer this interface gave before any of this
 * existed and the only safe way to be wrong: a real failure shown as one.
 */
export const tolerating = (
  checks: ReadonlyArray<Check>,
  standings: ReadonlyMap<string, CheckState>
): ReadonlyArray<Check> =>
  checks.map((check) => {
    if (check.state !== "failed") return check

    const run = runIn(check.url)
    if (Option.isNone(run)) return check

    return standings.get(run.value) === "succeeded"
      ? { ...check, state: "tolerated" as const }
      : check
  })
