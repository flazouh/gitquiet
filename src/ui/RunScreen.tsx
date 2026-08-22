import { Effect, Option } from "effect"
import { useState } from "react"
import type { CheckNoteLevel, CheckState } from "../domain/PullRequest"
import {
  type Gathering,
  type Job,
  type Presses,
  type Pressing,
  type Run,
  type RunOpening,
  type RunRef,
  faultsIn,
  passedIn,
  saysNothing,
  skippedIn,
  toleratedIn,
  unescaped
} from "../domain/run"
import { useArt } from "./art"
import { CHIP, PILL } from "./dress"
import { CHECK_TONE, checkArt } from "./Icon"
import { reasonFor } from "./refusal"
import { Section } from "./Section"
import { TheBar } from "./TheBar"
import { useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

export type RunScreenProps = {
  readonly reference: RunRef
  readonly load: () => Effect.Effect<RunOpening, unknown>
  /**
   * The run as it was last read, painted while the live read is in the air.
   *
   * A finished run never changes, so what comes back is the page itself rather than a
   * paler copy of it; a running one is corrected the moment GitHub answers.
   */
  readonly preload?: () => Effect.Effect<Option.Option<RunOpening>>
  /** Restores GitHub's own run page, which is still on the page behind this. */
  readonly onStepAside: () => void
  /**
   * The same, but meant: hands the page back and remembers that GitHub's is the page
   * to open from now on.
   */
  readonly onUseGitHub?: () => void
  /**
   * Asking GitHub to run this again, or to stop it.
   *
   * One function for the three presses rather than three props, because the screen
   * decides nothing about them: which are offered is on the opening, as GitHub's own
   * answer, and what each one means is the same sentence in every case — post their
   * form, then read the run again.
   *
   * Absent draws no controls at all. A screen handed no way to ask should not offer a
   * button that does nothing when pressed.
   */
  readonly press?: (what: Pressing) => Effect.Effect<unknown, unknown>
}

/**
 * A press, from the moment it is offered to the moment GitHub has answered.
 *
 * The same shape the merge card uses, and for the same reason: re-running a run
 * spends somebody's minutes and cancelling one throws away what is running, so both
 * ask twice. Not a dialog, which is dismissed without being read, but the same
 * button saying what the next press will do.
 */
type Pressed =
  | { readonly step: "idle" }
  | { readonly step: "asking"; readonly what: Pressing }
  | { readonly step: "working"; readonly what: Pressing }
  | { readonly step: "done"; readonly what: Pressing }
  | { readonly step: "refused"; readonly said: string }

/**
 * How long something took, in the units their own view prints it in.
 *
 * The same wording `CheckSteps` uses, deliberately: a reader moving between a pull
 * request's checks and a run should not have to read two dialects of the same number.
 */
const said = (seconds: number): string =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`

const READING = "Reading this run…"

/** The outcome in a word, which is the word their own page prints for it. */
const WORD_OF: Record<CheckState, string> = {
  succeeded: "Success",
  failed: "Failure",
  /*
   * Not one of their words, because they have none. "Allowed to fail" is what the
   * Workflow's author wrote when they wrote `continue-on-error: true`, said in a
   * way a reader who has never opened the file can act on: the job fell over, and
   * nobody has to do anything about it.
   */
  tolerated: "Allowed to fail",
  running: "In progress",
  queued: "Queued",
  cancelled: "Cancelled",
  skipped: "Skipped",
  neutral: "Neutral"
}

/**
 * What the standing pill is filled with.
 *
 * Filled for the three outcomes a reader is looking for and tinted for the rest, which
 * is the same distinction `IssueHeader` makes: a run that was cancelled or skipped is
 * not a result, and painting it as emphatically as a failure would put four claims of
 * equal weight on one screen.
 */
const PILL_OF: Record<CheckState, string> = {
  failed: "bg-fail-emphasis text-ink-on-emphasis",
  succeeded: "bg-pass-emphasis text-ink-on-emphasis",
  running: "bg-accent-emphasis text-ink-on-emphasis",
  queued: "bg-hover text-ink",
  cancelled: "bg-hover text-ink",
  skipped: "bg-hover text-ink",
  neutral: "bg-hover text-ink",
  tolerated: "bg-hover text-ink"
}

/**
 * What each press says, at rest, while it is going, and once GitHub has taken it.
 *
 * Their own wording is not kept here. GitHub writes "Re-run all jobs" and "Re-run
 * failed jobs" in a menu behind a button, where the word "re-run" is doing the work
 * of saying what the menu is; on a row of three controls the verb has to carry it
 * alone, and "Run the failed jobs again" is what a reader would say out loud.
 */
const PRESS_WORDS: Record<
  Pressing,
  { readonly rest: string; readonly working: string; readonly done: string }
> = {
  rerun: { rest: "Run all jobs again", working: "Starting…", done: "Started" },
  rerunFailed: { rest: "Run the failed jobs again", working: "Starting…", done: "Started" },
  cancel: { rest: "Cancel this run", working: "Cancelling…", done: "Cancelled" }
}

/**
 * How each press is dressed, at rest and once it is armed.
 *
 * Red for cancelling, which is the one that takes something away, and the same pair
 * the merge card uses for its own destructive verbs. Never the same colour before and
 * after arming: a control that looks identical either side of a press has not told
 * anybody the next one acts.
 */
const PRESS_TONE: Record<Pressing, { readonly rest: string; readonly armed: string }> = {
  rerun: { rest: "bg-surface text-ink", armed: "bg-accent-emphasis text-ink-on-emphasis" },
  rerunFailed: {
    rest: "bg-surface text-ink",
    armed: "bg-accent-emphasis text-ink-on-emphasis"
  },
  cancel: { rest: "bg-surface text-fail", armed: "bg-fail-emphasis text-ink-on-emphasis" }
}

/** What a press says while it is armed, whichever press it is. */
const CONFIRM = "Press again to confirm"

/** No presses at all, for a screen wired without a way to ask for one. */
const NOTHING: Presses = { mayRerun: false, mayRerunFailed: false, mayCancel: false }

/**
 * One press, which asks twice before it goes.
 *
 * The armed button keeps its own name in `aria-label`, so a reader on a screen reader
 * is not left with three buttons all called "Press again to confirm".
 */
const Press = ({
  what,
  pressed,
  press
}: {
  readonly what: Pressing
  readonly pressed: Pressed
  readonly press: (what: Pressing) => void
}) => {
  const words = PRESS_WORDS[what]
  const tone = PRESS_TONE[what]
  const asking = pressed.step === "asking" && pressed.what === what
  const working = pressed.step === "working" && pressed.what === what
  const said = asking
    ? CONFIRM
    : working
      ? words.working
      : pressed.step === "done" && pressed.what === what
        ? words.done
        : words.rest

  return (
    <button
      type="button"
      // Nothing may be pressed while GitHub is being asked for something else, and
      // the armed one stays live so the second press can land.
      disabled={pressed.step === "working" && !working}
      aria-label={asking ? `Confirm ${words.rest.toLowerCase()}` : undefined}
      aria-busy={working ? true : undefined}
      onClick={() => press(what)}
      className={`shrink-0 rounded-md border border-line px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
        asking ? tone.armed : tone.rest
      }`}
    >
      {said}
    </button>
  )
}

/**
 * The three things that can be done to a run, where the run's facts are.
 *
 * On the header card and not at the bottom of the screen, because they are about the
 * run itself rather than about any of what is under them. Only what GitHub drew a
 * form for is here: a finished run offers no cancel, a run with nothing failed offers
 * no failed-jobs press, and a run whose workflow file has gone offers neither re-run.
 * See `presses` in `src/domain/run.ts`.
 */
const RunPresses = ({
  presses,
  pressed,
  press
}: {
  readonly presses: Presses
  readonly pressed: Pressed
  readonly press: (what: Pressing) => void
}) => {
  const offered: ReadonlyArray<Pressing> = [
    presses.mayRerunFailed ? "rerunFailed" : null,
    presses.mayRerun ? "rerun" : null,
    presses.mayCancel ? "cancel" : null
  ].filter((what): what is Pressing => what !== null)

  if (offered.length === 0) return null

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {offered.map((what) => (
        <Press key={what} what={what} pressed={pressed} press={press} />
      ))}
      {pressed.step === "refused" ? (
        <p className="min-w-0 flex-1 text-xs leading-snug text-fail">{pressed.said}</p>
      ) : null}
    </div>
  )
}

/**
 * Which run this is, as a card rather than as loose text.
 *
 * The same shape as a pull request's header and an issue's: standing, number, title on
 * one line, and everything about how it came to run on an inset strip under it. A
 * reader moving between the three screens should not have to find the number in a
 * different place on each.
 *
 * What GitHub gives a four-field grid the width of the page, this gives one strip. None
 * of it is the answer to the question anybody opens a red run with, and the argument
 * with the counts is in `docs/spec/actions.md`.
 */
const RunHeader = ({
  run,
  repo,
  presses,
  pressed,
  press
}: {
  readonly run: Run
  readonly repo: RunRef["repo"]
  readonly presses: Presses
  readonly pressed: Pressed
  readonly press: (what: Pressing) => void
}) => {
  const art = useArt()
  const Mark = checkArt(art, run.state)
  const Actions = art.actions
  const age = ageOf(run.startedAt)

  return (
    <section
      aria-label="This run"
      className="t-panel-fade mb-1.5 shrink-0 rounded-md border border-line bg-surface p-1"
    >
      <div className="mb-1 flex items-center gap-2.5">
        <span
          aria-label={`${WORD_OF[run.state]} in ${said(run.seconds)}`}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${PILL_OF[run.state]}`}
        >
          <Mark size={12} aria-hidden="true" />
          {WORD_OF[run.state]}
          <span className="font-normal tabular-nums opacity-80">{said(run.seconds)}</span>
        </span>

        <span
          className={`${CHIP} shrink-0 font-mono text-base font-semibold tabular-nums text-ink`}
        >
          {`#${run.number}`}
        </span>

        {/* The commit's own title, which is what the run is about. Their page prints
            it once at this size and again in the graph; here it is the heading. */}
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{run.title}</h1>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-inset px-2.5 py-1.5 text-xs text-ink-muted">
        <a
          className="flex shrink-0 items-center gap-1.5 font-semibold text-ink no-underline hover:underline"
          href={`/${repo.owner}/${repo.repo}/actions`}
        >
          <Actions size={12} aria-hidden="true" />
          {run.workflow}
        </a>

        <span className="flex shrink-0 items-center gap-1.5">
          <Who login={run.actor} />
          <span className="text-ink">{run.actor}</span>
        </span>

        <span className="shrink-0">{run.trigger}</span>

        {/* The branch in mono, because it is a name that has to be read exactly, and
            the pull request beside it because that is where a reader is going back to. */}
        <span className={`${CHIP} min-w-0 max-w-[18rem] truncate font-mono text-ink`}>
          {run.branch}
        </span>

        {run.pullRequest === null ? null : (
          <a
            className="shrink-0 tabular-nums no-underline hover:underline"
            href={`/${repo.owner}/${repo.repo}/pull/${run.pullRequest}`}
          >
            {`#${run.pullRequest}`}
          </a>
        )}

        {age === "" ? null : (
          <span className="ml-auto shrink-0" title={momentOf(run.startedAt)}>
            {age}
          </span>
        )}
      </div>

      <RunPresses presses={presses} pressed={pressed} press={press} />
    </section>
  )
}

