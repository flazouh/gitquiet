import {
  AlertFillIcon,
  CheckCircleFillIcon,
  CheckIcon,
  ChevronRightIcon,
  GitMergeIcon,
  LinkExternalIcon,
  XCircleFillIcon
} from "@primer/octicons-react"
import { Option } from "effect"
import { useEffect, useRef, useState } from "react"
import type {
  AutoMerge,
  BlockerAbout,
  BranchUpdate,
  Check,
  CheckNote,
  FileRef,
  LogLine,
  LogSpot,
  Commit,
  MergeQueue,
  MergeState,
  Participant,
  PullRequestSnapshot,
  Review,
  ReviewDecision,
  ReviewThread
} from "../domain/PullRequest"
import { toUrl, type PullRequestRef } from "../domain/PullRequestRef"
import { checkArt } from "./Icon"
import { Markdown } from "./Markdown"
import type { Kept } from "../app/kept"
import { around } from "../github/logs"
import { LogPanel } from "./LogPanel"
import { NEAR, useNearby } from "./near"
import { summarise } from "./summarise"
import { ThreadComments } from "./ThreadView"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

/**
 * A section of the column that says what this pull request is.
 *
 * All four look the same on purpose: a titled box with a line of summary in its
 * header, so the eye runs down one edge rather than learning four layouts.
 */
const Section = ({
  name,
  summary,
  tone = "plain",
  children
}: {
  readonly name: string
  readonly summary?: React.ReactNode
  readonly tone?: "plain" | "bad"
  readonly children: React.ReactNode
}) => (
  <section
    aria-label={name}
    // Never shrunk: a flex child left to its own devices gives up its height to
    // its neighbours, which is how opening the description once squashed CI and
    // the conversation into two bars.
    className={`shrink-0 overflow-hidden rounded-md border ${
      tone === "bad" ? "border-fail" : "border-line"
    }`}
  >
    <div
      className={`flex items-center gap-2 border-b px-3 py-2 ${
        tone === "bad" ? "border-fail bg-fail-muted" : "border-line bg-surface"
      }`}
    >
      <h2 className="text-xs font-semibold">{name}</h2>
      {summary === undefined ? null : (
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{summary}</span>
      )}
    </div>
    {children}
  </section>
)

/**
 * What the Author wrote: the first screenful of it, and the rest on a click.
 *
 * A fold that says nothing is a fold nobody opens, so the top of the
 * description is always on the page — enough to see what kind of thing this is
 * — with a fade at the cut to say the words carry on. Kept to a height rather
 * than shown whole because a three-hundred-line description would put CI and
 * the conversation a screen below the fold, and those are what a reviewer came
 * for.
 *
 * Opened, the ceiling goes altogether: all of it, at whatever length it was
 * written, with the page scrolling rather than a box inside the card. Asking
 * for the whole of something and being given a second, smaller window onto it
 * is the thing this used to get wrong.
 */
export const Description = ({ html }: { readonly html: string }) => {
  const [whole, setWhole] = useState(false)

  return (
    <Section name="Description">
      <div className="relative">
        <div
          className={`px-3 py-3 ${whole ? "" : "overflow-hidden"}`}
          style={whole ? undefined : { maxHeight: "13rem" }}
        >
          <Markdown html={html} />
        </div>
        {whole ? null : (
          // Over the last of the text rather than under it: the fade is what
          // says the words carry on, and a gap between the two would read as
          // the description simply ending there.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{
              background: "linear-gradient(to bottom, transparent, var(--bgColor-default))"
            }}
          />
        )}
      </div>
      <div className="px-3 pb-2">
        <button
          type="button"
          className="text-xs text-ink-accent hover:underline"
          onClick={() => setWhole((open) => !open)}
        >
          {whole ? "Show less" : "Show all of it"}
        </button>
      </div>
    </Section>
  )
}

const failing = (checks: ReadonlyArray<Check>) => checks.filter((check) => check.state === "failed")

const CHECK_TONE: Record<Check["state"], string> = {
  succeeded: "text-pass",
  failed: "text-fail",
  // `busy` is `--fgColor-attention`, the yellow GitHub gives to work in hand.
  // This said `text-attention` for a long time, which is not a colour this
  // interface has: both states have been rendering in plain body text.
  running: "text-busy",
  queued: "text-busy",
  cancelled: "text-ink-muted",
  skipped: "text-ink-muted",
  neutral: "text-ink-muted"
}

const CheckRow = ({ check, onOpen }: { readonly check: Check; readonly onOpen: () => void }) => {
  const Art = checkArt(check.state)

  return (
    <button
      type="button"
      onClick={onOpen}
      {...{ [NEAR]: check.name }}
      className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-hover"
    >
      <Art size={12} className={`shrink-0 translate-y-0.5 ${CHECK_TONE[check.state]}`} />
      <span className="shrink-0 text-xs font-semibold">{check.name}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{check.summary}</span>
    </button>
  )
}

/**
 * Something being read from GitHub: not here yet, here, or it went wrong.
 *
 * One shape for every panel that waits on a request, so waiting looks the same
 * wherever it happens rather than each place inventing its own three states.
 */
export type Reading<Value> =
  | { readonly step: "loading" }
  | { readonly step: "ready"; readonly value: Value }
  | { readonly step: "failed" }

/**
 * One check, in front of everything else, because a red build is read before it
 * is acted on.
 *
 * Their own account of the failure and a way to the log: GitHub redirects the
 * log itself to storage on another origin, which a page cannot read, so the
 * link goes to the run — which is where anyone reading a stack trace ends up
 * anyway.
 */
