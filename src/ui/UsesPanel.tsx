import { useEffect, useState } from "react"
import { Effect } from "effect"
import type { AcrossUse, Use, Writing } from "../ports/Ledger"
import { FLOAT } from "./dress"
import { useLedger } from "./ledger"
import { useSettings } from "./useSettings"

/**
 * Everywhere in this file that means the same Writing.
 *
 * Counted by name and not by word: `shape` inside a function that declares its
 * own `shape` is a different thing with the same spelling, and a list that held
 * it would be a list of a word rather than of a name. `src/ledger/writings.ts`
 * resolves every one of them; this draws what comes back.
 *
 * This file first, because it is the question asked most and the only one that
 * can be answered exactly: the reader's own file is parsed, and every mention in
 * it is resolved by scope.
 *
 * Then the repository, where a Ledger has read one. That half cannot be exact
 * without parsing every file at the moment of asking, so it is not pretended to
 * be: a file that states it borrowed this name from this file is **Sure**, a
 * file that merely holds the same word is **Likely** and says so, and a file
 * that binds its own name of that spelling is left out — two things with one
 * spelling are two things.
 */
export type UsesPanelProps = {
  readonly writing: Writing
  readonly reading: { readonly path: string; readonly text: string }
  /**
   * The file the Writing is in, where it is not the one being read.
   *
   * A name this file borrowed is written somewhere else, and this file's own
   * mentions of it are then Uses like any other file's — so the exact in-file
   * list is skipped and the repository answers for all of them, this one
   * included. Resolving a Writing from another file against this file's text
   * would match nothing at all, which would read as "used nowhere".
   */
  readonly where?: string
  /** Puts one on the screen. The pane scrolls; the address does not change. */
  readonly onGo: (line: number) => void
  readonly onClose: () => void
  /**
   * Opens another file at a line, where the screen can.
   *
   * Separate from {@link UsesPanelProps.across} on purpose: going to a file is
   * not the same capability as asking a Ledger about a repository, and a screen
   * that can do the first and not the second was a screen where the row saying
   * where a name is written did nothing at all.
   */
  readonly onOpen?: (path: string, line: number) => void
  /**
   * Which repository to ask about the rest of the Uses, at which commit.
   *
   * Absent where the screen does not know, and then this is the file's Uses and
   * says so — rather than an empty list of the repository's, which a reader
   * deciding whether a name is safe to change would read as an answer.
   */
  readonly across?: {
    readonly repo: { readonly owner: string; readonly repo: string }
    readonly sha: string
  }
}

/** How many lines of context the preview shows either side of a row. */
const AROUND = 8

/**
 * One line of the answer: where the name is written, a use of it in this file,
 * or a use somewhere else in the repository.
 */
type Row = {
  readonly kind: "written" | "use" | "beyond"
  readonly line: number
  /** What the row reads as: the signature, the line of code, or the path. */
  readonly said: string
  /** The file it is in, where that is not the file being read. */
  readonly path?: string
  /** Whether the repository stated this use or merely holds the word. */
  readonly sure?: boolean
}