const LEVEL_TONE: Record<CheckNoteLevel, string> = {
  failure: "text-fail",
  warning: "text-busy",
  notice: "text-ink"
}

/**
 * Where a Note came from, as chips rather than as a line of loose grey text.
 *
 * Their markup gives two different things under one name. A note linked to a log
 * carries the job's name; a note linked to a file carries the rule's name instead, so
 * on the worked run the assertion that broke the build is labelled
 * `error: expect(received).toContain(expected):`. Neither is a sentence, and printed
 * bare under the message both read as something that failed to load — which is what
 * this screen did before. A chip says "this is a label" without having to be read.
 */
const Where = ({ note }: { readonly note: Gathering }) => (
  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
    {note.count > 1 ? (
      <span className={`${PILL} shrink-0 font-semibold text-ink`}>{`${note.count} places`}</span>
    ) : null}
    {note.where.map((one) => (
      <span key={one} className={`${CHIP} max-w-[28rem] truncate`} title={one}>
        {one}
      </span>
    ))}
    {Option.match(note.at, {
      onNone: () => null,
      onSome: (spot) => (
        <span className={`${CHIP} shrink-0 tabular-nums`}>
          {`step ${spot.step}, line ${spot.line}`}
        </span>
      )
    })}
  </div>
)

/**
 * One Note: its first line, where it came from, and the rest on request.
 *
 * The count rather than the copies. Ten identical `Schema.Finite` notices were ten rows
 * on their page, and they pushed the assertion that broke the build to third of
 * fourteen.
 *
 * The rest is behind a press because the note that matters most is also the longest:
 * the assertion on the worked run carries four kilobytes of captured log after its
 * first line. Their own page does the same thing to the same text, behind "Show more".
 */
