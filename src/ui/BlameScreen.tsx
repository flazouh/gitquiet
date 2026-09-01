import type { Effect, Option } from "effect"
import { useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import type { Blamed } from "../domain/blame"
import { spansOf } from "../domain/blame"
import type { RepoRef } from "../domain/PullRequestRef"
import type { Repository } from "../domain/repositories"
import { keyOf, notesOf } from "./blameNotes"
import { DrawnAt } from "./drawnAt"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { SpanHeading } from "./SpanHeading"
import { TheBar } from "./TheBar"
import { useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"
import { WholeFile } from "./WholeFile"

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
 * The file itself is `WholeFile`, the same drawing the pane beside a
 * repository's tree uses. What is blame's own is the rows: one per Span past
 * the first, hung under the last line of whatever came before it, each
 * carrying that commit's face, name, message and age, or a thin divider where
 * the commit already told its story higher on the page. The first Span has no
 * line to hang under, so it stands above the file instead.
 */
const BlamedFile = ({ blamed, path }: { readonly blamed: Blamed; readonly path: string }) => {
  const spans = useMemo(() => spansOf(blamed.ranges, blamed.commits), [blamed])
  const notes = useMemo(() => notesOf(spans), [spans])
  /*
   * Every Span, keyed the same way `notes` keys its rows — not just the ones
   * with a row. `rowFor` below only ever asks this for a key `notesOf` produced,
   * which is never the first Span's, so there is nothing to exclude here without
   * repeating the rule `noteFor` already owns.
   */
  const bySpanKey = useMemo(
    () => new Map(spans.map((span) => [keyOf(span), span])),
    [spans]
  )
  const first = spans[0]

  // One element per row, made once and kept, the way `Files` keeps its own:
  // the renderer asks for a row's contents while it is drawing, and a row
  // rebuilt on every render would be a heading the portal below has to
  // reattach every time.
  const rows = useRef(new Map<string, HTMLElement>())
  const rowFor = (key: string): HTMLElement => {
    const held = rows.current.get(key)
    if (held !== undefined) return held
    const made = document.createElement("div")
    rows.current.set(key, made)
    return made
  }
  for (const note of notes) rowFor(note.key)

  return (
    <>
      {first === undefined ? null : <SpanHeading span={first} />}
      <WholeFile
        path={path}
        lines={blamed.lines}
        notes={notes}
        fillNote={(key) => rows.current.get(key)}
      />
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
          <BlamedFile blamed={read.value} path={path} />
        ) : (
          <Waiting what={READING} leaving={!waiting} />
        )}
      </section>
    </>
  )
}
