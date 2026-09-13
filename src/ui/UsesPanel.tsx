import { useEffect, useRef, useState } from "react"
import { Effect } from "effect"
import type { AcrossUse, Use, Writing } from "../ports/Ledger"
import { FLOAT } from "./dress"
import { useLedger } from "./ledger"

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
  const frame = useRef<HTMLDialogElement | null>(null)
  const [uses, setUses] = useState<ReadonlyArray<Use> | null>(null)
  const [elsewhere, setElsewhere] = useState<{
    readonly uses: ReadonlyArray<AcrossUse>
    readonly ready: boolean
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

  useEffect(() => {
    const box = frame.current
    if (box === null) return

    box.showModal()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      box.close()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])

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
      ledger.warm(across.repo, across.sha).pipe(
        Effect.flatMap(() =>
          ledger.usesAcross(across.repo, across.sha, {
            name: writing.name,
            path: where ?? reading.path,
            line: writing.line
          })
        ),
        Effect.map(setElsewhere),
        Effect.catch(() => Effect.sync(() => setElsewhere({ uses: [], ready: false })))
      )
    )
    return () => asking.interruptUnsafe()
  }, [ledger, across, reading.path, where, writing])

  return (
    <dialog
      ref={frame}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) frame.current?.close()
      }}
      aria-label={`Uses of ${writing.name}`}
      className={`t-modal mt-[12vh] w-[44rem] max-w-[calc(100vw-var(--sheet-away,4rem))] overflow-hidden p-0 text-ink backdrop:bg-black/50 ${FLOAT}`}
    >
      <div className="flex items-baseline gap-2 bg-surface px-4 py-2.5">
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
          <span className="ml-auto text-xs text-ink-muted">
            {elsewhere === null
              ? "reading the repository…"
              : !elsewhere.ready
                ? "the repository could not be read"
                : `${beyond.length} elsewhere`}
          </span>
        )}
      </div>
      {/*
        Where it is written, first and pressable.
        
        The press that opened this panel deliberately did not move the reader —
        but going there is the thing they may have wanted, and a panel that
        listed every use of a name without offering the name itself would make
        them close it and hold the key again.
      */}
      <button
        type="button"
        onClick={() => {
          if (here) onGo(writing.line)
          else if (where !== undefined) onOpen?.(where, writing.line)
          frame.current?.close()
        }}
        className="flex w-full items-baseline gap-3 border-b border-line px-4 py-1.5 text-left font-mono text-xs hover:bg-hover"
      >
        <span className="w-10 shrink-0 text-right text-[0.6875rem] text-ink-muted">written</span>
        <span className="min-w-0 flex-1 truncate">{writing.signature}</span>
        <span className="shrink-0 text-[0.6875rem] text-ink-muted">
          {here ? writing.line : `${where}:${writing.line}`}
        </span>
      </button>
      {uses === null || uses.length === 0 ? null : (
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {uses.map((use) => (
            <li key={`${use.line}:${use.from}`}>
              <button
                type="button"
                onClick={() => {
                  onGo(use.line)
                  frame.current?.close()
                }}
                className="flex w-full items-baseline gap-3 px-4 py-1 text-left font-mono text-xs hover:bg-hover"
              >
                <span className="w-10 shrink-0 text-right text-[0.6875rem] text-ink-muted">
                  {use.line}
                </span>
                {/* The line itself, so a reader can tell a call from a
                    declaration without going to look. */}
                <span className="min-w-0 flex-1 truncate">
                  {(lines[use.line - 1] ?? "").trim()}
                </span>
                {use.line === writing.line ? (
                  <span className="shrink-0 text-[0.6875rem] text-ink-muted">written</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {beyond.length === 0 ? null : (
        <>
          <p className="border-t border-line px-4 pb-1 pt-2 text-[0.6875rem] text-ink-muted">
            {here ? "Elsewhere in the repository" : "In the repository"}
          </p>
          <ul className="max-h-[30vh] overflow-y-auto pb-1">
            {beyond.map((use) => (
              <li key={`${use.path}:${use.line}:${use.from}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (use.path === reading.path) onGo(use.line)
                    else onOpen?.(use.path, use.line)
                    frame.current?.close()
                  }}
                  className="flex w-full items-baseline gap-3 px-4 py-1 text-left font-mono text-xs hover:bg-hover"
                >
                  <span className="min-w-0 flex-1 truncate">{use.path}</span>
                  <span className="shrink-0 text-[0.6875rem] text-ink-muted">{use.line}</span>
                  {/* Sure and Likely, where a reader can see them. A file that
                      states it borrowed this name is one thing; a file that
                      merely holds the word is another, and a reader deciding
                      whether a rename is safe needs to know which. */}
                  <span
                    className={`w-10 shrink-0 text-right text-[0.6875rem] ${
                      use.sure ? "text-ink-muted" : "text-busy"
                    }`}
                  >
                    {use.sure ? "Sure" : "Likely"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </dialog>
  )
}
