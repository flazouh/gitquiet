import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { unescaped } from "../domain/run"
import { secondsIn } from "./outcome"
import { jobsIn, pressOn, pressesOn, runFrom, runOnPage } from "./runPage"

/*
 * Run 30866145080 of `octo-org/octo-repo`, as GitHub served it on 2026-08-04:
 * twelve jobs, two of them failed, and fifteen annotations of which one says what
 * broke. The tooltips and icon paths are stripped, because no parser reads them and
 * they were most of the 196KB. Every element and attribute a parser touches is
 * theirs, unedited, with one exception: the four re-run forms are their markup with
 * invented `authenticity_token` values, because a token is minted for one page and
 * keeping a real one in the repository would say nothing a made-up one does not.
 */
const real = await Bun.file("tests/fixtures/runPage.html").text()

/*
 * The cancel form, as GitHub renders it on a run that is still going. Off run
 * 31536586292 of `flazouh/ghpro-scratch` on 12 August 2026, which was a
 * `workflow_dispatch` put there to be interrupted. Inline rather than a fixture of
 * its own: the rest of that page is the same page as above, and this is the whole of
 * what it says differently.
 *
 * The suite id is the fact worth reading here. Cancelling is addressed by the check
 * suite behind the run and not by the run, so `/actions/runs/31536586292` cancels at
 * `/suites/85548529120/cancel`.
 */
const cancelling = `<span data-view-component="true" class="PageHeader-actions">
<form class="d-inline-block" data-turbo="false" action="/octo-org/octo-repo/suites/85548529120/cancel" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="a-token-minted-for-this-page" autocomplete="off" />
<button type="submit" data-view-component="true" class="btn-danger btn mr-2 tmp-mr-2">Cancel workflow</button>
</form>
</span>`

describe("reading a duration the way their page writes it", () => {
  test("reads minutes and seconds", () => {
    expect(secondsIn("1m 2s")).toBe(62)
    expect(secondsIn("3m 54s")).toBe(234)
  })

  test("reads seconds alone", () => {
    expect(secondsIn("27s")).toBe(27)
  })

  test("reads hours, which a long job has", () => {
    expect(secondsIn("1h 5m 3s")).toBe(3903)
  })

  /*
   * A run still going has no duration to report and their page writes an en dash for
   * it. Zero rather than nothing, because a duration is only ever added up here and a
   * missing one is worth nothing to the total.
   */
  test("reads nothing out of what is not a duration", () => {
    expect(secondsIn("–")).toBe(0)
    expect(secondsIn("")).toBe(0)
  })
})

describe("the standing of a run, off their own page", () => {
  const standing = runFrom(real)

  test("names the workflow", () => {
    expect(standing?.workflow).toBe("ci")
  })

  test("takes the title as a reader sees it, with the code marks gone", () => {
    expect(standing?.title).toBe(
      "fix(cli): make app {harness} handle other providers and stored credentials"
    )
  })

  test("reads the run number", () => {
    expect(standing?.number).toBe("9816")
  })

  /*
   * Off the icon's own label, not off the "Failure" word in the summary grid, because
   * the icon is the one thing on the page that says the same word for a run, a job and
   * a step.
   */
  test("reads the conclusion", () => {
    expect(standing?.state).toBe("failed")
  })

  test("reads the total duration in seconds", () => {
    expect(standing?.seconds).toBe(234)
  })

  /*
   * The actor keeps their `[bot]` suffix, because that is the name their page prints and
   * a reader comparing the two screens should read the same word on both.
   */
  test("reads the trigger, the actor and the branch", () => {
    expect(standing?.trigger).toBe("pull request")
    expect(standing?.actor).toBe("devin-ai-integration[bot]")
    expect(standing?.branch).toBe("fix-harness-layerb")
  })

  test("reads the pull request the run belongs to", () => {
    expect(standing?.pullRequest).toBe("1756")
  })

  test("says when it started", () => {
    expect(standing?.startedAt).toBe("2026-08-04T02:37:11+02:00")
  })

  test("has nothing to say about a page that has stopped looking like this", () => {
    expect(runFrom("<html><body><p>nothing here</p></body></html>")).toBeNull()
  })
})

describe("the jobs of a run, off their own page", () => {
  const jobs = jobsIn(real)

  test("finds every job", () => {
    expect(jobs).toHaveLength(12)
  })

  test("reads the name, the outcome, the time and the address of each", () => {
    expect(jobs[0]).toEqual({
      name: "lint",
      state: "succeeded",
      seconds: 62,
      url: "/octo-org/octo-repo/actions/runs/30866145080/job/91858330217"
    })
  })

  /*
   * The two that matter. `integration-test` is the failure, and `ci-complete` is the
   * gate that failed because of it, which is why the order jobs were run in is the
   * order they are kept in: the gate's own log never says what happened.
   */
  test("marks the failures, in the order they were run", () => {
    expect(jobs.filter((job) => job.state === "failed").map((job) => job.name)).toEqual([
      "integration-test",
      "ci-complete"
    ])
  })

  test("reads the ten that passed with their times", () => {
    const passed = jobs.filter((job) => job.state === "succeeded")
    expect(passed).toHaveLength(10)
    expect(passed.reduce((all, job) => all + job.seconds, 0)).toBe(558)
  })

  test("comes back empty rather than wrong on a page it does not recognise", () => {
    expect(jobsIn("<html><body></body></html>")).toEqual([])
  })
})

