import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { CheckNote } from "../domain/PullRequest"
import { type Job, type Run, type RunOpening, gathered, tolerating } from "../domain/run"
import { RunScreen } from "./RunScreen"
import { Toasts } from "./Toasts"

afterEach(cleanup)

const reference = {
  repo: { owner: "octo-org", repo: "octo-repo" },
  run: "30866145080",
  attempt: null,
  job: null
}

const run: Run = {
  workflow: "ci",
  title: "fix(cli): make app {harness} handle other providers and stored credentials",
  number: "9816",
  state: "failed",
  seconds: 234,
  trigger: "pull request",
  actor: "devin-ai-integration[bot]",
  branch: "fix-harness-layerb",
  pullRequest: "1756",
  startedAt: "2026-08-04T00:37:11Z"
}

const job = (name: string, state: Job["state"], seconds: number): Job => ({
  name,
  state,
  seconds,
  url: `/octo-org/octo-repo/actions/runs/30866145080/job/9185833${name.length}`
})

/* The twelve jobs of the worked run: ten green, one real failure, one gate. */
const jobs: ReadonlyArray<Job> = [
  job("lint", "succeeded", 62),
  job("lintcn", "succeeded", 65),
  job("pr-description", "succeeded", 16),
  job("test", "succeeded", 220),
  job("integration-test", "failed", 171),
  job("process-test", "succeeded", 27),
  job("typecheck", "succeeded", 37),
  job("bundle", "succeeded", 30),
  job("architecture", "succeeded", 46),
  job("effect-diagnostics", "succeeded", 41),
  job("acp-artifacts", "succeeded", 14),
  job("ci-complete", "failed", 3)
]

const note = (message: string, where: string, level: CheckNote["level"]): CheckNote => ({
  level,
  where,
  message,
  at: Option.none()
})

const THE_ASSERTION =
  'Expected to contain: "App dev runtime listening"\nReceived: "[app-runtime] listening on http://127.0.0.1:35681"'

/*
 * The fifteen notes of the worked run, labelled the way GitHub labels them, which is not
 * one way. A note linked to a log carries the job's name; a note linked to a file carries
 * the rule's name instead. So the assertion that broke the run is labelled
 * `error: expect(received).toContain(expected):` and cannot be tied to `integration-test`
 * from this page at all. Read off the real markup, not assumed.
 */
const notes: ReadonlyArray<CheckNote> = [
  note("Process completed with exit code 1.", "architecture", "failure"),
  note("Process completed with exit code 1.", "integration-test", "failure"),
  note(THE_ASSERTION, "error: expect(received).toContain(expected):", "failure"),
  note("Process completed with exit code 1.", "ci-complete", "failure"),
  note("Node.js 20 is deprecated.", "lintcn", "warning"),
  ...Array.from({ length: 10 }, () =>
    note("This Schema number API accepts `NaN`, `Infinity`, and `-Infinity`.", "schemaNumber:", "notice")
  )
]

const opening: RunOpening = {
  run,
  jobs,
  notes,
  gathering: gathered(notes),
  presses: { mayRerun: false, mayRerunFailed: false, mayCancel: false }
}

const screenOf = (props: Partial<React.ComponentProps<typeof RunScreen>> = {}) => (
  <RunScreen
    reference={reference}
    load={() => Effect.succeed(opening)}
    onStepAside={() => {}}
    {...props}
  />
)

describe("what a failed run says first", () => {
  /*
   * The whole point of the screen, and the thing GitHub's own page does not do: on run
   * 30866145080 their first screen held twelve job nodes, a four-field summary and no
   * error text. The assertion was three clicks away.
   */
  test("puts the assertion that broke the run on the screen", async () => {
    render(screenOf())

    await waitFor(() =>
      expect(screen.getByText('Expected to contain: "App dev runtime listening"')).toBeDefined()
    )
  })

  /*
   * Above the failing jobs, not under them. The notes are the answer and the job names are
   * where to go next, so a reader who reads downwards meets the answer first.
   */
  test("puts the assertion above the name of the job that failed", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByRole("region", { name: "Fault" })).toBeDefined())

    const said = screen.getByRole("region", { name: "Fault" }).textContent ?? ""
    expect(said.indexOf("App dev runtime listening")).toBeLessThan(said.indexOf("integration-test"))
  })

  /*
   * Within the Fault, because the name is on the screen twice and means two things. The
   * row is where to go; the chip on the "Process completed with exit code 1." note is one
   * of the three places that sentence was said. Both are worth having and only one of
   * them is this.
   */
  test("names the job that failed", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByRole("region", { name: "Fault" })).toBeDefined())
    expect(within(screen.getByRole("region", { name: "Fault" })).getByText("integration-test"))
      .toBeDefined()
  })

  test("names the run and the workflow it is of", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(run.title)).toBeDefined())
    expect(screen.getByText("#9816")).toBeDefined()
    expect(screen.getByText("ci")).toBeDefined()
  })

  test("says the branch, the actor and the pull request on one line", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText("fix-harness-layerb")).toBeDefined())
    expect(screen.getByText("devin-ai-integration[bot]")).toBeDefined()
    expect(screen.getByText("#1756")).toBeDefined()
  })
})

