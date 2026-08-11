import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { jobIn, runIn, stepsIn } from "./steps"

/**
 * What the steps route answers with, taken off ci / rpc-artifacts on octo-repo#1555.
 *
 * Trimmed in the middle and otherwise verbatim, including the two things a
 * reader has to survive: the numbering skips where the workflow skipped a step,
 * and every step carries the same log route we already fetch it by.
 */
const real = JSON.stringify([
  {
    id: "cf7a822d-45ef-439c-825e-13f2e8bdf8ce",
    name: "Set up job",
    status: "completed",
    conclusion: "success",
    number: 1,
    started_at: "2026-07-30T03:57:23.000+02:00",
    completed_at: "2026-07-30T03:57:25.000+02:00",
    change_id: 0,
    completed_log_lines: 0,
    log_url: "/octo-org/octo-repo/commit/3c79422/checks/90759107937/logs/1",
    is_background: false
  },
  {
    id: "dde176a0-d7c8-4bc9-9b98-c615dc751b97",
    name: "Perform CodeQL Analysis",
    status: "completed",
    conclusion: "success",
    number: 5,
    started_at: "2026-07-30T03:57:38.000+02:00",
    completed_at: "2026-07-30T03:59:35.000+02:00",
    change_id: 0,
    completed_log_lines: 0,
    log_url: "/octo-org/octo-repo/commit/3c79422/checks/90759107937/logs/5",
    is_background: false
  },
  {
    id: "42876292-d6c6-4932-bef1-c2ef1cb9f30a",
    name: "Post Perform CodeQL Analysis",
    status: "completed",
    conclusion: "success",
    number: 7,
    started_at: "2026-07-30T03:59:35.000+02:00",
    completed_at: "2026-07-30T03:59:35.000+02:00",
    change_id: 0,
    completed_log_lines: 0,
    log_url: "/octo-org/octo-repo/commit/3c79422/checks/90759107937/logs/7",
    is_background: false
  }
])

const one = (fields: Record<string, unknown>) =>
  stepsIn(
    JSON.stringify([
      {
        name: "Run tests",
        status: "completed",
        conclusion: "success",
        number: 4,
        started_at: "2026-07-30T03:57:23.000+02:00",
        completed_at: "2026-07-30T03:57:48.000+02:00",
        ...fields
      }
    ])
  )[0]

describe("reading a job's steps", () => {
  test("keeps GitHub's own numbering, gaps and all, because a log is fetched by it", () => {
    expect(stepsIn(real).map((step) => step.number)).toEqual([1, 5, 7])
  })

  test("names them as the native view does", () => {
    expect(stepsIn(real).map((step) => step.name)).toEqual([
      "Set up job",
      "Perform CodeQL Analysis",
      "Post Perform CodeQL Analysis"
    ])
  })

  test("times a finished step to the second", () => {
    expect(stepsIn(real)[1]?.seconds).toEqual(Option.some(117))
    expect(stepsIn(real)[2]?.seconds).toEqual(Option.some(0))
  })

  test("a step still going has no duration to give", () => {
    const step = one({ status: "in_progress", conclusion: null, completed_at: null })

    expect(step?.state).toBe("running")
    expect(step?.seconds).toEqual(Option.none())
  })

  test("a step not yet begun is queued", () => {
    expect(one({ status: "queued", conclusion: null, started_at: null, completed_at: null })?.state).toBe(
      "queued"
    )
  })

  test("says what became of a step in the words a check is already said in", () => {
    expect(one({ conclusion: "failure" })?.state).toBe("failed")
    expect(one({ conclusion: "cancelled" })?.state).toBe("cancelled")
    expect(one({ conclusion: "skipped" })?.state).toBe("skipped")
    expect(one({ conclusion: "neutral" })?.state).toBe("neutral")
    // Both of these ended the job as surely as an exit code did.
    expect(one({ conclusion: "timed_out" })?.state).toBe("failed")
    expect(one({ conclusion: "action_required" })?.state).toBe("failed")
  })

  test("comes back empty rather than wrong when the answer is not a list of steps", () => {
    expect(stepsIn("")).toEqual([])
    expect(stepsIn("not json at all")).toEqual([])
    expect(stepsIn(JSON.stringify({ error: "Not Found" }))).toEqual([])
  })

  test("skips a step it cannot name or number, and keeps the ones it can", () => {
    const steps = stepsIn(
      JSON.stringify([
        { status: "completed", conclusion: "success", number: 1 },
        { name: "Run tests", status: "completed", conclusion: "success", number: 2 }
      ])
    )

    expect(steps.map((step) => step.name)).toEqual(["Run tests"])
  })
})

describe("finding the job the steps belong to", () => {
  /**
   * The number the route is keyed by is not the one our links carry — a check
   * links to `/job/90759107937`, and asking the steps route for that answers
   * 404. The number it wants appears only in the job page's own markup.
   */
  test("takes it out of the route the job page names", () => {
    const html = `<div><copilot-actions-log-summary
      data-steps-url="/octo-org/octo-repo/actions/runs/30507091863/jobs/72839227785/steps?change_id=0"
    ></copilot-actions-log-summary></div>`

    expect(jobIn(html)).toEqual(Option.some("72839227785"))
  })

  test("has nothing to give for a page that names no such route", () => {
    expect(jobIn("<html><body>Not found</body></html>")).toEqual(Option.none())
  })
})

describe("the run a check's steps hang off", () => {
  test("is read the same whether GitHub gave the link whole or as a path", () => {
    const run = Option.some("/octo-org/octo-repo/actions/runs/30507091863")

    expect(runIn("/octo-org/octo-repo/actions/runs/30507091863/job/90759107937?pr=1555")).toEqual(run)
    expect(
      runIn("https://github.com/octo-org/octo-repo/actions/runs/30507091863/job/90759107937")
    ).toEqual(run)
  })

  test("is nothing for a check that did not come from Actions", () => {
    expect(runIn("https://circleci.com/gh/octo-org/octo-repo/4211")).toEqual(Option.none())
    expect(runIn("")).toEqual(Option.none())
  })
})