const Said = ({
  note,
  lead = false
}: {
  readonly note: Gathering
  /**
   * Whether this is the answer or one of the things also said.
   *
   * The lead note gets the size, the measure and the leading of something meant to be
   * read; the rest get a row. One treatment for both was the flaw in the first draft of
   * this screen — four notes in one box at one weight, where the assertion that broke
   * the build looked exactly like a deprecation warning about Node 20.
   */
  readonly lead?: boolean
}) => {
  const art = useArt()
  const ChevronRight = art["chevron-right"]
  const [open, setOpen] = useState(false)
  /*
   * Off the unescaped text, and the headline was taken off the same, so the two agree
   * about where the first line ends. Their runner prints a captured log as a quoted value:
   * the worked run's assertion is 4,096 characters holding one real newline, twelve
   * newlines written as a backslash and an n, and 233 quotes written the same way. Drawn as
   * it arrives it is a grey paragraph. See `unescaped` in `src/domain/run.ts`.
   */
  const whole = unescaped(note.message)
  const rest = whole.slice(note.headline.length).trim()

  return (
    <div className="px-3 py-2.5" data-testid="note">
      {/* Wraps, and to a measure. Their messages run to a paragraph — the deprecation
          note on the worked run carries a URL — and a mono line that cannot wrap leaves
          the end of it off the right edge, which is the log viewer's own complaint. */}
      <p
        className={`max-w-[110ch] break-words font-mono ${
          lead ? "text-sm leading-relaxed" : "text-xs leading-normal"
        } ${LEVEL_TONE[note.level]}`}
      >
        {note.headline}
      </p>

      <Where note={note} />

      {rest === "" ? null : (
        <>
          <button
            type="button"
            className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
            onClick={() => setOpen(!open)}
          >
            <ChevronRight
              size={12}
              aria-hidden="true"
              className={`shrink-0 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] ${
                open ? "rotate-90" : ""
              }`}
            />
            {open ? "Hide the rest" : "Show the rest"}
          </button>
          {open ? (
            // Wraps rather than scrolling sideways, and breaks inside a word, because a
            // line of this is a JSON detail three hundred characters long with no space in
            // it: left to overflow, the end of every line is off the screen, which is the
            // complaint their own log viewer collects.
            //
            // A line at a time, so each can hang its own wrap. Wrapped flush left, the
            // second half of a long entry starts in the same column as the entry after it
            // and there is no telling which is which. Two characters of indent is enough
            // to see it and not enough to cost a column of the measure.
            <pre className="mt-1.5 max-h-96 max-w-[110ch] overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-inset p-3 font-mono text-xs leading-relaxed text-ink-muted">
              {rest.split("\n").map((line, at) => (
                <span
                  // By position, because a log repeats itself: two identical lines are two
                  // lines and keying on the text would drop one of them.
                  key={`${at}`}
                  className="block pl-[2ch] -indent-[2ch]"
                >
                  {line === "" ? "\u00a0" : line}
                </span>
              ))}
            </pre>
          ) : null}
        </>
      )}
    </div>
  )
}