const CheckDialog = ({
  check,
  library,
  logs,
  tails,
  reach,
  onClose
}: {
  readonly check: Check
  readonly library?: CheckNotes
  readonly logs?: CheckLogs
  readonly tails?: CheckTails
  readonly reach?: LogReach
  readonly onClose: () => void
}) => {
  const frame = useRef<HTMLDialogElement | null>(null)
  const Art = checkArt(check.state)
  const notes = useReading(library, check.name)

  useEffect(() => {
    const box = frame.current
    if (box === null) return

    // Modal rather than merely visible: it takes the focus and the page behind
    // it goes inert.
    box.showModal()

    // Escape is answered here rather than left to the browser. This interface
    // lives inside GitHub's page, among their handlers and our own, and the
    // browser's way out of a dialog is cancelled by anything upstream that
    // calls preventDefault on the keypress first — which is a way out that
    // works until the day someone adds a shortcut, and then silently does not.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return
      event.preventDefault()
      event.stopPropagation()
      box.close()
    }

    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])

  return (
    <dialog
      ref={frame}
      onClose={onClose}
      // A press on the dialog element itself is a press on the backdrop: the
      // card fills its box, so anything landing on the box landed beside the
      // card. The reader who clicks away from a thing expects it to go.
      onClick={(event) => {
        if (event.target === event.currentTarget) frame.current?.close()
      }}
      aria-label={check.name}
      // Wide enough for a log line. Compiler and stack output runs long, and a
      // narrow dialog turns every line into three.
      className="w-[56rem] max-w-[92vw] rounded-md border border-line bg-canvas p-0 text-ink backdrop:bg-black/50"
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <Art size={14} className={`shrink-0 ${CHECK_TONE[check.state]}`} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{check.name}</h2>
        <button
          type="button"
          onClick={() => frame.current?.close()}
          className="text-xs text-ink-muted"
        >
          Close
        </button>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-sm text-ink-muted">
          {check.summary === "" ? `${check.state} after ${check.durationSeconds}s` : check.summary}
        </p>
        <Notes check={check} notes={notes} logs={logs} reach={reach} />
        {notes.step === "ready" && !notes.value.some((note) => Option.isSome(note.at)) ? (
          <LogTail check={check} tails={tails} reach={reach} />
        ) : null}
        <a
          href={check.url}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-ink-accent"
        >
          <LinkExternalIcon size={12} />
          Open the full log on GitHub
        </a>
      </div>
    </dialog>
  )
}

/** Everything read from a check page, held so a second look is free. */
export type CheckNotes = Kept<string, ReadonlyArray<CheckNote>>

/** A step's log, held under `check name:step`. */
export type CheckLogs = Kept<string, ReadonlyArray<LogLine>>

/** The end of a check's whole log, held under the check's name. */
export type CheckTails = Kept<string, ReadonlyArray<LogLine>>

/** The key a whole log is held under, as against the tail of the same one. */
export const wholeKey = (check: Check): string => `${check.name}:whole`

/** What a log can reach out to: the files this pull request touches. */
export type LogReach = {
  readonly paths?: ReadonlyArray<string>
  readonly onOpenFile?: (path: string, line: number) => void
  readonly hrefFor?: (ref: FileRef) => string
}

/** The key a step's log is held under, so both sides agree on one spelling. */
export const logKey = (check: Check, step: number): string => `${check.name}:${step}`

const NOTE_TONE: Record<CheckNote["level"], string> = {
  failure: "text-fail",
  warning: "text-busy",
  notice: "text-ink-muted"
}

/**
 * What GitHub wrote against the check, in the dialog rather than a tab away.
 *
 * Silent when there is nothing: a check often fails with no annotation at all,
 * and an empty box saying "no annotations" is noise in front of the link that
 * actually helps. Silent too when the reading failed — the link below it is
 * still there, and it is what a reader would have used anyway.
 */
