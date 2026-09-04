import { Effect } from "effect"
import { checkRunIn } from "../../../src/github/annotations"
import type { Check } from "../../../src/domain/PullRequest"
import type { CheckFacts } from "../shared/wire"
import { linesIn } from "../../../src/domain/logs"
import { restRead, restText } from "./api"

const LEVELS: Record<string, "failure" | "warning" | "notice"> = {
  failure: "failure",
  warning: "warning",
  notice: "notice"
}

const STATES: Record<string, CheckFacts["state"]> = {
  success: "succeeded",
  failure: "failed",
  cancelled: "cancelled",
  skipped: "skipped",
  neutral: "neutral",
  timed_out: "failed",
  action_required: "failed",
  startup_failure: "failed",
  queued: "queued",
  in_progress: "running",
  pending: "running",
  waiting: "queued"
}

export const readNotes = Effect.fn("readNotes")(function* (
  token: string,
  owner: string,
  repo: string,
  check: Check
) {
  const run = checkRunIn(check)
  if (run === undefined) return []

  const listed = yield* restRead<
    ReadonlyArray<{
      readonly annotation_level: string
      readonly message: string
      readonly title: string | null
      readonly path: string
      readonly start_line: number | null
    }>
  >(token, `/repos/${owner}/${repo}/check-runs/${run}/annotations?per_page=50`)

  return listed.map((one) => ({
    level: LEVELS[one.annotation_level] ?? "notice",
    where: one.title ?? one.path,
    message: one.message,
    at: one.start_line === null ? null : { step: 1, line: one.start_line }
  }))
})

export const readSteps = Effect.fn("readSteps")(function* (
  token: string,
  owner: string,
  repo: string,
  check: Check
) {
  const run = checkRunIn(check)
  if (run === undefined) return []

  const job = yield* restRead<{
    readonly steps?: ReadonlyArray<{
      readonly number: number
      readonly name: string
      readonly status: string
      readonly conclusion: string | null
      readonly started_at: string | null
      readonly completed_at: string | null
    }>
  }>(token, `/repos/${owner}/${repo}/actions/jobs/${run}`)

  return (job.steps ?? []).map((one) => {
    const state =
      one.conclusion !== null
        ? (STATES[one.conclusion] ?? "neutral")
        : (STATES[one.status] ?? "running")
    const seconds =
      one.started_at === null || one.completed_at === null
        ? null
        : Math.max(0, Math.round((Date.parse(one.completed_at) - Date.parse(one.started_at)) / 1000))

    return { number: one.number, name: one.name, state, seconds }
  })
})

const logOf = Effect.fn("logOf")(function* (
  token: string,
  owner: string,
  repo: string,
  check: Check
) {
  const run = checkRunIn(check)
  if (run === undefined) return ""

  const text = yield* restText(token, `/repos/${owner}/${repo}/actions/jobs/${run}/logs`, "text/plain")
  if (text.startsWith("PK")) return ""
  return text
})

export const readLog = Effect.fn("readLog")(function* (
  token: string,
  owner: string,
  repo: string,
  check: Check,
  _step: number
) {
  const text = yield* logOf(token, owner, repo, check)
  return linesIn(text).map((line) => ({ at: line.at, text: line.text, tone: line.tone }))
})

export const readTail = Effect.fn("readTail")(function* (
  token: string,
  owner: string,
  repo: string,
  check: Check,
  keep: number
) {
  const all = linesIn(yield* logOf(token, owner, repo, check))
  return all.slice(Math.max(0, all.length - keep)).map((line) => ({
    at: line.at,
    text: line.text,
    tone: line.tone
  }))
})
