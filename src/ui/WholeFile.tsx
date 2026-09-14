import { Effect, Option } from "effect"
import { type CSSProperties, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { diffChoices } from "../domain/choices"
import { wholeFile } from "../domain/wholeFile"
import type { Writing } from "../ports/Ledger"
import type { DiffHandle } from "../ports/Renderer"
import { type DiffEngine, type Note, type Picked, PAPER } from "../ports/Renderer"
import { useFollowing, type Across, type Peeked } from "./following"
import { FileNames } from "./FileNames"
import { BeyondCard } from "./BeyondCard"
import { FollowCard } from "./FollowCard"
import { UsesPanel } from "./UsesPanel"
import { useLedger } from "./ledger"
import { useRenderer } from "./renderer"
import { showLine } from "./showLine"
import { useKeyboard } from "./useKeyboard"
import { useKeys } from "./useKeys"
import { usePaintedTheme } from "./Theme"
import { useSettings } from "./useSettings"

export type WholeFileProps = {
  readonly path: string
  /** The file, a line per entry, exactly as GitHub sent it. */
  readonly lines: ReadonlyArray<string>
  /** Rows to hang under lines of it, in the order they should be created. */
  readonly notes?: ReadonlyArray<Note>
  /** Fills one row. Called per key; the element it returns is kept and reused. */
  readonly fillNote?: (key: string) => HTMLElement | undefined
  /**
   * Lines were dragged out, or the gutter's plus was clicked. Null on letting go.
   *
   * Absent where there is nothing to say about a line, which is the pane beside
   * a repository's tree: it draws a file to be read, and a remark written there
   * would have no pull request to belong to.
   */
  readonly onPick?: (picked: Picked | null) => void
  /**
   * What this file is, for the Ledger to be asked about it.
   *
   * Absent where nothing should be asked — a file whose text this pane was
   * handed lines of rather than the whole of, and every test that draws a file
   * without a Ledger behind it. Then holding the key does nothing, which is
   * what it did before any of this.
   */
  readonly following?: boolean
  /**
   * How to reach the other files of this repository, for a name borrowed from
   * one of them.
   *
   * Absent where nothing can: then a borrowed name has no Writing here, no
   * underline, and the reader is where they were. See `Across` in
   * `src/ui/following.ts`.
   */
  readonly across?: Across
}

const NO_NOTES: ReadonlyArray<Note> = []

/** The one row this component hangs itself, told apart from a caller's by its key. */
const PEEK_KEY = "gitquiet/peek"

/**
 * The Peek as a node: where it is written, and the lines it is written on.
 *
 * Plain DOM because that is what the renderer takes. Dressed in the page's own
 * variables rather than in classes — the row is slotted into the renderer's
 * shadow root, where a stylesheet on the page does not reach, and custom
 * properties are the one thing that crosses that boundary.
 */
const peekRow = (peeked: Peeked | null): HTMLElement | undefined => {
  if (peeked === null) return undefined

  const box = document.createElement("div")
  box.style.cssText =
    "padding:0.5rem 1rem;background:var(--color-raised, var(--bgColor-muted));font-size:0.75rem"

  const where = document.createElement("p")
  where.style.cssText = "margin:0 0 0.25rem;color:var(--fgColor-muted);font-size:0.6875rem"
  where.textContent =
    peeked.where === undefined
      ? `line ${peeked.writing.line}`
      : `${peeked.where}:${peeked.writing.line}`

  const code = document.createElement("pre")
  code.style.cssText =
    "margin:0;overflow-x:auto;font-family:var(--font-mono, ui-monospace, monospace);line-height:1.5"
  code.textContent = peeked.lines.join("\n")

  box.append(where, code)
  return box
}

/**
 * A file nothing has happened to, drawn by the renderer every diff on every
 * other screen is drawn by.
 *
 * Such a file is a patch of all context, so this hands the renderer one and
 * gets the reader's theme, font, wrapping and line numbers for nothing — and
 * the whole file in the document at once, which is what makes the browser's
 * own find work on all of it. See `src/domain/wholeFile.ts`.
 *
 * Two screens read a file this way: the pane beside a repository's tree, and a
 * file's blame, which hangs a commit under the line each Span starts after.
 * The rows are the only difference between them, so they are the only thing
 * this takes beyond the file.
 */
export const WholeFile = ({
  path,
  lines,
  notes = NO_NOTES,
  fillNote,
  onPick,
  following = true,
  across
}: WholeFileProps) => {
  const host = useRef<HTMLDivElement | null>(null)
  const load = useRenderer()
  const painted = usePaintedTheme()
  const { settings } = useSettings()
  const [engine, setEngine] = useState<DiffEngine | null>(null)
  const drawn = useRef<DiffHandle | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const patch = useMemo(() => wholeFile(path, lines), [path, lines])
  // The text as the Ledger wants it, which is the file rather than its rows.
  // Built from the same lines the renderer is drawing, so the two cannot be
  // looking at different files.
  const reading = useMemo(
    () => (following ? { path, text: Effect.succeed(lines.join("\n")) } : null),
    [following, path, lines]
  )
  const { names, shown, peeked, unpeek, asked, unask, askNow, beyond, unbeyond } = useFollowing(
    reading,
    host,
    across
  )

  /*
   * The outline, on a key.
   *
   * Asked for when it is asked for, and never before: `writingsIn` parses the
   * file, and a file nobody wants the shape of should not be parsed for the
   * sake of a panel nobody opened. It is kept once read, because the file on
   * the screen does not change underneath a reader.
   */
  const ledger = useLedger()
  const keys = useKeyboard()
  const [outline, setOutline] = useState<ReadonlyArray<Writing> | null>(null)
  const [naming, setNaming] = useState(false)
  useEffect(() => {
    setOutline(null)
  }, [reading])

  /*
   * The rows, whenever the Peek changes. Not in the render effect above: that
   * one draws the file, and the whole point of a Peek is that it does not.
   */
  useEffect(() => {
    drawn.current?.showNotes(
      peeked === null
        ? notes
        : [...notes, { key: PEEK_KEY, side: "additions" as const, line: peeked.under }]
    )
  }, [peeked, notes])

  // Escape puts it away, which is what Escape means everywhere else here.
  useKeys(keys, {
    fileNames: () => setNaming(reading !== null),
    uses: askNow,
    dismiss: unpeek
  })

  useEffect(() => {
    if (!naming || reading === null || outline !== null) return

    const asking = Effect.runFork(
      reading.text.pipe(
        Effect.flatMap((text) => ledger.writingsIn({ path: reading.path, text })),
        Effect.map(setOutline),
        Effect.catch(() => Effect.sync(() => setOutline([])))
      )
    )
    return () => asking.interruptUnsafe()
  }, [naming, reading, outline, ledger])
  // Deferred for the same reason as `Shell`: redrawing the file is heavy, and
  // the click that changed a knob paints its menu before this catches up.
  const settled = useDeferredValue(settings)
  const choices = useMemo(() => diffChoices(settled.diff), [settled.diff])

  // Read at fill time rather than held by the render below: a caller writes
  // this as an arrow, which is a new function every render, and a redraw of
  // the whole file for a function that answers the same is a redraw wasted.
  const fill = useRef(fillNote)
  fill.current = fillNote

  /*
   * The Peek, hung under the line that asked for it.
   *
   * Through the rows the renderer already hangs under lines — the same
   * mechanism a review thread is drawn in — and through `showNotes`, which
   * changes the rows without redrawing the file. A Peek that redrew the file
   * would take the reader's scroll with it.
   *
   * The element is built rather than rendered: `fillNote` is handed to a
   * renderer that knows nothing of React and wants a node. It is a few lines of
   * code in a box, which is what a node is good at.
   */
  const peeking = useRef<Peeked | null>(null)
  peeking.current = peeked

  useEffect(() => {
    const loading = Effect.runFork(
      load.pipe(Effect.match({ onSuccess: setEngine, onFailure: () => setUnavailable(true) }))
    )
    return () => loading.interruptUnsafe()
  }, [load])

  useEffect(() => {
    const container = host.current
    const source = Option.getOrNull(patch)
    if (engine === null || container === null || source === null) return

    const live = engine.renderDiff(container, {
      patch: source,
      path,
      theme: painted.scheme,
      pack: painted.pack,
      // Unified whatever the reader chose for diffs. Split is two columns of the
      // same file here, which is the setting doing the opposite of what it is
      // for: there is no before and after in a file nothing happened to.
      choices: { ...choices, layout: "unified" },
      notes,
      fillNote: (key) => (key === PEEK_KEY ? peekRow(peeking.current) : fill.current?.(key)),
      onPick,
      onName: names.onName,
      onNameEnter: names.onNameEnter,
      onNameLeave: names.onNameLeave
    })
    names.drawnBy(live)
    drawn.current = live
    return () => {
      drawn.current = null
      names.drawnBy(null)
      live.destroy()
    }
  }, [engine, patch, path, choices, painted.scheme, painted.pack, notes, onPick, names])

  if (Option.isNone(patch)) {
    return <p className="px-4 py-3 text-sm text-ink-muted">This file is empty.</p>
  }

  if (unavailable) {
    return (
      <p className="px-4 py-3 text-sm text-ink-muted">
        The renderer could not be loaded, so nothing is shown rather than half of it.
      </p>
    )
  }

  /*
   * The renderer paints its own background, so it is told which one.
   *
   * Everywhere else it prints on the page's canvas and there that is right: a
   * diff is the whole screen. Here the file is one card among others, so it
   * prints on the sheet and the page shows around it. The variable is the only
   * way in: the renderer writes its colours onto its own host as inline styles,
   * which no container can overrule, but it reads this one from whatever is
   * above it.
   */
  return (
    <>
      <div ref={host} style={{ [PAPER]: "var(--color-raised)" } as CSSProperties} />
      {shown === null ? null : (
        <FollowCard writing={shown.writing} at={shown.at} where={shown.where} />
      )}
      {/*
        A name in another repository. A card and not a jump: leaving a repository
        is a larger thing than scrolling, and should be a press rather than a
        consequence of one.
      */}
      {beyond === null || shown !== null ? null : (
        <BeyondCard
          beyond={beyond.found}
          at={beyond.at}
          onGo={(address) => window.location.assign(address)}
          onClose={unbeyond}
        />
      )}
      {/*
        The list, however it was asked for: a press on an underlined name, or
        the key over one. Both are the same question and the same panel; the
        press is the one a reader finds without being told.
      */}
      {asked === null ? null : (
        <UsesPanel
          writing={asked.writing}
          where={asked.where}
          at={asked.at}
          reading={{ path, text: lines.join("\n") }}
          onGo={(line) => showLine(host.current, line)}
          onClose={unask}
          onOpen={across?.open}
          across={
            across?.repo === undefined || across.sha === undefined
              ? undefined
              : { repo: across.repo, sha: across.sha }
          }
        />
      )}
      {naming ? (
        <FileNames
          writings={outline ?? []}
          loading={outline === null}
          onOpen={(writing) => showLine(host.current, writing.line)}
          onClose={() => setNaming(false)}
        />
      ) : null}
    </>
  )
}
