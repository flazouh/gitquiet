import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { Effect } from "effect"
import type { Place, WritingKind } from "../ports/Ledger"
import { FIELD, SHEET } from "./dress"
import { useLedger } from "./ledger"

/**
 * Any name the repository writes down, by typing it.
 *
 * The largest question in `docs/spec/following.md` and the one that needs a
 * Ledger: a name in a file nobody has opened is not in anything the page holds.
 * So the repository is read once, at this commit, and every name it writes is
 * what this types over.
 *
 * The reading is asked for when this opens and not before. Most reading never
 * needs it, and a screen that fetched a repository on arrival would be a screen
 * that cost every reader for what few of them use.
 */
export type GoToNameProps = {
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly sha: string
  readonly onOpen: (place: Place) => void
  readonly onClose: () => void
}

const WORD: Readonly<Record<WritingKind, string>> = {
  function: "fn",
  class: "class",
  type: "type",
  value: "const",
  parameter: "arg",
  import: "import",
  member: "member"
}

const MOST = 40

export const GoToName = ({ repo, sha, onOpen, onClose }: GoToNameProps) => {
  const ledger = useLedger()
  const frame = useRef<HTMLDialogElement | null>(null)
  const [query, setQuery] = useState("")
  const [at, setAt] = useState(0)
  const [found, setFound] = useState<ReadonlyArray<Place>>([])
  const [warmth, setWarmth] = useState<{ ready: boolean; why?: string } | null>(null)

  const settled = useDeferredValue(query)

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

  /*
   * The reading, once, when this opens.
   *
   * `warm` answers immediately where the repository has already been read at
   * this commit, so opening the box a second time costs a message and nothing
   * else.
   */
  useEffect(() => {
    const reading = Effect.runFork(
      ledger.warm(repo, sha).pipe(
        Effect.map(setWarmth),
        Effect.catch(() => Effect.sync(() => setWarmth({ ready: false, why: "nothing answered" })))
      )
    )
    return () => reading.interruptUnsafe()
  }, [ledger, repo, sha])

  useEffect(() => {
    if (warmth?.ready !== true) return

    const asking = Effect.runFork(
      ledger.namesLike(repo, sha, settled, MOST).pipe(
        Effect.map((answer) => {
          setFound(answer.places)
          setAt(0)
        }),
        Effect.catch(() => Effect.void)
      )
    )
    return () => asking.interruptUnsafe()
  }, [ledger, repo, sha, settled, warmth])

  const move = (by: number) => {
    if (found.length === 0) return
    setAt((was) => (was + by + found.length) % found.length)
  }

  const saying = useMemo(() => {
    if (warmth === null) return "Reading the repository…"
    if (!warmth.ready) return "The repository could not be read at this commit."
    if (found.length === 0 && settled.trim() !== "") return "No name like that in this repository."
    return null
  }, [warmth, found.length, settled])

  return (
    <dialog
      ref={frame}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) frame.current?.close()
      }}
      aria-label="Go to name"
      className={`t-modal mt-[12vh] w-[40rem] max-w-[calc(100vw-var(--sheet-away,4rem))] overflow-hidden p-0 text-ink backdrop:bg-black/50 ${SHEET}`}
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
            aria-label="Go to name"
            placeholder="Go to name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${FIELD} h-9 w-full px-3 text-sm`}
          />
        </div>
        {saying === null ? null : <p className="px-4 pb-3 text-xs text-ink-muted">{saying}</p>}
        {found.length === 0 ? null : (
          <ul className="max-h-[50vh] overflow-y-auto pb-1">
            {found.map((one, row) => (
              <li key={`${one.path}:${one.writing.line}:${one.writing.name}`}>
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
                    {WORD[one.writing.kind]}
                  </span>
                  <span className="min-w-0 shrink-0 font-mono">{one.writing.name}</span>
                  {/* Where it is written, which is the half of the answer the
                      name itself does not give. Truncated from the left, because
                      the end of a path says more than its beginning. */}
                  <span className="min-w-0 flex-1 truncate text-right font-mono text-[0.6875rem] text-ink-muted">
                    {one.path}:{one.writing.line}
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
