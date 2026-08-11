import { Option } from "effect"
import type { CheckNote, CheckNoteLevel, CheckState, LogSpot } from "./PullRequest"

/**
 * One execution of one Workflow against one commit: `/owner/repo/actions/runs/{id}`.
 *
 * The address of the only page GitHub ships with a recommendation from its own maker
 * to go somewhere else. The argument is in `docs/spec/actions.md` with the counts; the
 * short of it is that a reader arrives with one question, "my change failed, what is
 * the error", and the page answers a different one. On the run this module was written
 * against, the first screen of a failure held twelve job nodes, a four-field summary,
 * and no error text at all.
 */
export type RunRef = {
  readonly repo: { readonly owner: string; readonly repo: string }
  /**
   * GitHub's run id, kept as the string it was written as.
   *
   * A string because it is an identifier and never arithmetic, and because their ids
   * have outgrown a safe integer before now.
   */
  readonly run: string
  /** The Attempt the address named, or nothing for the current one. */
  readonly attempt: string | null
  /**
   * The Job the address named, or nothing for the run itself.
   *
   * A job's address is this same screen. Handing the document back to GitHub to show
   * one job's log throws away the eleven jobs beside it and the Fault that named the
   * job, which is the whole of what the screen is for.
   */
  readonly job: string | null
}

/**
 * A Run's own facts: what ran, against what, how it went, and who started it.
 *
 * Exactly the Run of `CONTEXT.md`: one execution of one Workflow against one commit, with
 * a conclusion, a duration, a trigger and an actor. Everything here is on the first screen
 * of GitHub's own run page, which is the part of that page worth keeping.
 *
 * Not to be read as `RunStanding` in `src/domain/checks.ts`, which is an older use of the
 * word: that one is how a pull request's whole set of Checks stands. The two are different
 * things and neither name is free to change yet.
 */
export type Run = {
  readonly workflow: string
  /** The commit title, as a reader sees it: their `<code>` marks resolved to text. */
  readonly title: string
  /** Their run number, without the `#`, kept as a string because it is a label. */
  readonly number: string
  readonly state: CheckState
  readonly seconds: number
  /** How it was started, in their words: "pull request", "push", "schedule". */
  readonly trigger: string
  readonly actor: string
  readonly branch: string
  readonly pullRequest: string | null
  readonly startedAt: string
}

/**
 * Everything the Run screen opens with, out of one read of their page.
 *
 * One shape and not four calls, because their run page carries all of it in the HTML it is
 * served as: the facts, the twelve jobs and the fifteen notes. A screen that asked for
 * these separately would spend three more round trips to know what it already had.
 */
export type RunOpening = {
  readonly run: Run
  readonly jobs: ReadonlyArray<Job>
  /** Every Note as GitHub wrote it, kept so a screen can say how many it gathered. */
  readonly notes: ReadonlyArray<CheckNote>
  /** The Notes as they should be read: collapsed, and ranked by what they say. */
  readonly gathering: ReadonlyArray<Gathering>
  /** What GitHub will take on this run, in their own answer about it. */
  readonly presses: Presses
}

/**
 * What may be asked of a run, as GitHub itself says on the page.
 *
 * Their answer and not a guess of ours off the outcome. Whether a run may be
 * re-run at all is a matter of permissions, of the workflow file still existing,
 * and of the run being inside the window they keep re-runs for; whether the
 * failed jobs may be re-run on their own depends on there being failed jobs.
 * GitHub decides all three by rendering the form or leaving it out, so the
 * presence of the form is the fact, and a control this cannot see a form for is
 * not offered rather than offered and refused.
 */
export type Presses = {
  /** Every job of the run again, whatever each of them did. */
  readonly mayRerun: boolean
  /** The failed ones only, which is the press a reader of a red run wants. */
  readonly mayRerunFailed: boolean
  readonly mayCancel: boolean
}

/** Which of the three presses is being asked for. */
export type Pressing = "rerun" | "rerunFailed" | "cancel"

/**
 * One Job of a Run: what it was called, how it went, how long it took.
 *
 * The url is GitHub's own, keyed by a check run id, and is what every deeper read
 * starts from. A Job and a pull request's Check are one object seen from two pages,
 * which `CONTEXT.md` records, so the state here is `CheckState` and not a second
 * vocabulary for the same seven outcomes.
 */
export type Job = {
  readonly name: string
  readonly state: CheckState
  readonly seconds: number
  readonly url: string
}

/**
 * A Note as it is shown: one message, however many places said it.
 *
 * GitHub draws one row per occurrence. On the worked run that turned one lint opinion
 * about `Schema.Finite` into ten rows, which pushed the assertion that actually broke
 * the build to third place among fourteen. Here the message is the row and the places
 * are a count.
 */
