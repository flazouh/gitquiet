import { LinkExternalIcon } from "@primer/octicons-react"
import { Option } from "effect"
import { useEffect, useRef, useState } from "react"
import type { Kept } from "../app/kept"
import type { Check, CheckNote, FileRef, LogLine, LogSpot } from "../domain/PullRequest"
import { around } from "../github/logs"
import { CHECK_TONE, checkArt } from "./Icon"
import { LogPanel } from "./LogPanel"
import { type Reading, useReading } from "./reading"

/** Everything read from a check page, held so a second look is free. */
export type CheckNotes = Kept<string, ReadonlyArray<CheckNote>>

/** A step's log, held under `check name:step`. */
export type CheckLogs = Kept<string, ReadonlyArray<LogLine>>

/** The end of a check's whole log, held under the check's name. */
export type CheckTails = Kept<string, ReadonlyArray<LogLine>>

/** The key a whole log is held under, as against the tail of the same one. */
export const wholeKey = (check: Check): string => `${check.name}:whole`

/** The key a step's log is held under, so both sides agree on one spelling. */
export const logKey = (check: Check, step: number): string => `${check.name}:${step}`

/** What a log can reach out to: the files this pull request touches. */
export type LogReach = {
  readonly paths?: ReadonlyArray<string>
  readonly onOpenFile?: (path: string, line: number) => void
  readonly hrefFor?: (ref: FileRef) => string
}

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
 * One check, in front of everything else, because a red build is read before it
 * is acted on.
 *
 * Their own account of the failure and a way to the log: GitHub redirects the
 * log itself to storage on another origin, which a page cannot read, so the
 * link goes to the run — which is where anyone reading a stack trace ends up
 * anyway.
 */
export const CheckDialog = ({
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