const Notes = ({
  check,
  notes,
  logs,
  reach
}: {
  readonly check: Check
  readonly notes: Reading<ReadonlyArray<CheckNote>>
  readonly logs?: CheckLogs
  readonly reach?: LogReach
}) => {
  if (notes.step === "loading") {
    return <p className="text-xs text-ink-muted">Reading what GitHub said…</p>
  }
  if (notes.step === "failed" || notes.value.length === 0) return null

  return (
    <ul className="flex flex-col divide-y divide-line-muted overflow-hidden rounded-md border border-line">
      {notes.value.map((note, at) => (
        <li key={`${note.where}:${at}`} className="flex flex-col gap-1 px-3 py-2">
          <span className={`text-xs font-semibold ${NOTE_TONE[note.level]}`}>{note.where}</span>
          {/* Their words, wrapped and monospaced: these are compiler and test
              output, where a broken line break changes what it says. */}
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-snug text-ink">
            {note.message}
          </pre>
          {Option.isNone(note.at) ? null : (
            <LogPeek check={check} spot={note.at.value} logs={logs} reach={reach} />
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Something read from GitHub, waited on only when it is not already here.
 *
 * A pointer that passed over the row has usually finished this before the
 * click, in which case there is no waiting at all and no spinner to see.
 */
const useReading = <Value,>(
  library: Kept<string, ReadonlyArray<Value>> | undefined,
  name: string
): Reading<ReadonlyArray<Value>> => {
  const held = library?.held(name)
  const [reading, setReading] = useState<Reading<ReadonlyArray<Value>>>(
    library === undefined
      ? { step: "ready", value: [] }
      : held === undefined
        ? { step: "loading" }
        : { step: "ready", value: held }
  )

  useEffect(() => {
    if (library === undefined) return
    let wanted = true

    library.ask(name).then(
      (value) => {
        if (wanted) setReading({ step: "ready", value })
      },
      () => {
        if (wanted) setReading({ step: "failed" })
      }
    )

    return () => {
      wanted = false
    }
  }, [library, name])

  return reading
}

/**
 * The log around the line the note points at.
 *
 * A window rather than the whole step: the note names a line, the lines that
 * led to it are the context, and everything before that is the runner setting
 * itself up. The panel takes it from there — folding, errors, files and all.
 */
const LogPeek = ({
  check,
  spot,
  logs,
  reach
}: {
  readonly check: Check
  readonly spot: LogSpot
  readonly logs?: CheckLogs
  readonly reach?: LogReach
}) => {
  const reading = useReading(logs, logKey(check, spot.step))

  if (logs === undefined || reading.step === "failed") return null
  if (reading.step === "loading") {
    return <p className="text-xs text-ink-muted">Reading the log…</p>
  }
  if (reading.value.length === 0) return null

  return <LogPanel lines={around(reading.value, spot.line)} mark={spot.line} {...reach} />
}

/**
 * The end of the whole log, for a check that pointed at no line of it.
 *
 * Read as soon as the dialog opens, green or red. Opening a check is the ask —
 * there is nothing else in here for a check GitHub wrote no annotation against,
 * and a button in front of the only content is a click that exists to be
 * clicked. It costs one request for the last couple of hundred lines, which is
 * already how the panel reads a failing check.
 */
const LogTail = ({
  check,
  tails,
  reach
}: {
  readonly check: Check
  readonly tails?: CheckTails
  readonly reach?: LogReach
}) => {
  const [whole, setWhole] = useState(false)
  const reading = useReading(tails, whole ? wholeKey(check) : check.name)

  if (tails === undefined) return null
  if (reading.step === "loading") return <p className="text-xs text-ink-muted">Reading the log…</p>
  if (reading.step === "failed") {
    return <p className="text-xs text-ink-muted">That log could not be read from here.</p>
  }
  if (reading.value.length === 0) {
    return <p className="text-xs text-ink-muted">GitHub keeps no log for this check.</p>
  }

  return (
    <LogPanel
      lines={reading.value}
      onWhole={whole ? undefined : () => setWhole(true)}
      {...reach}
    />
  )
}

/**
 * Whether the build is red, said in the first four words.
 *
 * Only the failures are listed. Twenty-nine green checks are worth one line
 * saying they are green; the two red ones are the reason anyone opened this.
 */
export const Checks = ({
  checks,
  library,
  logs,
  tails,
  reach
}: {
  readonly checks: ReadonlyArray<Check>
  /** Reads what GitHub wrote against a check, when anything is wired to. */
  readonly library?: CheckNotes
  /** Reads the log a note points into, when anything is wired to. */
  readonly logs?: CheckLogs
  /** Reads the end of a whole log, for checks no note points into. */
  readonly tails?: CheckTails
  /** What a file named in a log can be opened as. */
  readonly reach?: LogReach
}) => {
  const [opened, setOpened] = useState<Check | undefined>(undefined)

  // Read on the way past. A red check is nearly always clicked once the eye
  // reaches it, and the reading takes about as long as that decision does.
  const nearby = useNearby<string>({
    onNear: (name) => library?.warm(name),
    enabled: library !== undefined
  })

  const red = failing(checks)
  const rest = checks.filter((check) => check.state !== "failed")
  const passed = rest.filter((check) => check.state === "succeeded").length

  if (checks.length === 0) {
    return (
      <Section name="Checks">
        <p className="px-3 py-2 text-sm text-ink-muted">Nothing has run yet</p>
      </Section>
    )
  }

  const summary =
    red.length === 0 ? (
      <span className="flex items-center gap-1.5">
        <CheckCircleFillIcon size={12} className="text-pass" />
        {`All ${checks.length} ${checks.length === 1 ? "check" : "checks"} passed`}
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-fail">
        <AlertFillIcon size={12} />
        {`CI is red — ${red.length} of ${checks.length} failing`}
      </span>
    )

  return (
    <Section name="Checks" tone={red.length === 0 ? "plain" : "bad"} summary={summary}>
      <div ref={nearby}>
      {/* Failures open, everything else behind one line: a green check has
          nothing to say, and thirty of them said at once are a wall. */}
      {red.map((check) => (
        <CheckRow key={check.name} check={check} onOpen={() => setOpened(check)} />
      ))}
      {rest.length === 0 ? null : (
        <details className="group border-t border-line-muted first:border-t-0">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs text-ink-muted hover:bg-hover [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon
              size={12}
              className="shrink-0 transition-transform duration-150 group-open:rotate-90"
            />
            {passed === rest.length
              ? `${passed} passed`
              : `${passed} passed, ${rest.length - passed} other`}
          </summary>
          {rest.map((check) => (
            <CheckRow key={check.name} check={check} onOpen={() => setOpened(check)} />
          ))}
        </details>
      )}
      </div>
      {opened === undefined ? null : (
        <CheckDialog
          check={opened}
          library={library}
          logs={logs}
          tails={tails}
          reach={reach}
          onClose={() => setOpened(undefined)}
          // A dialog for another check is another reading, and holding the
          // first one's state through the swap would show its notes under the
          // second one's name.
          key={opened.name}
        />
      )}
    </Section>
  )
}

/** How many faces a folded line carries before the rest become a number. */
const SHOWN = 3

/**
 * Everyone who spoke in a thread, once each, in the order they first did.
 *
 * A thread where one person wrote four times is one person, and a face per
 * comment would say the opposite.
 */
const speakersIn = (thread: ReviewThread): ReadonlyArray<Participant> => {
  const seen = new Map<string, Participant>()
  for (const comment of thread.comments) {
    if (!seen.has(comment.author.login)) seen.set(comment.author.login, comment.author)
  }
  return [...seen.values()]
}

/**
 * Who is in this thread, as faces rather than as a login.
 *
 * A login is read letter by letter and takes as much of a four-hundred pixel
 * column as the remark itself does — and the remark is the part worth reading.
 * A face is recognised without being read, several of them fit where one name
 * did, and the name is still one hover away.
 */
const Faces = ({ people }: { readonly people: ReadonlyArray<Participant> }) => (
  <span className="flex shrink-0 items-center">
    {people.slice(0, SHOWN).map((person) => (
      // Overlapped, with a ring in the panel's own colour so the one behind
      // reads as behind rather than as a smudge on the one in front.
      <span key={person.login} className="-ml-1.5 rounded-full ring-2 ring-canvas first:ml-0">
        <Who login={person.login} src={Option.getOrUndefined(person.faceUrl)} />
      </span>
    ))}
    {people.length > SHOWN ? (
      <span className="pl-1 text-xs text-ink-muted tabular-nums">{`+${people.length - SHOWN}`}</span>
    ) : null}
  </span>
)

const Thread = ({ thread }: { readonly thread: ReviewThread }) => {
  const [first] = thread.comments

  return (
    <details className="group border-b border-line-muted last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-hover [&::-webkit-details-marker]:hidden">
        {/* The mark carries the state, not the dimming beside it: a settled
            thread that is only paler is a thread that says nothing at all to
            anyone reading this through a screen reader or in high contrast. */}
        {thread.isResolved ? (
          <CheckIcon size={12} aria-label="Resolved" className="shrink-0 text-pass" />
        ) : (
          <ChevronRightIcon
            size={12}
            className="shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-90"
          />
        )}
        {/* Receded rather than removed. A settled thread is still the record of
            why the code looks like this, and hiding it means the answer to
            "didn't we discuss this" is a trip back to GitHub. */}
        <span
          className={`flex min-w-0 flex-1 items-center gap-2 ${
            thread.isResolved ? "opacity-60" : ""
          }`}
        >
          <Faces people={speakersIn(thread)} />
          <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
            {summarise(first?.body ?? "")}
          </span>
          <span className="shrink-0 text-xs text-ink-muted tabular-nums">
            {thread.comments.length}
          </span>
        </span>
      </summary>
      <div className="border-t border-line-muted">
        <ThreadComments thread={thread} />
      </div>
    </details>
  )
}

/**
 * How much of the conversation is still waiting on somebody.
 *
 * The open count leads because it is the number that decides whether this
 * pull request is finished. Saying "8 threads" counts a week of settled
 * nitpicks and the one live objection as the same thing.
 */
export const saidSoFar = (threads: ReadonlyArray<ReviewThread>): string => {
  if (threads.length === 0) return "nothing said yet"

  const resolved = threads.filter((thread) => thread.isResolved).length
  const open = threads.length - resolved

  if (resolved === 0) return `${open} open`
  if (open === 0) return `all ${resolved} resolved`
  return `${open} open, ${resolved} resolved`
}

/**
 * What still wants an answer, above what does not.
 *
 * Stable within each half, so the order GitHub sent them in survives — which
 * for review threads is the order they were opened.
 */
const unansweredFirst = (threads: ReadonlyArray<ReviewThread>): ReadonlyArray<ReviewThread> =>
  [...threads].sort((one, other) => Number(one.isResolved) - Number(other.isResolved))

/**
 * Everything anyone said, folded.
 *
 * One line per thread — who spoke and what about — because a pull request with
 * twenty threads is a wall of text otherwise, and the wall was the complaint
 * that started this whole thing.
 */
export const Conversation = ({ threads }: { readonly threads: ReadonlyArray<ReviewThread> }) => (
  <Section name="Conversation" summary={saidSoFar(threads)}>
    {threads.length === 0 ? (
      <></>
    ) : (
      unansweredFirst(threads).map((thread) => <Thread key={thread.id} thread={thread} />)
    )}
  </Section>
)

/**
 * The count, and how long since the last one.
 *
 * What becomes of them on merge is the merge card's business, not this one's:
 * it depends on the button pressed and on which repository this is, and saying
 * "squashed into one" here was a claim about our own button made in a section
 * that only lists what happened. The age is the part worth reading at a glance
 * — a branch nobody has touched in three weeks is a different thing to review
 * than one still moving.
 */
const howMany = (commits: ReadonlyArray<Commit>): string => {
  if (commits.length === 0) return "none yet"

  const newest = commits.reduce(
    (latest, commit) => (commit.createdAt > latest ? commit.createdAt : latest),
    commits[0]?.createdAt ?? ""
  )
  const age = ageOf(newest)
  if (commits.length === 1) return age === "" ? "one" : `one, ${age}`

  return age === "" ? `${commits.length}` : `${commits.length}, newest ${age}`
}

/**
 * The commits, folded away.
 *
 * Deliberately not a panel. The wall of commits is what this interface exists
 * to take down, and on a branch an agent wrote most of them say "fix lint" —
 * reading them is not how anyone reviews. But nothing else here shows them and
 * GitHub's own tab is hidden, so this is the way back to a sha when a check
 * blames one, and it is closed until then.
 */
export const Commits = ({
  commits,
  repository,
  onOpen,
  onWarm,
  opened
}: {
  readonly commits: ReadonlyArray<Commit>
  readonly repository?: PullRequestRef
  /** Reads this commit in the panel beside, when anything is wired to do that. */
  readonly onOpen?: (sha: string) => void
  /** Called as the pointer nears a row, in time to have read it before the click. */
  readonly onWarm?: (sha: string) => void
  readonly opened?: string
}) => {
  // The pointer on its way down the list has already said which row it is
  // going to reach; reading that commit now is the difference between a click
  // that opens something and a click that starts waiting for it.
  const nearby = useNearby<string>({
    onNear: (sha) => onWarm?.(sha),
    enabled: onWarm !== undefined
  })

  return (
  <Section name="Commits" summary={howMany(commits)}>
    {commits.length === 0 ? (
      <></>
    ) : (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs text-ink-muted hover:bg-hover [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon
            size={12}
            className="shrink-0 transition-transform duration-150 group-open:rotate-90"
          />
          Show them
        </summary>
        {/* Opened, all of them: the fold is what keeps the wall of commits out
          of the way, so once someone has asked for it there is no second limit
          to fight. */}
        <div ref={nearby} className="divide-y divide-line-muted border-t border-line-muted">
          {commits.map((commit) => (
            <a
              key={commit.sha}
              // A real link even when it opens beside: the address is worth
              // copying, and a modified click still belongs to GitHub.
              href={
                repository === undefined
                  ? undefined
                  : `https://github.com/${repository.owner}/${repository.repo}/commit/${commit.sha}`
              }
              onClick={
                onOpen === undefined
                  ? undefined
                  : (event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey) return
                      event.preventDefault()
                      onOpen(commit.sha)
                    }
              }
              {...{ [NEAR]: commit.sha }}
              aria-current={commit.sha === opened ? "true" : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-hover ${
                commit.sha === opened ? "bg-hover" : ""
              }`}
            >
              <Who login={commit.author} />
              <code className="shrink-0 font-mono text-xs text-ink-muted">
                {commit.abbreviatedSha}
              </code>
              <span className="min-w-0 flex-1 truncate text-xs">{commit.headline}</span>
              <span
                title={momentOf(commit.createdAt)}
                className="shrink-0 text-xs text-ink-muted tabular-nums"
              >
                {ageOf(commit.createdAt)}
              </span>
            </a>
          ))}
        </div>
      </details>
    )}
    </Section>
  )
}

export type MergeActions = {
  /** Merges it. Rejects with something worth reading when GitHub refuses. */
  readonly merge?: () => Promise<void>
  /** Puts it in the queue, on the repositories that land through one. */
  readonly enqueue?: () => Promise<void>
  /** Takes it back out of the queue it is standing in. */
  readonly dequeue?: () => Promise<void>
  /** Calls off a merge GitHub is holding until this becomes mergeable. */
  readonly cancel?: () => Promise<void>
  /** Catches the branch up with the one it would land on. */
  readonly update?: () => Promise<void>
  /** Called once the merge lands, for whoever wants the page read again. */
  readonly onMerged?: () => void
  /**
   * Called after a write that changed the pull request without ending it.
   *
   * Joining a queue and leaving one both move facts this card cannot work out
   * for itself — a place in the line is GitHub's to know — so the card asks to
   * be told again rather than guessing at the state it just caused.
   */
  readonly onChanged?: () => void
  readonly close?: () => void
}

/**
 * The four things this card can ask GitHub for.
 *
 * One state machine rather than four, because they cannot overlap: a pull
 * request being queued is not also being merged, and a second machine would
 * only make that expressible.
 */
type Doing = "merge" | "enqueue" | "dequeue" | "cancel" | "update"

type Merging =
  | { readonly step: "idle" }
  | { readonly step: "asking"; readonly doing: Doing }
  | { readonly step: "working"; readonly doing: Doing }
  | { readonly step: "done"; readonly doing: Doing }
  | { readonly step: "refused"; readonly said: string }

/**
 * Merging and closing, in the one place someone looks for them.
 *
 * The buttons are disabled while nothing can act on them rather than hidden:
 * hiding a control makes a reader hunt for it, and a merge button that GitHub
 * would refuse is worse than one that says why it would.
 *
 * Merging asks twice. Not a dialog — a dialog is dismissed without being read —
 * but the same button, saying what it is about to do, so the second press is a
 * decision rather than the end of a double-click.
 */
export const Merge = ({
  merge,
  base,
  commits = 0,
  running = 0,
  url,
  reviews = [],
  actions
}: {
  readonly merge: MergeState
  /** The branch this would land on, named rather than called "the base branch". */
  readonly base?: string
  /** How many commits the squash would flatten into one. */
  readonly commits?: number
  /** Checks that have not finished, which merging now would not wait for. */
  readonly running?: number
  /** This pull request on GitHub, where the queue is joined. */
  readonly url?: string
  /** Everyone who has given a verdict, so the card says whether it has one. */
  readonly reviews?: ReadonlyArray<Review>
  readonly actions?: MergeActions
}) => {
  const [merging, setMerging] = useState<Merging>({ step: "idle" })

  const press = (doing: Doing) => {
    const act = actions?.[doing]
    if (act === undefined) return
    if (merging.step !== "asking" || merging.doing !== doing) {
      setMerging({ step: "asking", doing })
      return
    }

    setMerging({ step: "working", doing })
    act().then(
      () => {
        setMerging({ step: "done", doing })
        // A merge ends the reading; the queue verbs only change what this card
        // has to say, and the page around it stays worth looking at.
        if (doing === "merge") actions?.onMerged?.()
        else actions?.onChanged?.()
      },
      (cause: unknown) => setMerging({ step: "refused", said: reasonFor(cause) })
    )
  }

  const about = (doing: Doing): string =>
    doing === "merge"
      ? whatHappens({ base, commits, running })
      : doing === "update"
        ? whatCatchingUp(merge.update, base)
        : whatQueueing(doing, base)

  return (
    <MergeCard
      merge={merge}
      about={about}
      running={running}
      merging={merging}
      url={url}
      reviews={reviews}
      actions={actions}
      press={press}
      onCancel={() => setMerging({ step: "idle" })}
    />
  )
}

/**
 * What GitHub said, out of whatever the failure arrived wrapped in.
 *
 * The gateway's own error carries the sentence from their answer; anything else
 * is a network fault, and saying so plainly beats printing an object.
 */
const reasonFor = (cause: unknown): string => {
  const detail = (cause as { detail?: unknown })?.detail
  if (typeof detail === "string" && detail.length > 0) return detail
  return "GitHub could not be reached."
}

/**
 * The sentence the second press is agreeing to.
 *
 * Named branch and counted commits, because "this squashes the branch into the
 * base branch" describes every squash merge ever made and so tells the reader
 * nothing about theirs. The checks clause appears only when a check is actually
 * unfinished — a warning that is always there stops being read.
 */
export const whatHappens = ({
  base,
  commits,
  running
}: {
  readonly base?: string
  readonly commits: number
  readonly running: number
}): string => {
  const onto = base === undefined || base === "" ? "the base branch" : base
  const landing =
    commits === 1
      ? `Adds this branch's one commit to ${onto}.`
      : commits > 1
        ? `Combines ${commits} commits into one and adds it to ${onto}.`
        : `Squashes this branch into ${onto}.`
  const waiting =
    running === 0
      ? ""
      : running === 1
        ? " One check has not finished, and merging now does not wait for it."
        : ` ${running} checks have not finished, and merging now does not wait for them.`

  return `${landing} Undoing it means opening a revert on GitHub.${waiting}`
}

/**
 * What the summary line says on a repository with a queue.
 *
 * The queue outranks everything else that could be said there. "ready to merge"
 * beside a pull request that is third in a line, or that has to be enqueued
 * before anything happens at all, is not a shade of wrong — it is the reader
 * being told they can land it now.
 */
const queueWord = (queue: MergeQueue, armed: boolean): string =>
  queue.waiting
    ? Option.isSome(queue.position)
      ? `waiting in the merge queue, position ${queue.position.value}`
      : "waiting in the merge queue"
    : armed
      ? // Nothing has visibly moved and something has happened: GitHub is
        // holding this and will queue it the moment its requirements pass.
        // Without saying so, the card reads as if the press did nothing.
        "merges when it is ready"
      : "merges through a merge queue"

/**
 * The sentence the second press agrees to, for the two queue verbs.
 *
 * Joining a queue is the thing readers get wrong, because the button their
 * hand knows says "merge" and this one does not merge: it hands the pull
 * request to GitHub, which decides when. Saying so is the whole point of
 * asking twice.
 */
const whatQueueing = (doing: Doing, base?: string): string => {
  const onto = base === undefined || base === "" ? "the base branch" : base
  if (doing === "enqueue") {
    return `Adds this to the merge queue. GitHub tests it against whatever is ahead of it and merges it into ${onto} when its turn comes, which may be a while. Nothing lands now.`
  }
  if (doing === "cancel") {
    return "Calls off the merge GitHub is holding. Nothing is merged, and this stays open until somebody asks again."
  }
  return "Takes this out of the line. Whatever is queued behind it is tested again without it."
}

/** Which section on this page answers a blocker of each kind. */
const SECTION_FOR: Record<BlockerAbout, string> = {
  checks: "Checks",
  conversation: "Conversation"
}

/**
 * Puts the part of the page that answers a blocker in front of the reader.
 *
 * By the section's own label rather than an identifier threaded down through
 * four components: these sections are one column apart, and the label is
 * already there because a screen reader needs it.
 *
 * Searched outward from the button rather than across the document, because
 * GitHub's own page is still underneath this one — hidden, not removed — and
 * it labels its regions the same words. Asked of the document, this found
 * theirs, and scrolling to something with `display: none` is indistinguishable
 * from a button that does nothing. The first ancestor holding a section of
 * that name is ours, since ours are siblings in one column.
 */
const jumpTo = (about: Option.Option<BlockerAbout>, from: Element): void => {
  if (Option.isNone(about)) return

  const wanted = `section[aria-label="${SECTION_FOR[about.value]}"]`
  for (let here = from.parentElement; here !== null; here = here.parentElement) {
    const section = here.querySelector(wanted)
    // Absent in a test environment that stops short of layout. Not worth
    // throwing over: the reader pressed a link, not a control.
    // Instantly, not smoothly. A smooth scroll is an animation some Chromium
    // builds decline to run — it did nothing at all in the one this was tested
    // in — and a jump that silently does not happen is worse than an abrupt
    // one that does.
    if (section !== null) return void section.scrollIntoView?.({ block: "start" })
  }
}

/**
 * The sentence the second press agrees to, for catching a branch up.
 *
 * The two ways of doing it are not the same promise: a merge leaves the
 * branch's history alone and adds a commit to it, a rebase replaces every
 * commit on it with a new one. Anybody with the branch checked out feels the
 * difference, so the button says which it is about to do.
 */
const whatCatchingUp = (update: Option.Option<BranchUpdate>, base?: string): string => {
  const from = base === undefined || base === "" ? "the base branch" : base
  const how = Option.isSome(update) ? update.value.how : "MERGE"

  return how === "REBASE"
    ? `Replays this branch on top of ${from}, which rewrites every commit on it. Anybody who has it checked out has to fetch it again. The checks run once more against the new head.`
    : `Merges ${from} into this branch, adding a merge commit. The checks run once more against the new head.`
}

/**
 * The queue's own page, named for what it is.
 *
 * GitHub's page when they gave one — it shows what is ahead of this — and the
 * pull request otherwise, where their own controls live. Nothing at all if
 * neither is known: a link to nowhere is worse than no link.
 */
const QueueLink = ({
  queue,
  url
}: {
  readonly queue: MergeQueue
  readonly url?: string
}) => {
  const target = Option.getOrUndefined(queue.url) ?? url
  if (target === undefined) return <>the merge queue</>

  return (
    <a
      href={target}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-link underline"
    >
      the merge queue
      <LinkExternalIcon size={12} />
    </a>
  )
}

/**
 * The one control a queue leaves: in, or back out.
 *
 * Which of the two is on offer is not a preference — a pull request already in
 * the line cannot be put in it again — so this is one button whose verb is
 * decided by where the pull request stands.
 *
 * Joining is refused for two different reasons and they are worth keeping
 * apart: `viewerCanQueue` is about the Participant, `mayJoin` is GitHub's
 * verdict on this pull request. Both have to be yes, and reading only the
 * first offers a button whose press comes back as an error.
 */
/** What each verb calls itself, at rest, while asking, and while running. */
const QUEUE_WORDS: Record<
  "enqueue" | "dequeue" | "cancel",
  { readonly rest: string; readonly asking: string; readonly working: string; readonly done: string }
> = {
  enqueue: {
    rest: "Merge when ready",
    asking: "Confirm merge when ready",
    working: "Joining the queue…",
    done: "Queued"
  },
  dequeue: {
    rest: "Remove from the queue",
    asking: "Confirm remove from the queue",
    working: "Removing…",
    done: "Removed"
  },
  cancel: {
    rest: "Cancel merge when ready",
    asking: "Confirm cancel merge when ready",
    working: "Cancelling…",
    done: "Cancelled"
  }
}

const QueueButton = ({
  queue,
  autoMerge,
  merging,
  actions,
  press
}: {
  readonly queue: MergeQueue
  readonly autoMerge: Option.Option<AutoMerge>
  readonly merging: Merging
  readonly actions?: MergeActions
  readonly press: (doing: Doing) => void
}) => {
  // Three states, one after the other: armed, then standing in the line, then
  // merged. Offering "merge when ready" to a pull request already armed asks
  // GitHub for something it has, and comes back refused.
  const doing: "enqueue" | "dequeue" | "cancel" = queue.waiting
    ? "dequeue"
    : Option.isSome(autoMerge)
      ? "cancel"
      : "enqueue"
  const busy = merging.step === "working" || merging.step === "done"
  const asking = merging.step === "asking" && merging.doing === doing

  const words = QUEUE_WORDS[doing]
  const label = busy
    ? merging.step === "done"
      ? words.done
      : words.working
    : asking
      ? words.asking
      : words.rest

  const leaving = doing !== "enqueue"

  return (
    <button
      type="button"
      disabled={
        actions?.[doing] === undefined ||
        !queue.viewerCanQueue ||
        (doing === "enqueue" && !queue.mayJoin) ||
        (doing === "cancel" &&
          Option.isSome(autoMerge) &&
          !autoMerge.value.viewerCanCancel) ||
        busy
      }
      onClick={() => press(doing)}
      className={
        leaving
          ? "whitespace-nowrap rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-fail disabled:opacity-50"
          : "whitespace-nowrap rounded-md bg-pass-emphasis px-3 py-1.5 text-xs font-semibold text-ink-on-emphasis disabled:opacity-50"
      }
    >
      {label}
    </button>
  )
}

/** What each verdict is called, in GitHub's own words for it. */
const VERDICT_WORD: Record<ReviewDecision, string> = {
  approved: "approved",
  "changes-requested": "requested changes",
  commented: "commented",
  dismissed: "review dismissed"
}

const VERDICT_TONE: Record<ReviewDecision, string> = {
  approved: "text-pass",
  "changes-requested": "text-fail",
  commented: "text-ink-muted",
  dismissed: "text-ink-muted"
}

/**
 * An objection outranks an approval, and both outrank a remark.
 *
 * One reviewer asking for changes is the fact that decides whether this lands,
 * so it goes first however many approvals are stacked on top of it.
 */
const RANK: Record<ReviewDecision, number> = {
  "changes-requested": 0,
  approved: 1,
  commented: 2,
  dismissed: 3
}

/**
 * Whether anyone has passed judgement, in the card that asks to merge.
 *
 * GitHub has been sending this all along and nothing on this screen showed it,
 * which left "has anyone actually reviewed this" as a question the interface
 * could not answer — asked directly above the button that lands the change.
 */
const Verdicts = ({ reviews }: { readonly reviews: ReadonlyArray<Review> }) => {
  if (reviews.length === 0) return null

  const ordered = [...reviews].sort(
    (one, other) => RANK[one.decision] - RANK[other.decision]
  )

  return (
    <ul className="divide-y divide-line-muted border-b border-line-muted">
      {ordered.map((review) => {
        const Art = review.decision === "changes-requested" ? XCircleFillIcon : CheckIcon

        return (
          <li
            key={`${review.reviewer.login}:${review.decision}`}
            className="flex items-center gap-2 px-3 py-2 text-xs text-ink-muted"
          >
            <Art size={12} className={`shrink-0 ${VERDICT_TONE[review.decision]}`} />
            <Who
              login={review.reviewer.login}
              src={Option.getOrUndefined(review.reviewer.faceUrl)}
            />
            <span className="font-semibold text-ink">{review.reviewer.login}</span>
            <span>{VERDICT_WORD[review.decision]}</span>
          </li>
        )
      })}
    </ul>
  )
}

const MergeCard = ({
  merge,
  about,
  running,
  merging,
  url,
  reviews,
  actions,
  press,
  onCancel
}: {
  readonly merge: MergeState
  readonly about: (doing: Doing) => string
  readonly running: number
  readonly merging: Merging
  readonly url?: string
  readonly reviews: ReadonlyArray<Review>
  readonly actions?: MergeActions
  readonly press: (doing: Doing) => void
  readonly onCancel: () => void
}) => (
  <Section
    name="Merge"
    summary={
      <span className="flex items-center gap-1.5">
        <GitMergeIcon size={12} className={merge.isMergeable ? "text-pass" : "text-ink-muted"} />
        {/* Whether a check is still running is read off the checks, not off
            GitHub's word for mergeable: a repository with required checks
            answers MERGEABLE_IF_STATUSES_PASS even when every one of them has
            already passed, and this said they were running for hours. */}
        {Option.isSome(merge.queue)
          ? queueWord(merge.queue.value, Option.isSome(merge.autoMerge))
          : merge.isMergeable
            ? running > 0
              ? `ready, ${running === 1 ? "one check" : `${running} checks`} still running`
              : "ready to merge"
            : "blocked"}
      </span>
    }
  >
    {/* Above the blockers: a human saying no is a different kind of fact to a
        rule saying no, and it is the one a reader acts on first. */}
    <Verdicts reviews={reviews} />
    {merge.blockers.length === 0 ? null : (
      // One blocker to a row, its reason under its name rather than beside it:
      // these are two full sentences each, and side by side they wrapped into a
      // paragraph nobody could tell apart from the next one.
      <ul className="divide-y divide-line-muted">
        {merge.blockers.map((blocker) => (
          <li key={blocker.name} className="flex items-start gap-2 px-3 py-2">
            <XCircleFillIcon size={12} className="mt-1 shrink-0 text-fail" />
            <span className="flex min-w-0 flex-col gap-0.5">
              {/* A blocker with somewhere to go is a link to it. "A
                  conversation must be resolved" is only half an instruction
                  while finding the conversation is the reader's problem. */}
              {Option.isSome(blocker.about) ? (
                <button
                  type="button"
                  onClick={(pressed) => jumpTo(blocker.about, pressed.currentTarget)}
                  className="text-left text-xs font-semibold text-link underline"
                >
                  {blocker.name}
                </button>
              ) : (
                <span className="text-xs font-semibold">{blocker.name}</span>
              )}
              <span className="text-xs leading-snug text-ink-muted">{blocker.explanation}</span>
              {/* Only where both are true. A rule that may be bypassed is not
                  worth mentioning to someone without the permission, and the
                  permission is not worth mentioning against a rule nobody may
                  go past — either half alone is a promise this cannot keep. */}
              {blocker.bypassable && merge.mayBypass ? (
                <span className="text-xs leading-snug text-ink-muted">
                  Your permissions let you merge past this one, on GitHub.
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    )}
    {Option.isSome(merge.queue) ? (
      // Said once, plainly, because a queue changes what the button beneath it
      // means: pressing it hands the pull request to GitHub rather than landing
      // it, and a reader who does not know that reads a delay as a failure.
      <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-ink-muted">
        <GitMergeIcon size={12} className="mt-0.5 shrink-0" />
        <span>
          {merge.queue.value.waiting
            ? "GitHub is holding this in its queue and will land it when its turn comes and the checks ahead of it pass. Its place in "
            : "This repository lands pull requests through a queue, which tests each one against whatever is ahead of it and merges it in turn. What is already in "}
          <QueueLink queue={merge.queue.value} url={url} />
          {merge.queue.value.waiting ? " is GitHub's own page." : " is on GitHub's own page."}
        </span>
      </p>
    ) : null}
    {Option.isSome(merge.update) ? (
      <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-ink-muted">
        <AlertFillIcon size={12} className="mt-0.5 shrink-0 text-warn" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>The base branch has moved on since this one left it.</span>
          {/* GitHub's own words for why not. Without them the button is grey
              for a reason the reader has to go to GitHub to find out, which
              is the trip this extension exists to save. */}
          {Option.isSome(merge.update.value.refusal) ? (
            <span>{merge.update.value.refusal.value}</span>
          ) : null}
        </span>
      </p>
    ) : null}
    {merging.step === "refused" ? (
      <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-fail">
        <XCircleFillIcon size={12} className="mt-0.5 shrink-0" />
        {merging.said}
      </p>
    ) : null}
    {merging.step === "asking" ? (
      <p className="px-3 py-2 text-xs leading-snug text-ink-muted">{about(merging.doing)}</p>
    ) : null}
    {/* Wrapping rather than shrinking, and no label allowed to break inside
        itself: this column is four hundred pixels wide, and "Squash and merge"
        split over two lines beside "Close pull request" split over two lines
        was four lines of button and no way to tell which word belonged to
        which. */}
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      {/* One way in, never two. A queue makes the direct merge something GitHub
          refuses, so the button for it is absent rather than greyed out: the
          paragraph above has already said why, and this column has room for
          two controls, not three. */}
      {Option.isSome(merge.queue) ? (
        <QueueButton
          queue={merge.queue.value}
          autoMerge={merge.autoMerge}
          merging={merging}
          actions={actions}
          press={press}
        />
      ) : (
        <button
          type="button"
          disabled={
            !merge.isMergeable ||
            actions?.merge === undefined ||
            merging.step === "working" ||
            merging.step === "done"
          }
          onClick={() => press("merge")}
          className="whitespace-nowrap rounded-md bg-pass-emphasis px-3 py-1.5 text-xs font-semibold text-ink-on-emphasis disabled:opacity-50"
        >
          {merging.step === "asking"
            ? "Confirm squash and merge"
            : merging.step === "working"
              ? "Merging…"
              : merging.step === "done"
                ? "Merged"
                : "Squash and merge"}
        </button>
      )}
      {Option.isSome(merge.update) ? (
        <button
          type="button"
          disabled={
            actions?.update === undefined ||
            !merge.update.value.mayUpdate ||
            merging.step === "working" ||
            merging.step === "done"
          }
          onClick={() => press("update")}
          className="whitespace-nowrap rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
        >
          {merging.step === "asking" && merging.doing === "update"
            ? "Confirm update branch"
            : merging.step === "working" && merging.doing === "update"
              ? "Updating…"
              : merging.step === "done" && merging.doing === "update"
                ? "Updated"
                : "Update branch"}
        </button>
      ) : null}
      {merging.step === "asking" ? (
        <button
          type="button"
          onClick={onCancel}
          className="whitespace-nowrap rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted"
        >
          Cancel
        </button>
      ) : (
        <button
          type="button"
          disabled={actions?.close === undefined}
          onClick={actions?.close}
          // Pushed to the far edge: the destructive one should not sit a
          // thumb's width from the one that lands the change.
          className="ml-auto whitespace-nowrap rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-fail disabled:opacity-50"
        >
          Close pull request
        </button>
      )}
    </div>
  </Section>
)

/** Checks that have not reached a verdict yet. */
const stillRunning = (checks: ReadonlyArray<Check>): number =>
  checks.filter((check) => check.state === "running" || check.state === "queued").length

/**
 * The column that answers "what is this pull request, and can it land".
 */
export const About = ({
  snapshot,
  actions,
  onOpenCommit,
  onWarmCommit,
  openedCommit,
  notes,
  logs,
  tails,
  reach
}: {
  readonly snapshot: PullRequestSnapshot
  readonly actions?: MergeActions
  readonly onOpenCommit?: (sha: string) => void
  readonly onWarmCommit?: (sha: string) => void
  readonly openedCommit?: string
  readonly notes?: CheckNotes
  readonly logs?: CheckLogs
  readonly tails?: CheckTails
  readonly reach?: LogReach
}) => (
  <div className="flex w-[26rem] shrink-0 flex-col gap-1.5">
    <Description html={snapshot.description.html} />
    <Checks
      checks={snapshot.checks}
      library={notes}
      logs={logs}
      tails={tails}
      reach={reach}
    />
    <Conversation threads={snapshot.threads} />
    <Commits
      commits={snapshot.commits}
      repository={snapshot.reference}
      onOpen={onOpenCommit}
      onWarm={onWarmCommit}
      opened={openedCommit}
    />
    <Merge
      merge={snapshot.merge}
      base={snapshot.baseBranch}
      reviews={snapshot.reviews}
      commits={snapshot.commits.length}
      running={stillRunning(snapshot.checks)}
      url={toUrl(snapshot.reference)}
      actions={actions}
    />
  </div>
)