describe("the jobs of a run", () => {
  test("counts the ten that passed rather than listing them", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(/10 passed/)).toBeDefined())
  })

  test("gives no row to a job that passed", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(/10 passed/)).toBeDefined())
    expect(screen.queryByText("typecheck")).toBeNull()
    expect(screen.queryByText("acp-artifacts")).toBeNull()
  })

  test("gives a row to both failures, in the order they ran", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByRole("region", { name: "Fault" })).toBeDefined())

    const rows = within(screen.getByRole("region", { name: "Fault" })).getAllByRole("link")
    expect(rows.map((row) => row.textContent)).toEqual([
      "integration-test2m 51s",
      "ci-complete3s"
    ])
  })

  /*
   * The run this is drawn from is measured: run 31641974931 of
   * `flazouh/ghpro-scratch` concluded a success with a job that answered
   * `conclusion: "failure"`, because the workflow carried `continue-on-error: true`
   * on it. GitHub paints that job the red it paints a real failure, which is
   * [#15452](https://github.com/orgs/community/discussions/15452) and its 316
   * upvotes.
   */
  test("gives a tolerated failure a row of its own, and never a Fault", async () => {
    render(
      screenOf({
        load: () =>
          Effect.succeed({
            ...opening,
            run: { ...run, state: "succeeded" as const },
            jobs: tolerating("succeeded", [
              job("lint", "succeeded", 62),
              job("flaky-e2e", "failed", 44)
            ])
          })
      })
    )

    await waitFor(() => expect(screen.getByText("flaky-e2e")).toBeDefined())
    expect(screen.queryByRole("region", { name: "Fault" })).toBeNull()
    expect(screen.getByText(/1 allowed to fail/)).toBeDefined()
  })

  test("counts what was skipped, which is never a row", async () => {
    render(
      screenOf({
        load: () =>
          Effect.succeed({
            ...opening,
            jobs: [...jobs, job("release", "skipped", 0), job("publish", "skipped", 0)]
          })
      })
    )

    await waitFor(() => expect(screen.getByText(/2 skipped/)).toBeDefined())
    expect(screen.queryByText("release")).toBeNull()
  })
})

describe("the notes of a run", () => {
  test("makes ten copies of one lint opinion into one row that counts them", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(/This Schema number API/)).toBeDefined())
    expect(screen.getByText("10 places")).toBeDefined()
  })

  /*
   * GitHub gave both of these the same level as the assertion. Ranked by what they say
   * rather than by level, they sit under it.
   */
  test("shows the note that says nothing under the note that says what broke", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(/^Process completed/)).toBeDefined())

    const rows = screen.getAllByTestId("note")
    const said = rows.map((row) => row.textContent ?? "")
    const assertion = said.findIndex((text) => text.includes("App dev runtime listening"))
    const nothing = said.findIndex((text) => text.startsWith("Process completed"))

    expect(assertion).toBeLessThan(nothing)
  })

  test("turns fifteen note rows into four", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getAllByTestId("note")).toHaveLength(4))
  })

  /*
   * The assertion carries the log it captured. The first line is on the screen and the
   * rest opens, which is what GitHub does to the same text behind "Show more".
   */
  test("opens the rest of a long note when asked, and not before", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(/App dev runtime listening/)).toBeDefined())
    expect(screen.queryByText(/127\.0\.0\.1:35681/)).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: /Show the rest/ }))
    expect(screen.getByText(/127\.0\.0\.1:35681/)).toBeDefined()
  })
})

describe("a run that passed", () => {
  const green: RunOpening = {
    run: { ...run, state: "succeeded", seconds: 558 },
    jobs: jobs.filter((one) => one.state === "succeeded"),
    notes: [],
    gathering: [],
    presses: { mayRerun: true, mayRerunFailed: false, mayCancel: false }
  }

  test("says so, and has no fault to report", async () => {
    render(screenOf({ load: () => Effect.succeed(green) }))

    await waitFor(() => expect(screen.getByText(/10 passed/)).toBeDefined())
    expect(screen.queryByRole("region", { name: "Fault" })).toBeNull()
  })
})

describe("a run drawn from what was kept", () => {
  /*
   * A run's page is half a megabyte of their markup, so the read behind this screen is the
   * slowest of the eleven. Which makes the memory worth the most here and the sentence over
   * it worth the most too: a kept run and a current one look identical, and the reader is
   * about to decide whether a job really failed.
   */
  test("says it is being checked, over the run the reader is already reading", async () => {
    render(
      <Toasts>
        {screenOf({
          load: () => Effect.never,
          preload: () => Effect.succeed(Option.some(opening))
        })}
      </Toasts>
    )

    await waitFor(() => expect(screen.getByText(/Checking this run/)).toBeDefined())
  })
})