export type Gathering = {
  readonly level: CheckNoteLevel
  /**
   * The first line, which on a real failure is the whole answer.
   *
   * Their messages are not one line. The note that broke the worked run carries four
   * kilobytes: the assertion, and then every log line the assertion captured. The first
   * line of it is `Expected to contain: "App dev runtime listening"`, which is what the
   * reader came for, so it is separated here rather than left for a screen to find. Their
   * own page does the same thing behind a "Show more" button.
   */
  readonly headline: string
  readonly message: string
  /** Every Job that said it, in the order they said it. */
  readonly where: ReadonlyArray<string>
  readonly count: number
  /** Where to look in the log, from the first occurrence that named a spot. */
  readonly at: Option.Option<LogSpot>
}

/** Their tabs of a run, which are pages of their own and not this screen. */
const THEIRS = new Set(["usage", "workflow", "workflow-file", "lockfile", "artifacts"])

const RUN = /^\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)(?:\/(.*))?$/

/**
 * Reads a run's address, or nothing where the address is not one.
 *
 * The run id must be digits. Their own `/actions/runs/` prefix is shared with things
 * that are not a run, so matching anything there would claim a page this cannot draw
 * the first time they add a tab.
 */
export const runAddressIn = (url: string): Option.Option<RunRef> => {
  const path = pathOf(url)
  if (path === null) return Option.none()

  const found = RUN.exec(path.replace(/\/$/, ""))
  if (found === null) return Option.none()

  const [, owner, repo, run, rest = ""] = found
  if (owner === undefined || repo === undefined || run === undefined) return Option.none()

  const trail = rest.split("/").filter((piece) => piece !== "")
  const read = trailIn(trail)
  if (read === null) return Option.none()

  return Option.some({ repo: { owner, repo }, run, ...read })
}

/**
 * What comes after the run id: nothing, an attempt, a job, or a tab of theirs.
 *
 * Null rather than a default, so a tab this screen cannot draw is handed back to
 * GitHub rather than drawn wrong.
 */
const trailIn = (trail: ReadonlyArray<string>): Pick<RunRef, "attempt" | "job"> | null => {
  if (trail.length === 0) return { attempt: null, job: null }

  const [first = "", second] = trail
  if (THEIRS.has(first)) return null

  if (first === "attempts" && second !== undefined && /^\d+$/.test(second)) {
    const after = trail.slice(2)
    if (after.length === 0) return { attempt: second, job: null }
    const deeper = trailIn(after)
    return deeper === null ? null : { ...deeper, attempt: second }
  }

  if (first === "job" && second !== undefined && /^\d+$/.test(second)) {
    return { attempt: null, job: second }
  }

  return null
}

const pathOf = (url: string): string | null => {
  if (url.startsWith("/")) return url
  const found = /^https?:\/\/[^/]+(\/.*)$/.exec(url)
  return found?.[1] ?? null
}

/**
 * How much a state is worth reporting, so a run's standing is the worst of its jobs.
 *
 * A run is red the moment one job is red, whatever the eleven after it did. Taking
 * the standing from the last job to finish would report the gate job's own outcome
 * and lose the failure that caused it.
 */
const WEIGHT: Record<CheckState, number> = {
  failed: 6,
  cancelled: 5,
  running: 4,
  queued: 3,
  succeeded: 2,
  neutral: 1,
  skipped: 0
}

/**
 * The worst standing among things that have one, and neutral where there are none.
 *
 * Anything with a state, rather than a Job, because a Strand asks the same question of its
 * Runs that a Run asks of its Jobs: a Strand is red the moment one Run on its head is red.
 * Two functions would be two answers to one question, and they would drift.
 */
export const worstOf = (some: ReadonlyArray<{ readonly state: CheckState }>): CheckState =>
  some.reduce<CheckState>(
    (worst, one) => (WEIGHT[one.state] > WEIGHT[worst] ? one.state : worst),
    "neutral"
  )

/**
 * Every failing Job, in the order they were run.
 *
 * The order is the order given, which is the order they started. Sorting by duration
 * or by name puts the gate job that failed because something else did above the thing
 * that broke, and the gate job's log never says what happened.
 */
export const faultsIn = (jobs: ReadonlyArray<Job>): ReadonlyArray<Job> =>
  jobs.filter((job) => job.state === "failed" || job.state === "cancelled")

/**
 * What passed, as a number and a total time.
 *
 * A count and not rows. Eleven of the twelve jobs on the worked run were green, drawn
 * as eleven rows and then as eleven more in the sidebar, which is how a failed run's
 * first screen ends up with no error on it.
 */
export const passedIn = (
  jobs: ReadonlyArray<Job>
): { readonly count: number; readonly seconds: number } => {
  const passed = jobs.filter((job) => job.state === "succeeded")
  return {
    count: passed.length,
    seconds: passed.reduce((all, job) => all + job.seconds, 0)
  }
}

/**
 * How many Jobs never ran.
 *
 * Never rows. A job whose `if` was false reports nothing about the run and has been
 * the subject of [#18001](https://github.com/orgs/community/discussions/18001) and its
 * 357 upvotes for years.
 */
export const skippedIn = (jobs: ReadonlyArray<Job>): number =>
  jobs.filter((job) => job.state === "skipped" || job.state === "neutral").length

