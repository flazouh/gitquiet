import { Effect, Option } from "effect"
import type { CheckNote, CheckState } from "../../../src/domain/PullRequest"
import type { Job } from "../../../src/domain/run"
import { gathered } from "../../../src/domain/run"
import type { Listed } from "../../../src/domain/strand"
import { strandsIn } from "../../../src/domain/strand"
import { restEmpty, restRead } from "./api"

const STATES: Record<string, CheckState> = {
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
  waiting: "queued",
  completed: "succeeded"
}

const stateOf = (status: string, conclusion: string | null): CheckState =>
  conclusion !== null ? (STATES[conclusion] ?? "neutral") : (STATES[status] ?? "running")

const secondsOf = (from: string | null, to: string | null): number => {
  if (from === null || to === null) return 0
  const took = (Date.parse(to) - Date.parse(from)) / 1000
  return Number.isFinite(took) && took > 0 ? Math.round(took) : 0
}

type RestRun = {
  readonly id: number
  readonly html_url: string
  readonly name: string
  readonly path: string
  readonly run_number: number
  readonly display_title: string
  readonly status: string
  readonly conclusion: string | null
  readonly event: string
  readonly head_branch: string | null
  readonly run_started_at: string | null
  readonly created_at: string
  readonly updated_at: string
  readonly triggering_actor: { readonly login: string } | null
  readonly actor: { readonly login: string } | null
  readonly pull_requests: ReadonlyArray<{ readonly number: number }> | null
}

type RestJob = {
  readonly id: number
  readonly name: string
  readonly html_url: string
  readonly status: string
  readonly conclusion: string | null
  readonly started_at: string | null
  readonly completed_at: string | null
}

const listedOf = (one: RestRun): Listed => ({
  run: String(one.id),
  url: one.html_url,
  workflow: one.name,
  file: one.path,
  number: String(one.run_number),
  title: one.display_title,
  state: stateOf(one.status, one.conclusion),
  seconds: secondsOf(one.run_started_at ?? one.created_at, one.updated_at),
  startedAt: one.run_started_at ?? one.created_at,
  actor: one.triggering_actor?.login ?? one.actor?.login ?? "ghost",
  trigger: one.event,
  ref: one.head_branch === null ? null : { kind: "branch", name: one.head_branch },
  pullRequest: one.pull_requests?.[0] === undefined ? null : String(one.pull_requests[0].number)
})

export const readStrands = Effect.fn("readStrands")(function* (
  token: string,
  owner: string,
  repo: string
) {
  const listed = yield* restRead<{ readonly workflow_runs: ReadonlyArray<RestRun> }>(
    token,
    `/repos/${owner}/${repo}/actions/runs?per_page=25`
  )
  return strandsIn(listed.workflow_runs.map(listedOf))
})

export const readRun = Effect.fn("readRun")(function* (
  token: string,
  owner: string,
  repo: string,
  run: string
) {
  const [facts, jobs] = yield* Effect.all(
    [
      restRead<RestRun>(token, `/repos/${owner}/${repo}/actions/runs/${run}`),
      restRead<{ readonly jobs: ReadonlyArray<RestJob> }>(
        token,
        `/repos/${owner}/${repo}/actions/runs/${run}/jobs?per_page=100`
      )
    ],
    { concurrency: 2 }
  )

  const notes: Array<CheckNote> = []
  for (const job of jobs.jobs) {
    const listed = yield* restRead<
      ReadonlyArray<{
        readonly annotation_level: string
        readonly message: string
        readonly title: string | null
        readonly path: string
        readonly start_line: number | null
      }>
    >(token, `/repos/${owner}/${repo}/check-runs/${job.id}/annotations?per_page=50`)

    for (const one of listed) {
      notes.push({
        level:
          one.annotation_level === "failure" || one.annotation_level === "warning"
            ? one.annotation_level
            : "notice",
        where: one.title ?? one.path,
        message: one.message,
        at:
          one.start_line === null
            ? Option.none()
            : Option.some({ step: 1, line: one.start_line })
      })
    }
  }

  const state = stateOf(facts.status, facts.conclusion)
  const gathering = gathered(notes)
  return {
    run: {
      workflow: facts.name,
      title: facts.display_title,
      number: String(facts.run_number),
      state,
      seconds: secondsOf(facts.run_started_at ?? facts.created_at, facts.updated_at),
      trigger: facts.event,
      actor: facts.triggering_actor?.login ?? facts.actor?.login ?? "ghost",
      branch: facts.head_branch ?? "",
      pullRequest: facts.pull_requests?.[0] === undefined ? null : String(facts.pull_requests[0].number),
      startedAt: facts.run_started_at ?? facts.created_at
    },
    jobs: jobs.jobs.map(
      (one): Job => ({
        name: one.name,
        state: stateOf(one.status, one.conclusion),
        seconds: secondsOf(one.started_at, one.completed_at),
        url: one.html_url
      })
    ),
    notes: notes.map((one) => ({
      level: one.level,
      where: one.where,
      message: one.message,
      at: Option.getOrNull(one.at)
    })),
    gathering: gathering.map((one) => ({
      level: one.level,
      headline: one.headline,
      message: one.message,
      where: one.where,
      count: one.count,
      at: Option.getOrNull(one.at)
    })),
    presses: {
      mayRerun: facts.status === "completed",
      mayRerunFailed: facts.status === "completed" && facts.conclusion === "failure",
      mayCancel: facts.status === "in_progress" || facts.status === "queued"
    }
  }
})

export const rerunRun = Effect.fn("rerunRun")(function* (
  token: string,
  owner: string,
  repo: string,
  run: string,
  which: "all" | "failed"
) {
  const route =
    which === "failed"
      ? `/repos/${owner}/${repo}/actions/runs/${run}/rerun-failed-jobs`
      : `/repos/${owner}/${repo}/actions/runs/${run}/rerun`
  yield* restEmpty(token, route, "POST")
})

export const cancelRun = Effect.fn("cancelRun")(function* (
  token: string,
  owner: string,
  repo: string,
  run: string
) {
  yield* restEmpty(token, `/repos/${owner}/${repo}/actions/runs/${run}/cancel`, "POST")
})