const JobRow = ({ job }: { readonly job: Job }) => {
  const Mark = checkArt(useArt(), job.state)

  return (
    <a
      href={job.url}
      className="flex w-full items-baseline gap-2 px-3 py-1.5 no-underline hover:bg-hover"
    >
      <Mark
        size={12}
        aria-hidden="true"
        className={`shrink-0 translate-y-0.5 ${CHECK_TONE[job.state]}`}
      />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{job.name}</span>
      <span className="shrink-0 text-xs tabular-nums text-ink-muted">{said(job.seconds)}</span>
    </a>
  )
}

/**
 * The Fault: what broke, and which job it broke in.
 *
 * One section rather than the two boxes this screen had, because they are one answer.
 * The note leads and the jobs follow it, which is the order the question is asked in:
 * what went wrong, then where do I go to see more of it.
 *
 * The jobs are given in the order they were run. Sorting them by duration or by name
 * puts the gate job that failed because something else did above the thing that broke,
 * and the gate job's own log never says what happened.
 */
const Fault = ({
  lead,
  jobs
}: {
  readonly lead: Gathering | undefined
  readonly jobs: ReadonlyArray<Job>
}) => {
  const first = jobs[0]
  const summary =
    jobs.length === 0
      ? undefined
      : jobs.length === 1 && first !== undefined
        ? `${first.name}, after ${said(first.seconds)}`
        : `${jobs.length} jobs failed`

  return (
    <Section name="Fault" art="error" tone="bad" summary={summary}>
      {lead === undefined ? (
        <p className="px-3 py-2.5 text-xs text-ink-muted">
          Nothing was written against it. The log is on GitHub's own page for the job.
        </p>
      ) : (
        <Said note={lead} lead />
      )}
      {jobs.length === 0 ? null : (
        <div className="border-t border-line-muted">
          {jobs.map((job) => (
            <JobRow key={job.name} job={job} />
          ))}
        </div>
      )}
    </Section>
  )
}

