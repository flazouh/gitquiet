import type { DiffLine, FileDiff } from "./PullRequest"

/** What happened to a stretch of a document: it was added, removed, or left alone. */
export type ProseKind = "added" | "deleted" | "context"

/**
 * A stretch of one kind, as the markdown that was written there.
 *
 * A run rather than a line, because markdown is a block language: a list, a
 * fenced block or a heading and its paragraph mean nothing one line at a time.
 * Neighbouring lines of the same kind are the largest piece that can be handed
 * to a renderer while still being honest about which change it belongs to.
 */
export type ProseRun = {
  readonly kind: ProseKind
  readonly text: string
}

const kindOf = (line: DiffLine): ProseKind | undefined => {
  switch (line.kind) {
    case "added":
    case "deleted":
    case "context":
      return line.kind
    // Hunk headers are the diff talking about itself, not part of the document.
    default:
      return undefined
  }
}

/** The line without its marker column, which is one character wide, always. */
const proseOf = (line: DiffLine): string => line.text.slice(1)

export const proseRuns = (diff: FileDiff): ReadonlyArray<ProseRun> => {
  if (diff.isBinary) return []

  const runs: Array<{ kind: ProseKind; lines: Array<string> }> = []

  for (const line of diff.lines) {
    const kind = kindOf(line)
    if (kind === undefined) continue

    const open = runs.at(-1)
    if (open !== undefined && open.kind === kind) open.lines.push(proseOf(line))
    else runs.push({ kind, lines: [proseOf(line)] })
  }

  return runs.map((run) => ({ kind: run.kind, text: run.lines.join("\n") }))
}
