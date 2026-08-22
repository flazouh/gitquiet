import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { keptReads } from "../app/kept"
import type { Check, JobStep, LogLine } from "../domain/PullRequest"
import { linesIn } from "../domain/logs"
import { logKey } from "./checkReads"
import { Checks } from "./Checks"

afterEach(cleanup)

const check = (name: string, state: Check["state"]): Check => ({
  name,
  state,
  isRequired: true,
  summary: "",
  url: `/o/r/actions/runs/1/job/${name.length}`,
  durationSeconds: 25
})

const step = (
  number: number,
  name: string,
  state: Check["state"],
  seconds: number | undefined = 1
): JobStep => ({
  number,
  name,
  state,
  seconds: seconds === undefined ? Option.none() : Option.some(seconds)
})

/** A job as the steps route gives one: the runner's own work around the job's. */
const job: ReadonlyArray<JobStep> = [
  step(1, "Set up job", "succeeded", 1),
  step(2, "Checkout code", "succeeded", 2),
  step(3, "Setup repo", "succeeded", 17),
  step(4, "Run tests", "failed", 48),
  step(7, "Post Setup repo", "succeeded", 0),
  step(9, "Complete job", "succeeded", 0)
]

const logOf = (texts: ReadonlyArray<string>): ReadonlyArray<LogLine> => linesIn(texts.join("\n"))

const showing = (
  one: Check,
  steps: ReadonlyArray<JobStep>,
  logs?: ReturnType<typeof keptReads<string, ReadonlyArray<LogLine>>>
) =>
  render(
    <Checks
      checks={[one]}
      library={keptReads<string, ReadonlyArray<never>>(() => Effect.succeed([]))}
      steps={keptReads<string, ReadonlyArray<JobStep>>(() => Effect.succeed(steps))}
      logs={logs}
    />
  )

describe("a check as the steps it ran as", () => {
  test("lists them in order, with what each one cost", async () => {
    showing(check("ci / test", "failed"), job)
    await userEvent.click(screen.getByText("ci / test"))

    expect(await screen.findByText("Run tests")).toBeDefined()
    expect(screen.getByText("Setup repo")).toBeDefined()
    expect(screen.getByText("17s")).toBeDefined()
    // Under a minute stays in seconds, as their own view has it.
    expect(screen.getByText("48s")).toBeDefined()
  })

  test("opens the step that failed, since it is the reason the check was opened", async () => {
    const logs = keptReads<string, ReadonlyArray<LogLine>>((key) =>
      Effect.succeed(logOf([`the log of ${key}`]))
    )

    showing(check("ci / test", "failed"), job, logs)
    await userEvent.click(screen.getByText("ci / test"))

    // Asked for by step number, which is the number GitHub files the log under.
    expect(await screen.findByText(`the log of ${logKey(check("ci / test", "failed"), 4)}`)).toBeDefined()
  })

  test("a passing job opens nothing, and gives up its steps on a click", async () => {
    const logs = keptReads<string, ReadonlyArray<LogLine>>((key) =>
      Effect.succeed(logOf([`the log of ${key}`]))
    )
    const green = job.map((one) => ({ ...one, state: "succeeded" as const }))

    showing(check("ci / test", "succeeded"), green, logs)
    await userEvent.click(screen.getByText("1 passed"))
    await userEvent.click(screen.getByText("ci / test"))

    expect(await screen.findByText("Setup repo")).toBeDefined()
    expect(screen.queryByText(/the log of/)).toBeNull()

    await userEvent.click(screen.getByText("Setup repo"))
    expect(
      await screen.findByText(`the log of ${logKey(check("ci / test", "succeeded"), 3)}`)
    ).toBeDefined()
  })

  test("keeps the runner's own steps out of the way of the workflow's", async () => {
    showing(check("ci / test", "failed"), job)
    await userEvent.click(screen.getByText("ci / test"))

    // The three the workflow was written to run are what it counts, not the six
    // rows: setup, teardown and "Complete job" are the runner talking about
    // itself, and they outnumber the work on nearly every job there is.
    expect(await screen.findByText("3 steps, 1 failed")).toBeDefined()
    expect(screen.getByText("Set up job").closest("[data-chore]")).not.toBeNull()
    expect(screen.getByText("Run tests").closest("[data-chore]")).toBeNull()
  })

  test("leaves the end of the log showing when GitHub keeps no steps", async () => {
    const tails = keptReads<string, ReadonlyArray<LogLine>>(() =>
      Effect.succeed(logOf(["the last thing it said"]))
    )

    render(
      <Checks
        checks={[check("ci / test", "failed")]}
        library={keptReads<string, ReadonlyArray<never>>(() => Effect.succeed([]))}
        steps={keptReads<string, ReadonlyArray<JobStep>>(() => Effect.succeed([]))}
        tails={tails}
      />
    )
    await userEvent.click(screen.getByText("ci / test"))

    expect(await screen.findByText("the last thing it said")).toBeDefined()
  })

  test("minutes once a step has run for one", async () => {
    showing(check("ci / test", "succeeded"), [step(4, "Perform CodeQL Analysis", "succeeded", 117)])
    await userEvent.click(screen.getByText("1 passed"))
    await userEvent.click(screen.getByText("ci / test"))

    expect(await screen.findByText("1m 57s")).toBeDefined()
  })

  test("says a step is still going rather than timing it", async () => {
    showing(check("ci / test", "running"), [
      step(3, "Setup repo", "succeeded", 4),
      step(4, "Run tests", "running", undefined)
    ])
    await userEvent.click(screen.getByText("0 passed, 1 other"))
    await userEvent.click(screen.getByText("ci / test"))

    await waitFor(() => {
      expect(screen.getByLabelText("Run tests is still running")).toBeDefined()
    })
  })
})