/*
 * Re-running and cancelling are not `page_data` routes and have no JSON beside them.
 * They are Rails forms on the run page, so what a press sends is read off their own
 * markup rather than composed here. The routes as they were measured are in
 * `docs/spec/github-write-api.md`.
 */
describe("the presses their run page carries", () => {
  test("takes the whole of the failed-jobs form, fields and all", () => {
    expect(pressOn(real, "rerunFailed")).toEqual({
      action: "/octo-org/octo-repo/actions/runs/30866145080/rerequest_check_suite",
      fields: [
        ["_method", "put"],
        ["authenticity_token", "another-token-for-the-same-page"],
        ["only_failed_check_runs", "true"]
      ]
    })
  })

  /*
   * The absence of the field is what makes it every job. Their four forms post to one
   * route and differ by this alone, so a press for all of them is the form without it
   * rather than the same form with something added.
   */
  test("tells the every-job form from the failed-jobs one by the field they differ by", () => {
    expect(pressOn(real, "rerun")?.fields).toEqual([
      ["_method", "put"],
      ["authenticity_token", "a-token-minted-for-this-page"]
    ])
  })

  /*
   * Their debug logging checkbox sits in both forms and is unchecked, which a browser
   * would not send. Sending it would turn every re-run from this screen into a debug
   * run, which is minutes of somebody's quota and a log nobody asked for.
   */
  test("leaves their unchecked checkbox out of what a press sends", () => {
    const names = pressOn(real, "rerun")?.fields.map(([name]) => name) ?? []
    expect(names).not.toContain("enable_debug_logging")
  })

  test("reads the cancel form, which is addressed by check suite and not by run", () => {
    expect(pressOn(cancelling, "cancel")).toEqual({
      action: "/octo-org/octo-repo/suites/85548529120/cancel",
      fields: [
        ["_method", "put"],
        ["authenticity_token", "a-token-minted-for-this-page"]
      ]
    })
  })

  /*
   * A finished run carries no cancel form, which is GitHub's own answer about it. The
   * screen offers what it has been shown a form for, so nothing here has to work out
   * from the outcome whether a press would be refused.
   */
  test("has nothing to press where their page offers nothing", () => {
    expect(pressOn(real, "cancel")).toBeNull()
    expect(pressOn("<html><body></body></html>", "rerun")).toBeNull()
  })

  test("says which of the three a page is offering", () => {
    expect(pressesOn(real)).toEqual({
      mayRerun: true,
      mayRerunFailed: true,
      mayCancel: false
    })
    expect(pressesOn(cancelling)).toEqual({
      mayRerun: false,
      mayRerunFailed: false,
      mayCancel: true
    })
  })
})

describe("everything a run screen opens with, in one read", () => {
  const run = runOnPage(real)

  test("carries the standing, the jobs and the notes together", () => {
    expect(run?.run.workflow).toBe("ci")
    expect(run?.jobs).toHaveLength(12)
    expect(run?.notes).toHaveLength(15)
  })

  /*
   * The whole point of the screen. Fifteen note rows on their page, and the one that
   * names the cause was third. Gathered, it is first.
   */
  test("puts the note that says what broke first", () => {
    expect(run?.gathering[0]?.headline).toBe('Expected to contain: "App dev runtime listening"')
  })

  /*
   * That note is 4KB: the assertion, and then every log line the assertion captured.
   * The screen shows the first line and keeps the rest to open, which is what their own
   * "Show more" button does to the same text.
   */
  test("keeps the whole of a long note behind its first line", () => {
    expect(run?.gathering[0]?.message.length).toBeGreaterThan(2000)
    expect(run?.gathering[0]?.headline.length).toBeLessThan(80)
  })

  /*
   * And those 4KB are thirteen log lines, not a paragraph. The runner printed the captured
   * output as a quoted value, so its newlines arrive as a backslash and an n and its JSON
   * details are fenced in 233 escaped quotes. One real newline in 4,096 characters.
   */
  test("reads the captured log in that note back as the lines it was", () => {
    const note = run?.gathering[0]?.message ?? ""

    expect(note.split("\n")).toHaveLength(2)
    expect(unescaped(note).split("\n").length).toBeGreaterThan(10)
    expect(unescaped(note)).toContain('detail={"kind":"workspace"')
  })

  test("turns the ten copies of one lint opinion into one row", () => {
    const lint = run?.gathering.find((one) => one.message.includes("Schema.Finite"))
    expect(lint?.count).toBe(10)
  })

  test("says nothing about a page that is not a run", () => {
    expect(runOnPage("<html><body></body></html>")).toBeNull()
  })

  /*
   * The three booleans and not the forms. This opening is kept in the store, and an
   * `authenticity_token` is minted for one page: a press built out of a remembered
   * token would be refused for a reason nothing on the screen could explain.
   */
  test("keeps what may be pressed and not the tokens that would press it", () => {
    expect(run?.presses).toEqual({ mayRerun: true, mayRerunFailed: true, mayCancel: false })
    expect(JSON.stringify(run)).not.toContain("authenticity_token")
  })

  /*
   * Their note links read `#step:5:54` on a run page and `#annotation:4:43` on a
   * pull request's Checks tab. Both mean step five, line fifty-four, and both have
   * to be followed, so the spot is read off either.
   */
  test("follows a note to the step and line their run page names", () => {
    const spotted = run?.notes.find((note) => Option.isSome(note.at))
    expect(spotted === undefined ? null : Option.getOrNull(spotted.at)).toEqual({
      step: 5,
      line: 54
    })
  })
})
