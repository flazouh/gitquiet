import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { findingFile } from "../domain/findingFile"
import type { Writing, WritingKind } from "../ports/Ledger"
import { FIELD, SHEET } from "./dress"

/**
 * What this file writes down, in the order it writes it.
 *
 * The outline, and the cheapest proof the Ledger works: it is `writingsIn` and
 * nothing else. A reader opens it to find their way around a file somebody else
 * wrote, which is most files.
 *
 * The same box as Go to File, on purpose. One is the repository by path and the
 * other is this file by name; a reader who has learnt to type in one should not
 * have to learn the other, and the ranking is literally the same function —
 * `domain/findingFile.ts`, over names rather than over paths.
 */
export type FileNamesProps = {
  readonly writings: ReadonlyArray<Writing>
  readonly onOpen: (writing: Writing) => void
  readonly onClose: () => void
  readonly loading?: boolean
}

/** A word per kind, so a reader can tell a type from the thing it types. */
const WORD: Readonly<Record<WritingKind, string>> = {
  function: "fn",
  class: "class",
  type: "type",
  value: "const",
  parameter: "arg",
  import: "import",
  member: "member"
}

export const FileNames = ({ writings, onOpen, onClose, loading = false }: FileNamesProps) => {
  const frame = useRef<HTMLDialogElement | null>(null)
  const [query, setQuery] = useState("")
  const [at, setAt] = useState(0)

  const settled = useDeferredValue(query)
  const found = useMemo(() => {
    if (settled.trim() === "") return writings
    // Ranked by the same rules a path is, which read the same way over a name:
    // a run beats scattered characters, a word's start beats its middle.
    const ranked = findingFile(
      writings.map((one) => one.name),
      settled,
      writings.length
    )
    return ranked.flatMap((one) => writings.filter((writing) => writing.name === one.path))
  }, [writings, settled])

  useEffect(() => setAt(0), [settled])

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

  const move = (by: number) => {
    if (found.length === 0) return
    setAt((was) => (was + by + found.length) % found.length)
  }

  return (
    <dialog
      ref={frame}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) frame.current?.close()
      }}
      aria-label="Names in this file"
      className={`t-modal mt-[12vh] w-[36rem] max-w-[calc(100vw-var(--sheet-away,4rem))] overflow-hidden p-0 text-ink backdrop:bg-black/50 ${SHEET}`}
    >
      <div
        className="flex flex-col"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            move(1)
          }
          if (event.key === "ArrowUp") {
            event.preventDefault()
            move(-1)
          }
          if (event.key === "Enter") {
            event.preventDefault()
            const chosen = found[at]
            if (chosen === undefined) return
            onOpen(chosen)
            frame.current?.close()
          }
        }}
      >
        <div className="p-2">
          <input
            type="text"
            autoFocus
            aria-label="Names in this file"
            placeholder={loading ? "Reading this file…" : "Names in this file"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${FIELD} h-9 w-full px-3 text-sm`}
          />
        </div>
        {found.length === 0 ? (
          <p className="px-4 pb-3 text-xs text-ink-muted">
            {loading
              ? "Reading this file…"
              : writings.length === 0
                ? "Nothing here is a language this reads."
                : "No name like that in this file."}
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto pb-1">
            {found.map((one, row) => (
              <li key={`${one.line}:${one.from}:${one.name}`}>
                <button
                  type="button"
                  onPointerMove={() => setAt(row)}
                  onClick={() => {
                    onOpen(one)
                    frame.current?.close()
                  }}
                  aria-current={row === at}
                  className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs ${
                    row === at ? "bg-hover" : ""
                  }`}
                >
                  <span className="w-12 shrink-0 text-right font-mono text-[0.6875rem] text-ink-muted">
                    {WORD[one.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono">{one.name}</span>
                  <span className="shrink-0 font-mono text-[0.6875rem] text-ink-muted">
                    {one.line}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  )
}
