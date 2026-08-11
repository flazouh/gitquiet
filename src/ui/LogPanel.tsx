import { Option } from "effect"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FileRef, LogColour, LogLine, LogPart } from "../domain/PullRequest"
import { foldedInto, pathIn, troubleIn } from "../domain/logs"
import { useArt } from "./art"
import { FIELD } from "./dress"

export type LogPanelProps = {
  readonly lines: ReadonlyArray<LogLine>
  /** A line to pick out and open at, when something pointed at one. */
  readonly mark?: number
  /** The pull request's files, so a log can say which of them it meant. */
  readonly paths?: ReadonlyArray<string>
  /** Opens one of those files, at the line the log named. */
  readonly onOpenFile?: (path: string, line: number) => void
  /** Where a file lives on GitHub, for the ones this pull request does not touch. */
  readonly hrefFor?: (ref: FileRef) => string
  /**
   * Reads past the tail. Offered only while the log being shown starts partway
   * through — a log that starts at line one has nothing left to ask for.
   */
  readonly onWhole?: () => void
}

/** Atom One Dark, so the log agrees with the diff beside it. */
const PALETTE: Record<LogColour, string> = {
  black: "#5c6370",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#d19a66",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#abb2bf",
  grey: "#5c6370"
}

const TONE: Record<LogLine["tone"], string> = {
  plain: "",
  error: "text-fail",
  warning: "text-busy",
  notice: "text-ink-accent",
  group: "",
  ended: ""
}

/**
 * A job's log, as something to read rather than something to scroll.
 *
 * Four things make the difference between this and a wall of text: the runner's
 * own chatter is folded away into the groups GitHub wrote it in, the errors can
 * be stepped through, the files it names open in the diff beside it, and what
 * a tool coloured red is red. Everything else — timestamps, escape sequences,
 * `##[...]` markers — has already been taken off by the reader that built these
 * lines.
 */
export const LogPanel = ({
  lines,
  mark,
  paths,
  onOpenFile,
  hrefFor,
  onWhole
}: LogPanelProps) => {
  const art = useArt()
  const ChevronDown = art["chevron-down"]
  const ChevronUp = art["chevron-up"]
  const Copy = art.copy
  const Err = art.error
  const parts = useMemo(() => foldedInto(lines), [lines])
  const trouble = useMemo(() => troubleIn(lines), [lines])
  const known = useMemo(() => paths ?? [], [paths])

  // Where a reader is looking: the line something pointed at, or the first
  // thing that went wrong, or — for a log with neither — the end.
  const [looking, setLooking] = useState(() => mark ?? trouble[0] ?? lines.at(-1)?.at)
  const [filter, setFilter] = useState("")
  // Which groups the reader has argued with. A group is open when the rule
  // below says so, unless it has been flipped — keeping the two apart means a
  // group of chatter can be opened and a group holding an error can be shut,
  // and neither has to fight the rule to stay that way.
  const [flipped, setFlipped] = useState<ReadonlySet<number>>(new Set())
  const scroller = useRef<HTMLDivElement | null>(null)
  const atLooking = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLooking(mark ?? trouble[0] ?? lines.at(-1)?.at)
  }, [lines, mark, trouble])

  useEffect(() => {
    if (filter !== "") return
    atLooking.current?.scrollIntoView({ block: "center" })
  }, [filter, looking, parts])

  const step = (by: number) => {
    if (trouble.length === 0) return
    const at = trouble.indexOf(looking ?? -1)
    const next = at === -1 ? 0 : (at + by + trouble.length) % trouble.length
    setLooking(trouble[next])
  }

  const matching = useMemo(() => {
    if (filter === "") return undefined
    const wanted = filter.toLowerCase()
    return lines.filter((line) => line.text.toLowerCase().includes(wanted))
  }, [filter, lines])

  const copy = useCallback(() => {
    const said = (matching ?? lines).map((line) => line.text).join("\n")
    void navigator.clipboard?.writeText(said)
  }, [lines, matching])

  const row = (line: LogLine) => (
    <Row
      key={line.at}
      line={line}
      marked={line.at === looking}
      held={line.at === looking ? atLooking : undefined}
      highlight={filter}
      known={known}
      onOpenFile={onOpenFile}
      hrefFor={hrefFor}
    />
  )

  return (
    <div className="mt-1 flex flex-col overflow-hidden rounded-md bg-canvas">
      {/* The strip that says how many lines and how many errors, on the lighter
          surface. Log output is dense monospace, and a fill is what holds a heading
          apart from it once the rule is gone. */}
      <div className="flex shrink-0 items-center gap-2 bg-surface px-2 py-1">
        {trouble.length === 0 ? (
          <span className="text-xs text-ink-muted">{`${lines.length} lines`}</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-fail">
              <Err size={12} />
              {`${trouble.length} ${trouble.length === 1 ? "error" : "errors"}`}
            </span>
            <button
              type="button"
              aria-label="Previous error"
              onClick={() => step(-1)}
              className="rounded p-0.5 text-ink-muted hover:bg-hover hover:text-ink"
            >
              <ChevronUp size={12} />
            </button>
            <button
              type="button"
              aria-label="Next error"
              onClick={() => step(1)}
              className="rounded p-0.5 text-ink-muted hover:bg-hover hover:text-ink"
            >
              <ChevronDown size={12} />
            </button>
          </>
        )}
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter"
          aria-label="Filter the log"
          className={`${FIELD} min-w-0 flex-1 px-2 py-0.5 text-xs`}
        />
        {onWhole === undefined || (lines[0]?.at ?? 1) === 1 ? null : (
          <button
            type="button"
            onClick={onWhole}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:bg-hover hover:text-ink"
          >
            Whole log
          </button>
        )}
        <button
          type="button"
          aria-label="Copy the log"
          onClick={copy}
          className="shrink-0 rounded p-1 text-ink-muted hover:bg-hover hover:text-ink"
        >
          <Copy size={12} />
        </button>
      </div>
      <div ref={scroller} className="max-h-80 overflow-auto py-1">
        {matching !== undefined ? (
          matching.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-muted">Nothing in the log says that.</p>
          ) : (
            matching.map(row)
          )
        ) : (
          parts.map((part) =>
            part.kind === "line" ? (
              row(part.line)
            ) : (
              <Group
                key={part.title.at}
                part={part}
                // A group holding an error is open, and so is the one holding
                // whatever is being looked at. The rest are the runner talking
                // about itself, which is why GitHub keeps them shut too.
                open={worthOpening(part, looking) !== flipped.has(part.title.at)}
                onToggle={() =>
                  setFlipped((held) => {
                    const next = new Set(held)
                    if (held.has(part.title.at)) next.delete(part.title.at)
                    else next.add(part.title.at)
                    return next
                  })
                }
                row={row}
              />
            )
          )
        )}
      </div>
    </div>
  )
}

