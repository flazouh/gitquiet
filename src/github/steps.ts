import { Option, UndefinedOr } from "effect"
import type { CheckState, JobStep } from "../domain/PullRequest"

/** Their answer read as JSON, or nothing where it is not JSON at all. */
const parsed = UndefinedOr.liftThrowable(JSON.parse)

/**
 * The job number the steps route is keyed by, out of the job page's own markup.
 *
 * Not the number anything else here has: a check links to `/actions/runs/{run}/
 * job/{checkRun}`, and the steps route asked for that check run id answers 404.
 * The number it wants is internal, appears nowhere in any link we are given, and
 * is written into the page GitHub renders for the job as the route they read the
 * steps from themselves. So it is taken from there, by the shape of that route
 * rather than by any class name, since the route is the part that has to keep
 * working for their own view to work.
 */
export const jobIn = (html: string): Option.Option<string> => {
  const found = /\/jobs\/(\d+)\/steps/.exec(html)
  return found === null ? Option.none() : Option.some(found[1]!)
}

/**
 * The run a check's link belongs to, which is where its steps are asked for.
 *
 * A check's link is `/{owner}/{repo}/actions/runs/{run}/job/{checkRun}`, and the
 * steps hang off the run rather than off the job: `…/runs/{run}/jobs/{job}/steps`.
 * Written against the path either way, because GitHub gives this link absolute
 * on some routes and relative on others, and a check from anything other than
 * Actions has no run behind it at all.
 */
export const runIn = (url: string): Option.Option<string> => {
  const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0]!
  const found = /^(\/[^/]+\/[^/]+\/actions\/runs\/\d+)\/job\/\d+/.exec(path)

  return found === null ? Option.none() : Option.some(found[1]!)
}

/** Their two words for how a step went, as the one word a check is said in. */
const stateOf = (status: unknown, conclusion: unknown): CheckState => {
  if (status !== "completed") return status === "in_progress" ? "running" : "queued"

  switch (conclusion) {
    case "success":
      return "succeeded"
    case "cancelled":
      return "cancelled"
    case "skipped":
      return "skipped"
    // Timed out and awaiting approval both end the job without passing, and a
    // reader has one question about a step that did not pass, which is the log.
    case "failure":
    case "timed_out":
    case "action_required":
      return "failed"
    default:
      return "neutral"
  }
}

/**
 * How long it ran, from the two moments GitHub timestamps it with.
 *
 * Seconds, because that is the unit their own view prints and the unit the
 * difference between two steps is worth reading in. A step that has not finished
 * has no answer here rather than a wrong one — the elapsed time of a running
 * step is a number that goes stale the moment it is rendered.
 */
const secondsBetween = (from: unknown, to: unknown): Option.Option<number> => {
  if (typeof from !== "string" || typeof to !== "string") return Option.none()

  const began = Date.parse(from)
  const ended = Date.parse(to)
  if (Number.isNaN(began) || Number.isNaN(ended)) return Option.none()

  return Option.some(Math.max(0, Math.round((ended - began) / 1000)))
}

/**
 * A job's steps, out of what the steps route answers with.
 *
 * Written to come back empty rather than wrong, the same way the annotations
 * reader is: this is an internal route with no promise attached to it, so a step
 * missing the two things it is identified by is skipped, and an answer that is
 * not a list of steps at all — the `{"error":"Not Found"}` it gives for a job
 * that has none — is nothing, which the panel can say plainly.
 */
export const stepsIn = (raw: string): ReadonlyArray<JobStep> => {
  const said = parsed(raw)
  if (!Array.isArray(said)) return []

  return said.flatMap((one: unknown): ReadonlyArray<JobStep> => {
    if (typeof one !== "object" || one === null) return []

    const step = one as Record<string, unknown>
    if (typeof step.name !== "string" || typeof step.number !== "number") return []

    return [
      {
        number: step.number,
        name: step.name,
        state: stateOf(step.status, step.conclusion),
        seconds: secondsBetween(step.started_at, step.completed_at)
      }
    ]
  })
}
