import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { findingFile, type Found } from "../domain/findingFile"
import { FIELD, SHEET } from "./dress"

/**
 * Any file in the repository, by typing part of its name.
 *
 * The cheapest thing in `docs/spec/following.md` and the one a reader spends
 * most: every path at the commit is already read for the tree, so this is a
 * ranking (`domain/findingFile.ts`), a box to type in, and a list. No Ledger, no
 * parser, nothing fetched when it opens.
 *
 * Modelled on `CheckDialog` down to the way out: a modal dialog, Escape answered
 * here rather than left to the browser, and a press on the backdrop closes it.
 */
export type GoToFileProps = {
  /** Every path in the repository, in the tree's own order. */
  readonly paths: ReadonlyArray<string>
  /** A path was chosen. The screen opens it and the address follows. */
  readonly onOpen: (path: string) => void
  readonly onClose: () => void
  /** Absent until the paths land, which is a read behind the page. */
  readonly loading?: boolean
}

/** How many rows are worth drawing. A reader who scrolls a fuzzy list types more instead. */
const SHOWN = 40

/**
 * The path with the characters the query landed on picked out.
 *
 * Built from the marks the ranking already returned rather than searched for
 * again here: a second pass is a second answer, and the two would disagree on
 * exactly the queries where a reader is looking hardest at why a row is in the
 * list.
 *
 * In runs rather than a span per character. A span per character is what this
 * did first, and it is three things at once: a hundred elements per row, a path
 * that copies out of the page with nothing in it to say where it broke, and a
 * name that no test and no reader's find can match because no element holds
 * more than one letter of it.
 */
const Marked = ({ found }: { readonly found: Found }) => {
  const marks = new Set(found.marks)
  const slash = found.path.lastIndexOf("/") + 1

  const runs: Array<{ text: string; hit: boolean; folder: boolean }> = []
  for (const [at, character] of [...found.path].entries()) {
    const hit = marks.has(at)
    const folder = at < slash
    const last = runs.at(-1)

    if (last !== undefined && last.hit === hit && last.folder === folder) last.text += character
    else runs.push({ text: character, hit, folder })
  }

  return (
    <span className="truncate">
      {runs.map((run, at) => (
        <span
          key={at}
          className={
            run.hit ? "font-semibold text-ink-accent" : run.folder ? "text-ink-muted" : "text-ink"
          }
        >
          {run.text}
        </span>
      ))}
    </span>
  )
}

export const GoToFile = ({ paths, onOpen, onClose, loading = false }: GoToFileProps) => {
  const frame = useRef<HTMLDialogElement | null>(null)
  const [query, setQuery] = useState("")
  const [at, setAt] = useState(0)

  // Deferred for the reason the diff's settings are: ranking thirty thousand
  // paths is the heavy part, and the letter the reader just typed should appear
  // in the box before the list catches up with it.
  const settled = useDeferredValue(query)
  const found = useMemo(() => findingFile(paths, settled, SHOWN), [paths, settled])

  // The chosen row belongs to the list rather than to the reader, so it goes
  // back to the top whenever the list is a different list. Without this, typing
  // a fifth letter leaves the mark on row nine of a list that now has two.
  useEffect(() => setAt(0), [settled])

  useEffect(() => {
    const box = frame.current
    if (box === null) return

    box.showModal()

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat && event.key !== "ArrowDown" && event.key !== "ArrowUp") return
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        box.close()
      }
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
      aria-label="Go to file"
      className={`t-modal mt-[12vh] w-[40rem] max-w-[calc(100vw-var(--sheet-away,4rem))] overflow-hidden p-0 text-ink backdrop:bg-black/50 ${SHEET}`}
    >
      {/*
        The arrows and Enter are bound here rather than on the document, because
        they are only these keys while this box is up and they are the reader's
        own text editing everywhere else. `onKeyDown` on the container catches
        them on the way up from the input, which has the focus the whole time.
      */}
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
            onOpen(chosen.path)
            frame.current?.close()
          }
        }}
      >
        <div className="p-2">
          <input
            // Not `type="search"`: its clear button answers Escape itself in
            // some browsers, which would empty the box where the reader meant
            // to leave.
            type="text"
            autoFocus
            aria-label="Go to file"
            placeholder={loading ? "Reading the repository…" : "Go to file"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${FIELD} h-9 w-full px-3 text-sm`}
          />
        </div>
        {found.length === 0 ? (
          <p className="px-4 pb-3 text-xs text-ink-muted">
            {loading
              ? "Reading the repository…"
              : paths.length === 0
                ? "No file list for this commit."
                : "No file of that name."}
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto pb-1">
            {found.map((one, row) => (
              <li key={one.path}>
                <button
                  type="button"
                  // The pointer marks the row it is on, so the keyboard and the
                  // pointer never disagree about which row Enter would open.
                  onPointerMove={() => setAt(row)}
                  onClick={() => {
                    onOpen(one.path)
                    frame.current?.close()
                  }}
                  aria-current={row === at}
                  className={`flex w-full items-center px-4 py-1.5 text-left font-mono text-xs ${
                    row === at ? "bg-hover" : ""
                  }`}
                >
                  <Marked found={one} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  )
}
