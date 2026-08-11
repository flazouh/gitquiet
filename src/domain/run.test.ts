import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { CheckNote } from "./PullRequest"
import {
  type Job,
  faultsIn,
  gathered,
  passedIn,
  runAddressIn,
  saysNothing,
  skippedIn,
  unescaped,
  worstOf
} from "./run"

const at = (path: string) => `https://github.com${path}`

const parsed = (path: string) => Option.getOrNull(runAddressIn(at(path)))

/*
 * The twelve jobs of run 30866145080, as GitHub reported them on 2026-08-04, which
 * is the case every decision in this module was made against: eleven that tell a
 * reader nothing and one that is the entire reason they came.
 */
const job = (name: string, state: Job["state"], seconds: number): Job => ({
  name,
  state,
  seconds,
  url: `/octo-org/octo-repo/actions/runs/30866145080/job/9185833${name.length}`
})

const THE_RUN: ReadonlyArray<Job> = [
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

const note = (message: string, where: string, level: CheckNote["level"] = "failure"): CheckNote => ({
  level,
  where,
  message,
  at: Option.none()
})

describe("the address of a run", () => {
  test("reads the repository and the run out of it", () => {
    expect(parsed("/octo-org/octo-repo/actions/runs/30866145080")).toEqual({
      repo: { owner: "octo-org", repo: "octo-repo" },
      run: "30866145080",
      attempt: null,
      job: null
    })
  })

  /*
   * A job's address is this screen too. Handing the document back to GitHub to show
   * one job's log throws away the eleven jobs beside it and the Fault that named the
   * job in the first place, which is the whole of what this screen is for.
   */
  test("claims a job's address as the same screen, and remembers which job", () => {
    expect(parsed("/octo-org/octo-repo/actions/runs/30866145080/job/91858330236")).toEqual({
      repo: { owner: "octo-org", repo: "octo-repo" },
      run: "30866145080",
      attempt: null,
      job: "91858330236"
    })
  })

  test("reads an attempt when the address names one", () => {
    expect(parsed("/octo-org/octo-repo/actions/runs/30866145080/attempts/2")?.attempt).toBe("2")
  })

  test("does not mind a trailing slash, which is how their own links are written", () => {
    expect(parsed("/octo-org/octo-repo/actions/runs/30866145080/")?.run).toBe("30866145080")
  })

  test("refuses the tabs of a run, which are pages of their own", () => {
    expect(parsed("/octo-org/octo-repo/actions/runs/30866145080/usage")).toBeNull()
    expect(parsed("/octo-org/octo-repo/actions/runs/30866145080/workflow")).toBeNull()
  })

  test("refuses the list of runs, which is a screen of its own", () => {
    expect(parsed("/octo-org/octo-repo/actions")).toBeNull()
    expect(parsed("/octo-org/octo-repo/actions/workflows/ci.yml")).toBeNull()
  })

  test("refuses a run id that is not a number, so a new tab of theirs cannot be mistaken for one", () => {
    expect(parsed("/octo-org/octo-repo/actions/runs/latest")).toBeNull()
  })
})

describe("what a run failed at", () => {
  /*
   * The order is the order the jobs are given, which is the order they were started.
   * Sorting by duration or by name would put the gate job that failed because
   * something else did above the thing that actually broke.
   */
  test("names every failing job, in the order they were run", () => {
    expect(faultsIn(THE_RUN).map((job) => job.name)).toEqual(["integration-test", "ci-complete"])
  })

  test("finds no fault in a run where nothing failed", () => {
    expect(faultsIn(THE_RUN.filter((job) => job.state === "succeeded"))).toEqual([])
  })

  /*
   * Eleven of the twelve jobs on the worked example are green. GitHub draws eleven
   * rows for them, twice, and the first screen of a failed run ends up holding no
   * error text at all. Here they are a number.
   */
  test("counts what passed rather than listing it", () => {
    expect(passedIn(THE_RUN)).toEqual({ count: 10, seconds: 558 })
  })

  test("counts what was skipped, which is never a row", () => {
    const withSkips = [...THE_RUN, job("release", "skipped", 0), job("publish", "skipped", 0)]
    expect(skippedIn(withSkips)).toBe(2)
  })

  test("takes the run's standing from the worst job, not from the last one", () => {
    expect(worstOf(THE_RUN)).toBe("failed")
    expect(worstOf(THE_RUN.filter((job) => job.state === "succeeded"))).toBe("succeeded")
    expect(worstOf([job("test", "succeeded", 1), job("build", "running", 2)])).toBe("running")
    expect(worstOf([])).toBe("neutral")
  })
})

describe("a note that says nothing", () => {
  /*
   * Two of the three errors on the worked example were this sentence and nothing
   * else. It is not an error report: it says a process exited non-zero, which the
   * red icon beside it already said.
   */
  test("knows GitHub's own non-answer", () => {
    expect(saysNothing("Process completed with exit code 1.")).toBe(true)
    expect(saysNothing("Process completed with exit code 127")).toBe(true)
    expect(saysNothing("The process '/usr/bin/git' failed with exit code 128")).toBe(true)
  })

  test("does not mistake a real message for one", () => {
    expect(saysNothing('Expected to contain: "App dev runtime listening"')).toBe(false)
    expect(saysNothing("the 'client-id' input must be set")).toBe(false)
  })
})

describe("a captured log, printed as a string", () => {
  /*
   * The worked run's assertion is 4,096 characters with one real newline in it. Everything
   * after `Received: "` is a quoted value: twelve `\n` written as a backslash and an n, and
   * 233 quotes written as a backslash and a quote. Drawn as it arrives, thirteen log lines
   * are one paragraph and every JSON detail in them is fenced in slashes.
   */
  /** As long as a real one, so the guard in `unescaped` lets it through. */
  const captured = (body: string) => `Received: "${body}${"x".repeat(300)}"`

  test("gives back the lines the runner packed into one", () => {
    const lines = unescaped(captured("one\\ntwo\\nthree")).split("\n")

    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('Received: "one')
    expect(lines[1]).toBe("two")
  })

  test("takes the slashes off the quotes a JSON detail was fenced with", () => {
    const said = unescaped(captured('a\\nb\\nc detail={\\"kind\\":\\"workspace\\"}'))

    expect(said).toContain('detail={"kind":"workspace"}')
  })

  test("reads a backslash written as two as one, and stops there", () => {
    // Once, left to right. Unescaping in passes would read `\\n` as an escaped newline on
    // the second pass, and a Windows path would grow lines.
    const said = unescaped(captured("one\\\\ntwo\\nthree\\nfour"))

    expect(said).toContain("one\\ntwo\nthree")
  })

  /*
   * Left alone unless it is plainly one of these. A lint opinion about newlines is a
   * sentence with escapes in it, not a log, and rewriting it would break the sentence.
   */
  test("leaves an ordinary note exactly as GitHub wrote it", () => {
    expect(unescaped("Process completed with exit code 1.")).toBe(
      "Process completed with exit code 1."
    )
    expect(unescaped("prefer \\n over \\r\\n")).toBe("prefer \\n over \\r\\n")
  })

  test("leaves a long note that is prose alone, however long it runs", () => {
    const prose = `This Schema number API accepts NaN. ${"Use Schema.Finite instead. ".repeat(20)}`

    expect(unescaped(prose)).toBe(prose)
  })
})

describe("gathering the notes of a run", () => {
  /*
   * The worked example carried fourteen note rows. Ten were one lint opinion about
   * `Schema.Finite`, repeated on ten lines of two files. One was the assertion that
   * broke the build, and it sat third, under two rows that said nothing.
   */
  const THE_NOTES: ReadonlyArray<CheckNote> = [
    note("Process completed with exit code 1.", "architecture"),
    note("Process completed with exit code 1.", "integration-test"),
    note('Expected to contain: "App dev runtime listening"', "integration-test"),
    note("Node.js 20 is deprecated.", "lintcn", "warning"),
    ...Array.from({ length: 10 }, () =>
      note("This Schema number API accepts `NaN`, `Infinity`, and `-Infinity`.", "lintcn", "notice")
    )
  ]

  const gathering = gathered(THE_NOTES)

  test("puts the note that says what broke first", () => {
    expect(gathering[0]?.message).toBe('Expected to contain: "App dev runtime listening"')
  })

  test("makes ten copies of one opinion into one row that counts them", () => {
    const lint = gathering.find((one) => one.message.startsWith("This Schema number API"))
    expect(lint?.count).toBe(10)
  })

  test("turns fourteen rows into four", () => {
    expect(gathering).toHaveLength(4)
  })

  test("ranks the notes that say nothing last, under the ones that say something", () => {
    expect(gathering.map((one) => saysNothing(one.message))).toEqual([false, false, false, true])
  })

  /*
   * Both "Process completed with exit code 1." rows collapse together even though
   * they came from different jobs, because the message is what a reader is being
   * asked to read and it is the same message twice.
   */
  test("keeps every job a collapsed note came from", () => {
    const empty = gathering[gathering.length - 1]
    expect(empty?.count).toBe(2)
    expect(empty?.where).toEqual(["architecture", "integration-test"])
  })

  test("leaves a run with no notes alone", () => {
    expect(gathered([])).toEqual([])
  })
})
