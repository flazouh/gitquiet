import { useEffect, useRef, useState } from "react"
import { Effect } from "effect"
import type { Use, Writing } from "../ports/Ledger"
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
 * This file, and not the repository. Uses across a repository is a question for
 * a Ledger and a different panel — see `docs/spec/following.md`. What is here is
 * the question a reader asks most: where else does this line's name appear in
 * what I am reading.
 */
export type UsesPanelProps = {
  readonly writing: Writing
  readonly reading: { readonly path: string; readonly text: string }
  /** Puts one on the screen. The pane scrolls; the address does not change. */
  readonly onGo: (line: number) => void
  readonly onClose: () => void
}

export const UsesPanel = ({ writing, reading, onGo, onClose }: UsesPanelProps) => {
  const ledger = useLedger()
  const frame = useRef<HTMLDialogElement | null>(null)
  const [uses, setUses] = useState<ReadonlyArray<Use> | null>(null)
  const lines = reading.text.split("\n")

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
    const asking = Effect.runFork(
      ledger.usesIn(reading, writing).pipe(
        Effect.map(setUses),
        Effect.catch(() => Effect.sync(() => setUses([])))
      )
    )
    return () => asking.interruptUnsafe()
  }, [ledger, reading, writing])

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
          {uses === null
            ? "reading…"
            : uses.length === 1
              ? "written here, used nowhere else"
              : `${uses.length} in this file`}
        </span>
      </div>
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
    </dialog>
  )
}