/**
 * The jobs, with the green ones counted.
 *
 * Eleven of the twelve jobs on the worked run were green, drawn as eleven rows and then
 * as eleven more in the sidebar, which is how a failed run's first screen ends up with
 * no error on it. Here they are one line in the header and no rows at all. A fold, the
 * way `Checks` folds a pull request's green ones, is the obvious next thing and is not
 * done: a green job's name and duration are worth having, and neither is worth deciding
 * on without the step and log reads that would make the row somewhere to go.
 *
 * Skipped jobs are a number too, which is
 * [#18001](https://github.com/orgs/community/discussions/18001) answered: a job whose
 * `if` was false reports nothing about the run.
 *
 * A job the run carried on past is a row, and it is here rather than above: it failed,
 * so a count would hide the one thing about it worth reading, and it is not a Fault, so
 * putting it above would make a green run open with the word for what broke. That is
 * [#15452](https://github.com/orgs/community/discussions/15452) answered — their own
 * page draws it in the red of a real failure, and this draws it in the grey of
 * something nobody owes a move.
 *
 * The failing jobs are not repeated here. They are the Fault above, with what they said.
 */
const Jobs = ({ jobs }: { readonly jobs: ReadonlyArray<Job> }) => {
  const passed = passedIn(jobs)
  const skipped = skippedIn(jobs)
  const allowed = toleratedIn(jobs)
  const running = jobs.filter((job) => job.state === "running" || job.state === "queued")

  const words = [
    passed.count === 0 ? null : `${passed.count} passed in ${said(passed.seconds)}`,
    running.length === 0 ? null : `${running.length} still going`,
    allowed.length === 0 ? null : `${allowed.length} allowed to fail`,
    skipped === 0 ? null : `${skipped} skipped`
  ].filter((word) => word !== null)

  const rows = [...allowed, ...running]

  // A line rather than a panel where there is nothing to list. A bordered box holding
  // one footnote is the shape of something that failed to load, which is what this
  // section looked like on a finished run: a header, and nothing under it.
  if (rows.length === 0) {
    return <p className="px-1 pt-0.5 text-xs text-ink-muted">{words.join(", ")}</p>
  }

  return (
    <Section name="Jobs" summary={words.join(", ")}>
      {rows.map((job) => (
        <JobRow key={job.name} job={job} />
      ))}
    </Section>
  )
}

/**
 * One workflow run, with the reason it is red at the top.
 *
 * The order is the order anybody asks in, and it is the reverse of GitHub's. What
 * broke, then what else the run said, then what ran. Their page opens with the graph
 * and the grid and puts the error behind three presses: the argument, with the counts,
 * is in `docs/spec/actions.md`.
 *
 * The in-place log is not here yet. A step's log needs the internal job id, which costs
 * one more fetch per failing job, and this screen answers the question without it on
 * every run whose failing job wrote a note. Where it wrote nothing, the screen says so
 * rather than pretending.
 */