/**
 * Their sentence for "something exited non-zero", which is not an error report.
 *
 * Two of the three errors on the worked run were this and nothing else. It says what
 * the red icon beside it already said, so it ranks under every note that names a
 * cause. Matched on the shape rather than on one exact string, because they write it
 * three ways: with and without the full stop, and once naming the program.
 */
export const saysNothing = (message: string): boolean => {
  const said = message.trim()
  return (
    /^process completed with exit code \d+\.?$/i.test(said) ||
    /^the process .* failed with exit code \d+\.?$/i.test(said)
  )
}

/**
 * What a backslash and a letter stood for, before a test runner quoted the log.
 *
 * The five a runner produces. Anything else keeps its backslash, because a note is not a
 * program and a slash in one is far more often a path than an escape.
 */
const STOOD_FOR: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  '"': '"',
  "\\": "\\"
}

/**
 * What makes a message a captured log rather than a sentence about one.
 *
 * Two things, because either alone is wrong. A lint opinion can say `prefer \n over \r\n`,
 * which is two escapes in nineteen characters and is a sentence: rewriting it would put two
 * line breaks inside somebody's advice. And a long note is not a log on length alone.
 *
 * A captured log is long and has an escape per line. The worked run's assertion is 4,096
 * characters with twelve. The numbers are a judgement rather than a fact about their
 * format, which is why they are named and why the whole thing is off by default: a message
 * below either is left exactly as GitHub wrote it.
 */
const ENOUGH = 2
const LONG = 200

/**
 * A captured log as the lines it was written as, out of the string a runner printed it in.
 *
 * The assertion that broke the worked run is 4,096 characters holding exactly one newline.
 * Everything after `Received: "` is a quoted value, so its thirteen lines are `\n` written
 * as two characters and its JSON details are fenced in 233 escaped quotes. Drawn as it
 * arrives it is one grey paragraph, which is the state their own log viewer is complained
 * about for.
 *
 * Read once, left to right, rather than in passes. Passes would take `\\n`, which is a
 * backslash and an n and is how a Windows path is written, and make a line break of it.
 *
 * Untouched unless the message is plainly one of these: see `ENOUGH`. Fidelity is the
 * default here, as everywhere in this module, and this is the one place a message is
 * rewritten at all.
 */
export const unescaped = (message: string): string => {
  if (message.length < LONG) return message
  if ((message.match(/\\n/g) ?? []).length < ENOUGH) return message

  let read = ""
  for (let at = 0; at < message.length; at += 1) {
    const here = message[at] ?? ""
    if (here !== "\\") {
      read += here
      continue
    }

    const next = message[at + 1] ?? ""
    const meant = STOOD_FOR[next]
    if (meant === undefined) {
      read += here
      continue
    }

    read += meant
    at += 1
  }
  return read
}

const LEVELS: Record<CheckNoteLevel, number> = { failure: 2, warning: 1, notice: 0 }

/**
 * The one line of a note worth a row of the screen.
 *
 * Off the unescaped text, so that "the first line" means the same thing whether the runner
 * wrote its newlines or quoted them. A note that is one escaped blob and no real newline
 * would otherwise have four kilobytes for a headline.
 *
 * The first line that has words on it. Some of their messages open with a blank line or
 * with the test runner's own banner, so the first line with content is taken rather than
 * the first line. Nothing is cut off the end here: a screen shows the headline and can
 * open the rest, which is why the whole message is kept beside it.
 */
const headlineOf = (message: string): string =>
  unescaped(message)
    .split("\n")
    .find((line) => line.trim() !== "")
    ?.trim() ?? ""

/**
 * Gathers a run's Notes into what a reader should read, in the order they should read it.
 *
 * Two rules, and both come from counting the worked run's fourteen rows. Identical
 * messages are one row with a count, because ten copies of one lint opinion are one
 * opinion. And a note that says nothing ranks under every note that says something,
 * whatever level GitHub gave it, because on that run the two rows GitHub called errors
 * were the two that said nothing and the assertion that broke the build was reported
 * at the same level as them.
 *
 * Grouping is by message across jobs, not within one job. Both "Process completed with
 * exit code 1." rows came from different jobs and are still the same sentence twice.
 */
export const gathered = (notes: ReadonlyArray<CheckNote>): ReadonlyArray<Gathering> => {
  const byMessage = new Map<string, Gathering>()

  for (const note of notes) {
    const already = byMessage.get(note.message)
    if (already === undefined) {
      byMessage.set(note.message, {
        level: note.level,
        headline: headlineOf(note.message),
        message: note.message,
        where: [note.where],
        count: 1,
        at: note.at
      })
      continue
    }
    byMessage.set(note.message, {
      level: LEVELS[note.level] > LEVELS[already.level] ? note.level : already.level,
      headline: already.headline,
      message: already.message,
      where: already.where.includes(note.where) ? already.where : [...already.where, note.where],
      count: already.count + 1,
      at: Option.isSome(already.at) ? already.at : note.at
    })
  }

  return [...byMessage.values()].sort((one, other) => {
    const empty = Number(saysNothing(one.message)) - Number(saysNothing(other.message))
    return empty !== 0 ? empty : LEVELS[other.level] - LEVELS[one.level]
  })
}