export const UsesPanel = ({
  writing,
  reading,
  onGo,
  onOpen,
  onClose,
  across,
  where
}: UsesPanelProps) => {
  /** Whether the Writing is in the file being read, which decides what can be exact. */
  const here = where === undefined || where === reading.path
  const ledger = useLedger()
  // Whether the reader asked for a compiler to answer. Off, and this is the
  // tier that reads shapes — fast, every language, honest about its guesses.
  const { settings } = useSettings()
  const exact = settings.diff.exact === "on"
  /** Which row the preview is showing, as an index into the rows below. */
  const [picked, setPicked] = useState(0)
  const [uses, setUses] = useState<ReadonlyArray<Use> | null>(null)
  const [elsewhere, setElsewhere] = useState<{
    readonly uses: ReadonlyArray<AcrossUse>
    readonly ready: boolean
    readonly exact?: boolean
  } | null>(null)
  const lines = reading.text.split("\n")
  /**
   * The repository's Uses, minus the ones in the file already listed above.
   *
   * The Ledger answers about every file including this one, and this one is
   * answered exactly a few lines up. Listing both would be the same lines twice,
   * once precisely and once by a rule that cannot see scopes.
   */
  const beyond = (elsewhere?.uses ?? []).filter((use) => !here || use.path !== reading.path)

  /** The uses worth a row, which is every one that is not the writing itself. */
  const elsewhereInFile =
    uses === null ? null : uses.filter((use) => use.line !== writing.line || use.from !== writing.from)

  /*
   * Escape puts it away, which is what Escape means everywhere else here.
   *
   * On the document and in the capture phase: this row lives inside the
   * renderer's shadow root, and a key pressed over it is reported against
   * whatever the event was retargeted to.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [onClose])

  useEffect(() => {
    if (!here) {
      setUses([])
      return
    }

    const asking = Effect.runFork(
      ledger.usesIn(reading, writing).pipe(
        Effect.map(setUses),
        Effect.catch(() => Effect.sync(() => setUses([])))
      )
    )
    return () => asking.interruptUnsafe()
  }, [here, ledger, reading, writing])

  /*
   * The rest of the repository, where there is a Ledger that has read it.
   *
   * Warmed first: a reader who presses this without having opened Go to Name is
   * asking the repository a question for the first time, and being told "no
   * Ledger" would be being told about a mechanism rather than answered.
   */
  useEffect(() => {
    if (across === undefined) return

    const asking = Effect.runFork(
      ledger.warm(across.repo, across.sha, exact).pipe(
        Effect.flatMap(() =>
          ledger.usesAcross(across.repo, across.sha, {
            name: writing.name,
            path: where ?? reading.path,
            line: writing.line,
            column: writing.from - 1
          })
        ),
        Effect.map(setElsewhere),
        Effect.catch(() => Effect.sync(() => setElsewhere({ uses: [], ready: false })))
      )
    )
    return () => asking.interruptUnsafe()
  }, [ledger, across, exact, reading.path, where, writing])

  /**
   * The rows, in the order an editor lists them: where it is written, then
   * every use in this file, then the rest of the repository.
   *
   * One list rather than three, because the preview beside it shows one row at
   * a time and "which row is showing" has to mean something across all of them.
   */
  const rows: ReadonlyArray<Row> = [
    { kind: "written", line: writing.line, said: writing.signature, path: where },
    ...(elsewhereInFile ?? []).map((use) => ({
      kind: "use" as const,
      line: use.line,
      said: (lines[use.line - 1] ?? "").trim()
    })),
    ...beyond.map((use) => ({
      kind: "beyond" as const,
      line: use.line,
      said: use.path,
      path: use.path,
      sure: use.sure
    }))
  ]

  const showing = rows[Math.min(picked, rows.length - 1)] ?? rows[0]

  /**
   * The lines behind whichever row is showing.
   *
   * Only for this file: a use in another file is a file this pane has not read,
   * and inventing a preview of it would be inventing code. Those rows say where
   * they are and open when pressed, which is what the tree in an editor does
   * with a file it has not loaded either.
   */
  const preview =
    showing === undefined || showing.path !== undefined
      ? null
      : lines.slice(Math.max(0, showing.line - 1 - AROUND), showing.line - 1 + AROUND + 1)
  const previewFrom = showing === undefined ? 1 : Math.max(1, showing.line - AROUND)

  const goTo = (row: Row): void => {
    if (row.path !== undefined && row.path !== reading.path) onOpen?.(row.path, row.line)
    else onGo(row.line)
    onClose()
  }

  return (
    <div
      aria-label={`Uses of ${writing.name}`}
      className={`overflow-hidden border-y border-line bg-raised text-ink ${FLOAT}`}
    >
      {/* The head: what was asked about, and how many answers there are. */}
      <div className="flex items-baseline gap-2 border-b border-line bg-surface px-3 py-2">
        <h2 className="text-sm font-semibold">
          <code className="font-mono">{writing.name}</code>
        </h2>
        <span className="text-xs text-ink-muted">
          {!here
            ? `written in ${where}`
            : uses === null
              ? "reading…"
              : uses.length === 1
                ? "written here, used nowhere else in this file"
                : `${uses.length} in this file`}
        </span>
        {across === undefined ? null : (
          <span className="text-xs text-ink-muted">
            {elsewhere === null
              ? "reading the repository…"
              : !elsewhere.ready
                ? "the repository could not be read"
                : `${beyond.length} elsewhere${elsewhere.exact === true ? ", exactly" : ""}`}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto shrink-0 rounded px-1.5 text-xs text-ink-muted hover:bg-hover"
        >
          Esc
        </button>
      </div>

      {/*
        The body, split the way an editor splits it: the code on the left, the
        list on the right. Seven parts to three, which is theirs — the code is
        the answer and the list is the way through it.
      */}
      <div className="flex h-[22rem]">
        <div className="min-w-[14rem] flex-[7] overflow-auto border-r border-line bg-raised">
          {preview === null ? (
            <p className="px-3 py-2 font-mono text-xs text-ink-muted">
              {showing?.path === undefined
                ? "nothing to show"
                : `${showing.path} — press to open it`}
            </p>
          ) : (
            <table className="w-full border-collapse font-mono text-xs leading-relaxed">
              <tbody>
                {preview.map((said, index) => {
                  const line = previewFrom + index
                  return (
                    <tr key={line} className={line === showing?.line ? "bg-hover" : undefined}>
                      {/*
                        Told not to break. A three-figure line number in a
                        column this narrow wrapped to one digit a row, so the
                        preview of lines 120 to 136 was numbered 1, 2, 0, 1, 2,
                        1 down the side of it.
                      */}
                      <td className="w-12 select-none whitespace-nowrap pr-3 text-right align-top text-[0.6875rem] text-ink-muted">
                        {line}
                      </td>
                      <td className="whitespace-pre pr-3 align-top">{said}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <ul className="min-w-[9rem] flex-[3] overflow-y-auto py-1">
          {rows.map((row, index) => (
            <li key={`${row.kind}:${row.path ?? ""}:${row.line}`}>
              {/*
                Grouped, the way an editor's reference tree groups: this file
                first, then the rest of the repository under a heading of its
                own. A flat list of twenty rows where three of them are in the
                file being read and seventeen are not is a list that answers a
                different question than the one asked.
              */}
              {row.kind !== "beyond" || rows[index - 1]?.kind === "beyond" ? null : (
                <p className="border-t border-line px-3 pb-1 pt-2 text-[0.6875rem] text-ink-muted">
                  {here ? "Elsewhere in the repository" : "In the repository"}
                </p>
              )}
              <button
                type="button"
                // Showing on hover as well as on focus: a reader running the
                // pointer down the list is reading the code beside it, which is
                // the whole reason the code is there.
                onMouseEnter={() => setPicked(index)}
                onFocus={() => setPicked(index)}
                onClick={() => goTo(row)}
                className={`flex w-full items-baseline gap-2 px-3 py-1 text-left font-mono text-xs hover:bg-hover ${
                  index === picked ? "bg-hover" : ""
                }`}
              >
                <span className="w-12 shrink-0 whitespace-nowrap text-right text-[0.6875rem] text-ink-muted">
                  {row.kind === "written" ? "written" : row.line}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.said}</span>
                {row.kind !== "beyond" ? null : (
                  /* Sure and Likely, where a reader can see them. A file that
                     states it borrowed this name is one thing; a file that
                     merely holds the word is another, and a reader deciding
                     whether a rename is safe needs to know which. */
                  <span
                    className={`shrink-0 text-[0.6875rem] ${
                      row.sure === true ? "text-ink-muted" : "text-busy"
                    }`}
                  >
                    {row.sure === true ? "Sure" : "Likely"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
