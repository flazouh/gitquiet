import { Effect, Option } from "effect"
import { type CSSProperties, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { diffChoices } from "../domain/choices"
import { wholeFile } from "../domain/wholeFile"
import { type DiffEngine, type Note, PAPER } from "../ports/Renderer"
import { useRenderer } from "./renderer"
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
}

const NO_NOTES: ReadonlyArray<Note> = []

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
export const WholeFile = ({ path, lines, notes = NO_NOTES, fillNote }: WholeFileProps) => {
  const host = useRef<HTMLDivElement | null>(null)
  const load = useRenderer()
  const painted = usePaintedTheme()
  const { settings } = useSettings()
  const [engine, setEngine] = useState<DiffEngine | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const patch = useMemo(() => wholeFile(path, lines), [path, lines])
  // Deferred for the same reason as `Shell`: redrawing the file is heavy, and
  // the click that changed a knob paints its menu before this catches up.
  const settled = useDeferredValue(settings)
  const choices = useMemo(() => diffChoices(settled.diff), [settled.diff])

  // Read at fill time rather than held by the render below: a caller writes
  // this as an arrow, which is a new function every render, and a redraw of
  // the whole file for a function that answers the same is a redraw wasted.
  const fill = useRef(fillNote)
  fill.current = fillNote

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
      fillNote: (key) => fill.current?.(key)
    })
    return () => live.destroy()
  }, [engine, patch, path, choices, painted.scheme, painted.pack, notes])

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
  return <div ref={host} style={{ [PAPER]: "var(--color-raised)" } as CSSProperties} />
}
