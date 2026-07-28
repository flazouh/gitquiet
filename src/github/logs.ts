import { Option } from "effect"
import type { FileRef, LogColour, LogLine, LogPart, LogPiece, LogTone } from "../domain/PullRequest"

/** The nanosecond timestamp every stored line begins with. */
const WHEN = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/

/** GitHub's own markers, in the order they must be tried. */
const MARKERS: ReadonlyArray<readonly [RegExp, LogTone]> = [
  [/^##\[error\] ?/, "error"],
  [/^##\[warning\] ?/, "warning"],
  [/^##\[notice\] ?/, "notice"],
  [/^##\[group\] ?/, "group"],
  [/^##\[endgroup\] ?/, "ended"],
  [/^##\[[a-z]+\] ?/, "plain"]
]

/** A stretch of a line that something is known about. */
type Run<Value> = { readonly from: number; readonly to: number; readonly value: Value }

const SGR = /\u001b\[([0-9;]*)m/g

const COLOURS: Record<number, LogColour> = {
  30: "black",
  31: "red",
  32: "green",
  33: "yellow",
  34: "blue",
  35: "magenta",
  36: "cyan",
  37: "white",
  90: "grey",
  91: "red",
  92: "green",
  93: "yellow",
  94: "blue",
  95: "magenta",
  96: "cyan",
  97: "white"
}

/**
 * The colour a line was written in, and the line without the codes that said so.
 *
 * Test runners and linters colour their output with escape sequences, which are
 * invisible in a terminal and gibberish everywhere else. Taking them out is not
 * enough on its own: the sequences also sit in front of GitHub's own `##[...]`
 * markers, so a log read without this step has errors it cannot recognise.
 */
const colourIn = (raw: string): { readonly plain: string; readonly runs: ReadonlyArray<Run<LogColour>> } => {
  if (!raw.includes("\u001b")) return { plain: raw, runs: [] }

  const runs: Array<Run<LogColour>> = []
  let plain = ""
  let at = 0
  let wearing: LogColour | undefined
  let since = 0

  const close = (to: number) => {
    if (wearing !== undefined && to > since) runs.push({ from: since, to, value: wearing })
  }

  SGR.lastIndex = 0
  for (let found = SGR.exec(raw); found !== null; found = SGR.exec(raw)) {
    plain += raw.slice(at, found.index)
    at = found.index + found[0].length

    close(plain.length)
    // The last colour in a sequence wins, and a reset or a bare code ends it.
    const codes = (found[1] ?? "").split(";").map(Number)
    wearing = codes.reduce<LogColour | undefined>(
      (held, code) => (code === 0 ? undefined : (COLOURS[code] ?? held)),
      wearing
    )
    if (codes.includes(0) || (found[1] ?? "") === "") wearing = undefined
    since = plain.length
  }

  plain += raw.slice(at)
  close(plain.length)

  return { plain, runs }
}

/** Where a job checks a repository out, which no reader wants to see. */
const RUNNER = /^\/?home\/runner\/work\/[^/]+\/[^/]+\//

/**
 * The runner's own corners, which look like a checkout and are not one.
 *
 * `_actions` holds the actions a workflow used and `_temp` its scratch space,
 * both directly beside the checkout and both a dead end: taking the same two
 * segments off them leaves something that reads exactly like a repository path
 * and belongs to nobody.
 */
const MACHINE = /^\/?home\/runner\/work\/_/

const REFERENCE =
  /(^|[\s'"([])(\/?(?:[\w.-]+\/)*[\w.-]+\.[a-zA-Z][\w]{0,4})(?::(\d+)(?::(\d+))?|\((\d+),(\d+)\))/g

/**
 * The files a line mentions, with the line and column it mentions them at.
 *
 * Every tool that reports a problem reports it as a path and a line — the
 * TypeScript compiler as `src/x.ts(50,10)`, everything else as `src/x.ts:50:10`
 * — and a reader looking at one wants the file, not the string. Only mentions
 * that carry a line number count: a bare `package.json` in a sentence is a
 * word, not a place, and turning it into a link teaches the eye to distrust
 * every other link in the panel.
 */
const filesIn = (plain: string): ReadonlyArray<Run<FileRef>> => {
  const found: Array<Run<FileRef>> = []

  REFERENCE.lastIndex = 0
  for (let hit = REFERENCE.exec(plain); hit !== null; hit = REFERENCE.exec(plain)) {
    const before = (hit[1] ?? "").length
    const from = hit.index + before
    const said = hit[2] ?? ""
    const path = said.replace(RUNNER, "").replace(/^\.\//, "")
    const line = Number(hit[3] ?? hit[5])
    const column = hit[4] ?? hit[6]

    // Still absolute after the checkout prefix came off, or somewhere inside a
    // dependency: a place on the runner's disk rather than a file in anyone's
    // repository. Linking to it would offer a page that cannot exist.
    if (MACHINE.test(said) || path.startsWith("/") || path.includes("node_modules/")) continue

    found.push({
      from,
      to: hit.index + hit[0].length,
      value: {
        path,
        line,
        column: column === undefined ? Option.none() : Option.some(Number(column))
      }
    })
  }

  return found
}

/** The line cut at every boundary either the colour or a file reference sets. */
const piecesOf = (
  plain: string,
  colours: ReadonlyArray<Run<LogColour>>,
  files: ReadonlyArray<Run<FileRef>>
): ReadonlyArray<LogPiece> => {
  const edges = new Set([0, plain.length])
  for (const run of [...colours, ...files]) {
    if (run.from > 0 && run.from < plain.length) edges.add(run.from)
    if (run.to > 0 && run.to < plain.length) edges.add(run.to)
  }

  const marks = [...edges].sort((one, two) => one - two)
  const pieces: Array<LogPiece> = []

  for (let at = 0; at < marks.length - 1; at += 1) {
    const from = marks[at]!
    const to = marks[at + 1]!
    const colour = colours.find((run) => run.from <= from && run.to >= to)?.value
    const file = files.find((run) => run.from <= from && run.to >= to)?.value

    pieces.push({
      text: plain.slice(from, to),
      colour: colour === undefined ? Option.none() : Option.some(colour),
      file: file === undefined ? Option.none() : Option.some(file)
    })
  }

  return pieces
}

/**
 * A step's log, read the way it should be shown.
 *
 * Three things come off every line: the timestamp it was stored with, which is
 * the same to the millisecond for pages at a time and pushes the words off the
 * right of any panel; the escape sequences a tool coloured it with; and the
 * `##[...]` marker, which is GitHub saying in machine words what a colour says
 * better. What the last two meant is kept, as a tone and as coloured pieces.
 *
 * Line numbers are GitHub's, counted from one, because an annotation points at
 * one of them and the panel has to be able to find it. That means blank lines
 * count too, and nothing may be dropped — a filtered log cannot be pointed at.
 * A tail read starts partway through the job, and says where with `startAt`.
 */
export const linesIn = (log: string, startAt = 1): ReadonlyArray<LogLine> => {
  if (log === "") return []

  // A trailing newline is the end of the last line, not an empty one after it.
  const rows = log.replace(/\n$/, "").split("\n")

  return rows.map((row, index) => {
    const { plain, runs } = colourIn(row)
    const withoutWhen = plain.replace(WHEN, "")
    const shift = plain.length - withoutWhen.length
    const marker = MARKERS.find(([pattern]) => pattern.test(withoutWhen))
    const text = marker === undefined ? withoutWhen : withoutWhen.replace(marker[0], "")
    const off = shift + withoutWhen.length - text.length

    const colours = runs.flatMap((run) =>
      run.to <= off ? [] : [{ from: Math.max(0, run.from - off), to: run.to - off, value: run.value }]
    )

    return {
      at: startAt + index,
      text,
      tone: marker?.[1] ?? "plain",
      pieces: piecesOf(text, colours, filesIn(text))
    }
  })
}

/**
 * The stretch of log worth showing around the line a note points at.
 *
 * A step's log runs to a few thousand lines and the interesting part is the
 * error and what led to it, so this keeps a window around the line rather than
 * making a reader scroll a wall to find the one row that is highlighted. The
 * window is clamped to what exists, and asking about a line that is not there
 * gives the end of the log — where a failure usually is anyway.
 */
export const around = (
  lines: ReadonlyArray<LogLine>,
  line: number,
  reach = 40
): ReadonlyArray<LogLine> => {
  if (lines.length <= reach * 2 + 1) return lines

  const found = lines.findIndex((one) => one.at === line)
  const middle = found === -1 ? lines.length - reach - 1 : found
  const from = Math.max(0, Math.min(middle - reach, lines.length - (reach * 2 + 1)))

  return lines.slice(from, from + reach * 2 + 1)
}

const WORST: Record<LogTone, number> = {
  error: 3,
  warning: 2,
  notice: 1,
  plain: 0,
  group: 0,
  ended: 0
}

/**
 * The log as blocks, with everything between a group and its end inside one.
 *
 * Most of a job's log is the runner explaining itself — the image it booted,
 * the permissions it was given, the caches it restored — and all of it arrives
 * inside groups that GitHub's own viewer keeps shut. Folded, a two hundred line
 * log is a dozen rows and the part that matters is one of them. Each block
 * carries the worst tone inside it, so a group holding an error can say so
 * while still shut, and be opened without being hunted for.
 *
 * Groups do not nest in Actions, and a group left unclosed at the end of a log
 * — which happens whenever a step is killed mid-way — keeps the lines it had.
 */
export const foldedInto = (lines: ReadonlyArray<LogLine>): ReadonlyArray<LogPart> => {
  const parts: Array<LogPart> = []
  let open: { title: LogLine; lines: Array<LogLine> } | undefined

  const shut = () => {
    if (open === undefined) return
    parts.push({
      kind: "group",
      title: open.title,
      lines: open.lines,
      worst: open.lines.reduce<LogTone>(
        (held, line) => (WORST[line.tone] > WORST[held] ? line.tone : held),
        "plain"
      )
    })
    open = undefined
  }

  for (const line of lines) {
    if (line.tone === "group") {
      shut()
      open = { title: line, lines: [] }
      continue
    }
    if (line.tone === "ended") {
      shut()
      continue
    }
    if (open === undefined) parts.push({ kind: "line", line })
    else open.lines.push(line)
  }
  shut()

  return parts
}

/**
 * Which of the pull request's files a log meant, if any of them.
 *
 * A tool reports a path from wherever it happened to be run — `src/x.ts` from
 * the root, `packages/api/src/x.ts` from a workspace above it — so an exact
 * match is tried first and then the longest path that ends the same way. Two
 * files that both end that way means the log did not say which, and guessing
 * between them is worse than leaving the words as words.
 */
export const pathIn = (paths: Iterable<string>, named: string): string | undefined => {
  const all = [...paths]
  if (all.includes(named)) return named

  const ends = all.filter((path) => path.endsWith(`/${named}`))
  return ends.length === 1 ? ends[0] : undefined
}

/** Every line a reader would want to jump between, in the order they happened. */
export const troubleIn = (lines: ReadonlyArray<LogLine>): ReadonlyArray<number> =>
  lines.flatMap((line) => (line.tone === "error" ? [line.at] : []))

/**
 * The end of a log, read without holding the whole of it.
 *
 * A whole job's log is usually tens of kilobytes and occasionally hundreds of
 * megabytes, and the end is the part worth reading — where a failure lands and
 * where a job says what it did. So the body is read in pieces and only the
 * last few hundred lines are kept, with the count going up as the rest goes
 * past: what comes back knows its own line numbers, which is what lets the
 * panel agree with the log on GitHub.
 */
export const tailOf = async (
  body: ReadableStream<Uint8Array>,
  keep: number
): Promise<{ readonly text: string; readonly startAt: number }> => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let held: Array<string> = []
  let dropped = 0
  let rest = ""

  const push = (rows: ReadonlyArray<string>) => {
    held.push(...rows)
    if (held.length <= keep) return
    dropped += held.length - keep
    held = held.slice(-keep)
  }

  const take = (chunk: string) => {
    const rows = (rest + chunk).split("\n")
    // The last piece may be half a line, so it waits for the next chunk.
    rest = rows.pop() ?? ""
    push(rows)
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    take(decoder.decode(value, { stream: true }))
  }
  take(decoder.decode())
  // Whatever is left is the final line, which ended without a newline.
  if (rest !== "") push([rest])

  return { text: held.join("\n"), startAt: dropped + 1 }
}
