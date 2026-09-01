import { Effect, Option } from "effect"
import { type CSSProperties, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { diffChoices } from "../domain/choices"
import type { Blamed } from "../domain/blame"
import { spansOf } from "../domain/blame"
import type { RepoRef } from "../domain/PullRequestRef"
import type { Repository } from "../domain/repositories"
import { wholeFile } from "../domain/wholeFile"
import { type DiffEngine, PAPER } from "../ports/Renderer"
import { keyOf, notesOf } from "./blameNotes"
import { DrawnAt } from "./drawnAt"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { useRenderer } from "./renderer"
import { SpanHeading } from "./SpanHeading"
import { TheBar } from "./TheBar"
import { usePaintedTheme } from "./Theme"
import { useLive } from "./useLive"
import { useSettings } from "./useSettings"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type BlameScreenProps = {
  readonly repo: RepoRef
  readonly branch: string
  readonly path: string
  readonly load: (partly: (value: Blamed) => void) => Effect.Effect<Blamed, unknown>
  readonly preload?: () => Effect.Effect<Option.Option<Blamed>>
  /** Restores GitHub's own blame, still on the page behind this. */
  readonly onStepAside: () => void
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  /** The exact pathname this screen stands for, as {@link DrawnAt} needs it said. */
  readonly at?: string
}

/**
 * The whole file, with each Span's commit hung as a row where it starts.
 *
 * The same renderer every other screen draws a file through — see
 * `ReadingPane`'s `Source`, which this mirrors — so the file is whole in the
 * document from the first paint and browser find works on all of it. What is
 * new is the rows: one per Span past the first, hung under the last line of
 * whatever came before it, each carrying that commit's face, name, message
 * and age, or a thin divider where the commit already told its story higher
 * on the page.
 */
const Blamed_ = ({ blamed, path }: { readonly blamed: Blamed; readonly path: string }) => {
  const host = useRef<HTMLDivElement | null>(null)
  const load = useRenderer()
  const painted = usePaintedTheme()
  const { settings } = useSettings()
  const [engine, setEngine] = useState<DiffEngine | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const spans = useMemo(() => spansOf(blamed.ranges, blamed.commits), [blamed])
  const notes = useMemo(() => notesOf(spans), [spans])
  const bySpanKey = useMemo(
    () => new Map(spans.filter((span) => span.start > 1).map((span) => [keyOf(span), span])),
    [spans]
  )
  const first = spans[0]

  const patch = useMemo(() => wholeFile(path, blamed.lines), [path, blamed.lines])
  const settled = useDeferredValue(settings)
  const choices = useMemo(() => diffChoices(settled.diff), [settled.diff])

  // One element per row, made once and kept: the renderer asks for a row's
  // contents while it is drawing, and a row rebuilt on every render would be
  // a heading the portal below has to reattach every time.
  const rows = useRef(new Map<string, HTMLElement>())
  const rowFor = (key: string): HTMLElement => {
    const held = rows.current.get(key)
    if (held !== undefined) return held
    const made = document.createElement("div")
    rows.current.set(key, made)
    return made
  }
  for (const note of notes) rowFor(note.key)

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
      choices: { ...choices, layout: "unified" },
      notes,
      fillNote: (key) => rows.current.get(key)
    })
    return () => live.destroy()
  }, [engine, patch, path, choices, painted.scheme, painted.pack, notes])

  if (Option.isNone(patch)) {
    return <p className="p-4 text-sm text-ink-muted">This file is empty.</p>
  }

  if (unavailable) {
    return (
      <p className="p-4 text-sm text-ink-muted">
        The renderer could not be loaded, so nothing is shown rather than half of it.
      </p>
    )
  }

  return (
    <>
      {first === undefined ? null : <SpanHeading span={first} />}
      <div ref={host} style={{ [PAPER]: "var(--color-raised)" } as CSSProperties} />
      {[...rows.current].map(([key, node]) => {
        const span = bySpanKey.get(key)
        return span === undefined ? null : createPortal(<SpanHeading span={span} />, node)
      })}
    </>
  )
}

const READING = "Reading this file's blame…"

/**
 * Who wrote each line, and when — the page `docs/spec/blame.md` describes.
 */
export const BlameScreen = ({
  repo,
  branch,
  path,
  load,
  preload,
  onStepAside,
  recallRepositories,
  where,
  at,
  signedIn = viewerOnPage
}: BlameScreenProps) => {
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)

  if (read.status === "failed") {
    return (
      <>
        <DrawnAt path={at ?? null} />
        <ReadFailed
          signedOut={!signedIn()}
          why={read.why}
          what={`The blame of ${path}`}
          onStepAside={onStepAside}
          asideLabel="Show GitHub's blame"
        />
      </>
    )
  }

  return (
    <>
      <DrawnAt path={at ?? null} />
      <TheBar where={{ kind: "repository", owner: repo.owner, repo: repo.repo }} recall={recallRepositories} />
      <section aria-label="Blame" className="min-w-0">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm text-ink-muted">
          <span className="truncate font-mono">{path}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{branch}</span>
          {read.status === "ready" && read.value.ignoreRevsPresent ? (
            <span className="ml-auto shrink-0 text-xs">
              Blame follows <code className="font-mono">.git-blame-ignore-revs</code>
            </span>
          ) : null}
        </div>
        {read.status === "ready" ? (
          <Blamed_ blamed={read.value} path={path} />
        ) : (
          <Waiting what={READING} leaving={!waiting} />
        )}
      </section>
    </>
  )
}