const worthOpening = (part: Extract<LogPart, { kind: "group" }>, looking?: number): boolean =>
  part.worst === "error" ||
  part.worst === "warning" ||
  part.lines.some((line) => line.at === looking)

const Group = ({
  part,
  open,
  onToggle,
  row
}: {
  readonly part: Extract<LogPart, { kind: "group" }>
  readonly open: boolean
  readonly onToggle: () => void
  readonly row: (line: LogLine) => React.ReactNode
}) => {
  const art = useArt()
  const ChevronRight = art["chevron-right"]
  const Err = art.error

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-0.5 text-left font-mono text-[11px] text-ink-muted hover:bg-hover"
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate">{part.title.text}</span>
        {part.worst === "error" ? <Err size={10} className="shrink-0 text-fail" /> : null}
        <span className="shrink-0 tabular-nums text-ink-muted">{part.lines.length}</span>
      </button>
      {open ? part.lines.map(row) : null}
    </div>
  )
}

const Row = ({
  line,
  marked,
  held,
  highlight,
  known,
  onOpenFile,
  hrefFor
}: {
  readonly line: LogLine
  readonly marked: boolean
  readonly held?: React.RefObject<HTMLDivElement | null>
  readonly highlight: string
  readonly known: ReadonlyArray<string>
  readonly onOpenFile?: (path: string, line: number) => void
  readonly hrefFor?: (ref: FileRef) => string
}) => {
  const art = useArt()
  const File = art.file

  return (
  <div
    ref={held}
    className={`flex gap-3 px-2 font-mono text-[11px] leading-[1.45] ${
      marked ? "bg-fail-muted" : ""
    } ${TONE[line.tone]}`}
  >
    <span
      className="shrink-0 select-none text-right text-ink-muted tabular-nums"
      style={{ width: "4.5ch" }}
    >
      {line.at}
    </span>
    <span className="whitespace-pre-wrap break-all">
      {line.pieces.map((piece, at) => {
        const words = <Words text={piece.text} highlight={highlight} />
        const colour = Option.getOrUndefined(piece.colour)
        const ref = Option.getOrUndefined(piece.file)
        const here = ref === undefined ? undefined : pathIn(known, ref.path)

        if (ref !== undefined && here !== undefined && onOpenFile !== undefined) {
          return (
            <button
              key={at}
              type="button"
              title={`Open ${here} at line ${ref.line}`}
              onClick={() => onOpenFile(here, ref.line)}
              className="inline-flex items-baseline gap-1 text-ink-accent underline decoration-dotted underline-offset-2"
            >
              <File size={10} />
              {words}
            </button>
          )
        }
        if (ref !== undefined && hrefFor !== undefined) {
          return (
            <a
              key={at}
              href={hrefFor(ref)}
              target="_blank"
              rel="noreferrer"
              className="text-ink-accent underline decoration-dotted underline-offset-2"
            >
              {words}
            </a>
          )
        }

        return (
          <span key={at} style={colour === undefined ? undefined : { color: PALETTE[colour] }}>
            {words}
          </span>
        )
      })}
    </span>
  </div>
  )
}

/** The words, with whatever is being filtered for picked out of them. */
const Words = ({ text, highlight }: { readonly text: string; readonly highlight: string }) => {
  if (highlight === "") return <>{text}</>

  const parts: Array<React.ReactNode> = []
  const wanted = highlight.toLowerCase()
  const said = text.toLowerCase()
  let at = 0

  for (let found = said.indexOf(wanted); found !== -1; found = said.indexOf(wanted, at)) {
    parts.push(text.slice(at, found))
    parts.push(
      <mark key={found} className="rounded-sm bg-attention-muted text-ink">
        {text.slice(found, found + highlight.length)}
      </mark>
    )
    at = found + highlight.length
  }
  parts.push(text.slice(at))

  return <>{parts}</>
}