export const RunScreen = ({
  reference,
  load,
  preload,
  onStepAside,
  onUseGitHub,
  press
}: RunScreenProps) => {
  const live = useLive(load, preload)
  const { read } = live
  const waiting = useWaiting(read.status)
  const [pressed, setPressed] = useState<Pressed>({ step: "idle" })

  /*
   * The change is shown before GitHub is asked, and the read behind it is what
   * confirms or quietly undoes it. A cancel that waited for their answer would leave
   * a run reading "In progress" for the second and a half their form takes, on the one
   * screen where every word is about a moment that has already moved on.
   *
   * What is claimed is only what the press means: the outcome, and that the press
   * itself is no longer available. Nothing here invents a job list for an attempt
   * that has not started.
   */
  const asked = (what: Pressing) => {
    if (press === undefined) return
    if (pressed.step === "working") return
    if (pressed.step !== "asking" || pressed.what !== what) {
      setPressed({ step: "asking", what })
      return
    }

    setPressed({ step: "working", what })
    Effect.runFork(
      live
        .meanwhile(
          (opening) => ({
            ...opening,
            run: { ...opening.run, state: what === "cancel" ? "cancelled" : "running" },
            presses:
              what === "cancel"
                ? { ...opening.presses, mayCancel: false }
                : { mayRerun: false, mayRerunFailed: false, mayCancel: true }
          }),
          press(what)
        )
        .pipe(
          Effect.map(() => setPressed({ step: "done", what })),
          Effect.catch((cause) =>
            Effect.sync(() => setPressed({ step: "refused", said: reasonFor(cause) }))
          )
        )
    )
  }

  if (read.status === "failed") {
    return (
      <div className="Box my-2 p-4">
        <h2 className="mb-1 text-base font-semibold">This run could not be read</h2>
        <p className="mb-3 max-w-prose text-sm text-ink-muted">
          Nothing is shown rather than part of it. GitHub's own run page is still here.
        </p>
        <button type="button" className="btn btn-sm" onClick={onStepAside}>
          Show GitHub's run
        </button>
      </div>
    )
  }

  const opening = read.status === "ready" ? read.value : undefined
  const faults = opening === undefined ? [] : faultsIn(opening.jobs)
  /*
   * The answer, and therefore the top of the screen. Ranked in the core: the note that
   * says what broke leads, ten copies of one lint opinion are one row, and a note whose
   * whole text is that a process exited non-zero is not an answer at all. See `gathered`
   * in `src/domain/run.ts`.
   *
   * Nothing leads a run GitHub concluded a success. A job the run was told to carry on
   * past still writes its annotation at the failure level — measured on run 31641974931
   * of `flazouh/ghpro-scratch` — so a lead taken without asking what the run came to
   * would head a green run with the word Fault and the sentence "Process completed with
   * exit code 1.". Those notes are still on the screen, under Notes, where they read as
   * what they are.
   */
  const answered = opening !== undefined && opening.run.state === "succeeded"
  const lead = answered
    ? undefined
    : opening?.gathering.find((note) => !saysNothing(note.message))
  const rest = opening === undefined ? [] : opening.gathering.filter((note) => note !== lead)

  return (
    <div className="relative">
      <TheBar
        where={{ kind: "repository", owner: reference.repo.owner, repo: reference.repo.repo }}
        onStepAside={onUseGitHub}
      />
      {opening === undefined ? null : (
        <div className="t-panels flex flex-col pt-2 pb-2">
          <RunHeader
            run={opening.run}
            repo={reference.repo}
            presses={press === undefined ? NOTHING : opening.presses}
            pressed={pressed}
            press={asked}
          />
          <div className="flex flex-col gap-1.5">
            {faults.length === 0 && lead === undefined ? null : (
              <Fault lead={lead} jobs={faults} />
            )}
            {rest.length === 0 ? null : (
              <Section
                name="Notes"
                summary={`${rest.length} more, ${rest.reduce((all, note) => all + note.count, 0)} places`}
              >
                {rest.map((note) => (
                  <div
                    key={note.message}
                    className="border-t border-line-muted first:border-t-0"
                  >
                    <Said note={note} />
                  </div>
                ))}
              </Section>
            )}
            <Jobs jobs={opening.jobs} />
          </div>
        </div>
      )}
      {waiting ? (
        <Waiting
          what={READING}
          detail={`${reference.repo.owner}/${reference.repo.repo} run ${reference.run}`}
          leaving={read.status === "ready"}
        />
      ) : null}
    </div>
  )
}