/*
 * The presses are GitHub's own forms, and which of them exist on the page is their
 * answer about the run: a finished run carries no cancel, a run with nothing failed
 * carries no failed-jobs press. So the screen offers what the opening says and works
 * nothing out from the outcome.
 */
describe("running a run again, and stopping one", () => {
  const failed: RunOpening = {
    ...opening,
    presses: { mayRerun: true, mayRerunFailed: true, mayCancel: false }
  }

  const going: RunOpening = {
    ...opening,
    run: { ...run, state: "running" },
    presses: { mayRerun: false, mayRerunFailed: false, mayCancel: true }
  }

  const pressing = (props: Partial<React.ComponentProps<typeof RunScreen>>) =>
    render(screenOf({ load: () => Effect.succeed(failed), press: () => Effect.void, ...props }))

  test("offers both re-runs on a failed run, and no way to cancel a finished one", async () => {
    pressing({})

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Run the failed jobs again" })).toBeDefined()
    )
    expect(screen.getByRole("button", { name: "Run all jobs again" })).toBeDefined()
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull()
  })

  test("offers nothing where GitHub's page carried no form", async () => {
    pressing({ load: () => Effect.succeed(opening) })

    await waitFor(() => expect(screen.getByText(/10 passed/)).toBeDefined())
    expect(screen.queryByRole("button", { name: /Run|Cancel/ })).toBeNull()
  })

  /*
   * Nothing is offered where the screen was wired with no way to ask, either. A button
   * that does nothing when pressed is worse than no button.
   */
  test("offers nothing where nothing was wired to ask GitHub", async () => {
    render(screenOf({ load: () => Effect.succeed(failed) }))

    await waitFor(() => expect(screen.getByText(/#9816/)).toBeDefined())
    expect(screen.queryByRole("button", { name: /Run all jobs again/ })).toBeNull()
  })

  /*
   * Twice, because a re-run spends somebody's minutes. The same button rather than a
   * dialog: a dialog is dismissed without being read.
   */
  test("asks a second time before it starts anything", async () => {
    let asked = 0
    pressing({ press: () => Effect.sync(() => void (asked += 1)) })

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Run the failed jobs again" })).toBeDefined()
    )
    await userEvent.click(screen.getByRole("button", { name: "Run the failed jobs again" }))
    expect(asked).toBe(0)

    await userEvent.click(
      screen.getByRole("button", { name: "Confirm run the failed jobs again" })
    )
    await waitFor(() => expect(asked).toBe(1))
  })

  test("asks GitHub for the press that was pressed", async () => {
    const asked: Array<string> = []
    pressing({ press: (what) => Effect.sync(() => void asked.push(what)) })

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Run all jobs again" })).toBeDefined()
    )
    await userEvent.click(screen.getByRole("button", { name: "Run all jobs again" }))
    await userEvent.click(screen.getByRole("button", { name: "Confirm run all jobs again" }))

    await waitFor(() => expect(asked).toEqual(["rerun"]))
  })

  /*
   * The outcome changes on the screen while GitHub is being asked, and the read behind
   * it puts it back if the press was refused. This is the one screen where every word
   * is about a moment that has already moved on, so a cancel that waited for their
   * answer would leave "In progress" up for the second and a half their form takes.
   */
  test("says a cancelled run is cancelled before GitHub has answered", async () => {
    pressing({
      load: () => Effect.succeed(going),
      press: () => Effect.sleep("2 seconds")
    })

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel this run" })).toBeDefined()
    )
    await userEvent.click(screen.getByRole("button", { name: "Cancel this run" }))
    await userEvent.click(screen.getByRole("button", { name: "Confirm cancel this run" }))

    await waitFor(() => expect(screen.getByLabelText(/Cancelled in/)).toBeDefined())
  })

  test("repeats what GitHub said when it will not take the press", async () => {
    pressing({
      press: () => Effect.fail({ detail: "You do not have permission to re-run this workflow" })
    })

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Run all jobs again" })).toBeDefined()
    )
    await userEvent.click(screen.getByRole("button", { name: "Run all jobs again" }))
    await userEvent.click(screen.getByRole("button", { name: "Confirm run all jobs again" }))

    await waitFor(() => expect(screen.getByText(/do not have permission/)).toBeDefined())
  })
})

describe("a run that could not be read", () => {
  test("says nothing rather than part of it, and offers GitHub's page back", async () => {
    render(screenOf({ load: () => Effect.fail(new Error("HTTP 404")) }))

    await waitFor(() => expect(screen.getByText(/could not be read/)).toBeDefined())
    expect(screen.getByRole("button", { name: /Show GitHub's run/ })).toBeDefined()
  })
})
