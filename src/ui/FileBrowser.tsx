import { ArrowLeftIcon, ArrowRightIcon } from "@primer/octicons-react"
import { Option } from "effect"
import { useCallback, useEffect, useMemo, useState } from "react"
import { diffLibrary, type DiffFetcher } from "../diff/library"
import { readingOrder } from "../diff/readingOrder"
import type { DiffChoices, TreeChoices } from "../settings/apply"
import type { ChangedFile, ReviewThread } from "../domain/PullRequest"
import { chordFor, DEFAULT_PROFILE, type Profile } from "../keys/commands"
import { Cap } from "./Cap"
import { draftsIn, dropDraft, saveDraft, type Draft } from "./drafts"
import { FileDiffPane, FileTreePane } from "./Files"
import { FileHeading } from "./FileHeading"
import { seenFiles } from "./rowMarks"
import { useKeys } from "./useKeys"

export type FileBrowserProps = {
  readonly files: ReadonlyArray<ChangedFile>
  readonly fetchDiffs: DiffFetcher
  readonly diff: DiffChoices
  readonly tree: TreeChoices
  /** The settings menu, handed in so the browser owns where it sits, not what it is. */
  readonly menu?: React.ReactNode
  /** Markdown files open as documents unless the reader turned that off. */
  readonly proseAsDocument?: boolean
  /** Whose keys move between files, and reach the tree's filter. */
  readonly keys?: Profile
  /**
   * A file somewhere else asked for, such as one named in a failing log.
   *
   * Carried as a whole object rather than a path so that asking twice for the
   * same file still counts as asking: a reader who clicks the same line in a
   * log again means it, and a path compared against itself would ignore them.
   */
  readonly wanted?: { readonly path: string }
  /** Everything said on the pull request, so a remark can sit on its own line. */
  readonly threads?: ReadonlyArray<ReviewThread>
  /** Sends a remark on some lines of a file to GitHub. */
  readonly onPost?: (note: {
    readonly path: string
    readonly from: number
    readonly to: number
    readonly body: string
  }) => Promise<void>
  /** Whoever is writing, so the box is signed the way the remark will be. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
}

/**
 * How far ahead to read. A pull request of nine hundred files is not going to
 * be read to the end, and fetching all of it to find that out is rude to
 * whoever's connection it is.
 */
const WARM_LIMIT = 120

/**
 * Drawing a file the reader has not asked for yet, once they have stopped
 * asking for things.
 *
 * Opening a file costs a parse, a highlight and a few thousand elements — a
 * third of a second on a pull request of any size, and every millisecond of it
 * inside the keypress that asked for the file, where it is felt as the page
 * going away for a moment. The work does not get smaller by being moved, it
 * gets invisible: done while the reader is reading, `j` has nothing left to do
 * but show what is already there.
 *
 * Idle time rather than a timer, so it never competes with the reader; the
 * deadline is there because a page that is never idle would otherwise never
 * read ahead at all.
 */
const whenIdle = (act: () => void): (() => void) => {
  const later = globalThis.requestIdleCallback
  if (later === undefined) {
    const soon = setTimeout(act, 200)
    return () => clearTimeout(soon)
  }

  const asked = later(() => act(), { timeout: 1_000 })
  return () => globalThis.cancelIdleCallback?.(asked)
}

/** The files worth holding drawn: the one being read, and the two a key reaches. */
const withinReach = (
  paths: ReadonlyArray<string | undefined>
): ReadonlyArray<string> => [
  ...new Set(paths.filter((path): path is string => path !== undefined))
]

const total = (files: ReadonlyArray<ChangedFile>, of: "linesAdded" | "linesDeleted"): number =>
  files.reduce((sum, file) => sum + file[of], 0)

const isProse = (path: string): boolean => /\.(md|mdx|markdown)$/i.test(path)

const Choice = ({
  name,
  chosen,
  onChoose
}: {
  readonly name: string
  readonly chosen: boolean
  readonly onChoose: () => void
}) => (
  <button
    type="button"
    aria-pressed={chosen}
    onClick={onChoose}
    className={`px-2 py-1 text-xs font-semibold ${
      chosen ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"
    }`}
  >
    {name}
  </button>
)

/**
 * The changed files, as one thing.
 *
 * A tree in one box beside a diff in another box is two panels that happen to
 * touch, and it reads as two: the eye has to work out that choosing on the left
 * changes the right. One surface, one border, one header spanning both halves,
 * and the tree on the recessed edge of it — which is what every editor does,
 * and why nobody has to be told how it works.
 */
export const FileBrowser = ({
  files,
  fetchDiffs,
  diff,
  tree,
  menu,
  proseAsDocument = true,
  keys = DEFAULT_PROFILE,
  wanted,
  threads = [],
  onPost,
  viewer
}: FileBrowserProps) => {
  const [chosen, setChosen] = useState<string | undefined>(files[0]?.path)
  // A README opens as the document it is; a source file opens as a diff. Both
  // are what the file is normally read as, and either can be switched.
  const [reading, setReading] = useState(proseAsDocument && isProse(files[0]?.path ?? ""))

  // Opening a file is what counts as having looked at it. Nothing subtler —
  // dwell time, how far it was scrolled — because the reader can already see
  // which files they opened, and a mark that disagrees with that is a mark
  // nobody trusts twice.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() =>
    files[0] === undefined ? new Set() : new Set([files[0].path])
  )

  // Which files are drawn, whether or not they are the one on screen. The one
  // being read is always among them; the rest are how Next and Previous become
  // a change of what is visible rather than a file built from scratch.
  const [drawn, setDrawn] = useState<ReadonlyArray<string>>(() =>
    files[0] === undefined ? [] : [files[0].path]
  )

  const onSelect = useCallback((path: string) => {
    setChosen(path)
    setReading(proseAsDocument && isProse(path))
    setOpened((held) => (held.has(path) ? held : new Set([...held, path])))
  }, [proseAsDocument])

  useEffect(() => {
    if (wanted === undefined) return
    if (files.some((file) => file.path === wanted.path)) onSelect(wanted.path)
  }, [files, onSelect, wanted])

  const seen = useMemo(() => seenFiles(files, opened), [files, opened])

  const library = useMemo(() => diffLibrary(fetchDiffs), [fetchDiffs])

  // Held here rather than in the pane: the pane is torn down and built again
  // every time another file is opened, and a comment half-written in one file
  // has to still be there after a look at the next.
  const [drafts, setDrafts] = useState<ReadonlyArray<Draft>>([])
  const onSaveDraft = useCallback((draft: Draft) => {
    setDrafts((held) => saveDraft(held, draft))
  }, [])
  const onDropDraft = useCallback((key: string) => {
    setDrafts((held) => dropDraft(held, key))
  }, [])
  const mine = useMemo(() => draftsIn(drafts, chosen ?? ""), [drafts, chosen])

  const index = files.findIndex((file) => file.path === chosen)
  const file = files[index] ?? files[0]

  // Read ahead of the reader. Only the files GitHub held back are worth asking
  // for, in the order they are likely to be opened; the library skips whatever
  // it already holds, so moving through the list costs one request per batch
  // rather than one per file, and Next rarely waits for anything.
  useEffect(() => {
    const held = new Set(
      files.filter((candidate) => Option.isSome(candidate.diff)).map((candidate) => candidate.path)
    )
    const order = readingOrder(
      files.map((candidate) => candidate.path),
      index
    ).filter((path) => !held.has(path))

    library.warm(order.slice(0, WARM_LIMIT))
  }, [library, files, index])
  const previous = index > 0 ? files[index - 1] : undefined
  const next = files[index + 1]

  // Two passes, and the order of them is the point. The file asked for joins
  // whatever is already drawn, immediately, so that arriving somewhere never
  // waits; then, once the page is idle, the set is cut back to what a key can
  // reach and the file on the other side of the reader is drawn as well.
  const here = file?.path
  useEffect(() => {
    if (here === undefined) return
    setDrawn((held) => (held.includes(here) ? held : [...held, here]))
  }, [here])

  useEffect(() => {
    if (here === undefined) return
    return whenIdle(() => setDrawn(withinReach([previous?.path, here, next?.path])))
  }, [here, previous?.path, next?.path])

  // A file that has since been dropped from the pull request cannot be drawn.
  const showing = useMemo(
    () =>
      withinReach([here, ...drawn])
        .map((path) => files.find((one) => one.path === path))
        .filter((one): one is ChangedFile => one !== undefined),
    [drawn, files, here]
  )
  const on = chordFor(keys, "nextFile")
  const back = chordFor(keys, "previousFile")

  // The review loop, off the keyboard. Nothing happens at either end rather
  // than wrapping around: a reader who holds j down should stop at the last
  // file, not find themselves back at the first one wondering how.
  useKeys(keys, {
    nextFile: () => {
      if (next !== undefined) onSelect(next.path)
    },
    previousFile: () => {
      if (previous !== undefined) onSelect(previous.path)
    }
  })

  if (files.length === 0) {
    return (
      <section
        aria-label="Files"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-line"
      >
        <p className="px-3 py-3 text-sm text-ink-muted">No files changed</p>
      </section>
    )
  }

  return (
    <section
      aria-label="Files"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-line"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-2">
        {/* No heading: the panel is the files, and the counts below say so in
            the same breath as saying how many. The section keeps its name for
            anyone arriving by landmark. */}
        <span className="shrink-0 text-xs text-ink-muted tabular-nums">
          {`${files.length} changed`}{" "}
          <span className="text-pass">+{total(files, "linesAdded")}</span>{" "}
          <span className="text-fail">−{total(files, "linesDeleted")}</span>
        </span>
        {/* How much of the review is behind you. A pull request of forty files
            is read over an afternoon and in three sittings, and the question on
            coming back to it is always the same one. */}
        <span
          className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted tabular-nums"
          title={`${seen.size} of ${files.length} files opened or ticked as viewed on GitHub`}
        >
          <span
            aria-hidden
            className="h-1 w-12 overflow-hidden rounded-full bg-surface ring-1 ring-line"
          >
            <span
              className="block h-full bg-pass-emphasis"
              style={{ width: `${Math.round((seen.size / files.length) * 100)}%` }}
            />
          </span>
          {`${seen.size} of ${files.length} seen`}
        </span>
        {/* The open file is named directly above its diff, not here. This band
            belongs to the whole set of files; a name in it spends the width
            that pushed everything else to the right, and repeats what the
            heading below already says. */}
        <span className="min-w-0 flex-1" />
        {/* A README arrives as a wall of pipes and hashes, and the change it
            makes is to a document. Only for prose, and only when there is
            something to render: offering it on a TypeScript file would be a
            switch that does nothing. */}
        {file !== undefined && isProse(file.path) ? (
          <span className="flex shrink-0 overflow-hidden rounded-md border border-line">
            <Choice name="Diff" chosen={!reading} onChoose={() => setReading(false)} />
            <Choice name="Preview" chosen={reading} onChoose={() => setReading(true)} />
          </span>
        ) : null}
        {/* Both directions, side by side: reading a review is as much going
            back over a file as moving on from one, and a lone Next makes the
            way back a hunt through the tree.

            Each wears its key. The two buttons are pressed dozens of times in
            one review, which is exactly the place to be told there is a letter
            that does the same thing without the trip to the pointer. */}
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={previous === undefined}
            aria-keyshortcuts={back ?? undefined}
            onClick={() => previous !== undefined && onSelect(previous.path)}
            className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted disabled:opacity-40"
          >
            <ArrowLeftIcon size={12} />
            Previous
            {back === null ? null : <Cap chord={back} />}
          </button>
          <button
            type="button"
            disabled={next === undefined}
            aria-keyshortcuts={on ?? undefined}
            onClick={() => next !== undefined && onSelect(next.path)}
            className="flex items-center gap-1.5 rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis disabled:opacity-40"
          >
            Next file
            {on === null ? null : <Cap chord={on} tone="onEmphasis" />}
            <ArrowRightIcon size={12} />
          </button>
        </span>
        {menu}
      </div>

      <div className="flex min-h-0 flex-1 items-stretch">
        {/* Wide enough that a nested path still reads: every level of nesting
            spends indentation, and a repository's files are five deep before
            the name even starts. */}
        {/* No fill of its own: a darker rail beside lighter code is two panels
            again, which is the thing this component exists to stop. The border
            is the only thing that divides them. */}
        <div className={`${tree.width} shrink-0 overflow-auto border-r border-line py-1`}>
          {/* Built again when one of these changes: the tree reads them once,
              when it is constructed, and hands back no way to change its mind.
              Everything else — icons, the marks on a row — it will redraw in
              place, so this key deliberately does not mention them. */}
          <FileTreePane
            key={`${tree.density}|${tree.flatten}|${tree.folders}|${tree.search}|${tree.sticky}`}
            files={files}
            selected={chosen === undefined ? Option.none() : Option.some(chosen)}
            onSelect={onSelect}
            seen={seen}
            choices={tree}
            keys={keys}
          />
        </div>
        {/* One heading above the stack rather than one per drawing: which file
            is open is a fact about the panel, and it was already pinned to the
            top of the scroll while the code moved under it. */}
        <div className="flex min-w-0 flex-1 flex-col">
          {file === undefined ? null : <FileHeading file={file} icons={tree.icons} />}
          {/* The drawings sit on top of one another, all of them laid out and
              only one of them visible. Laid out matters: a diff built inside a
              hidden box has no width to measure and draws nothing, so the ones
              waiting their turn are merely invisible — and, incidentally, keep
              their own scroll, so going back to a file returns to the part of
              it that was being read. */}
          <div className="relative min-h-0 flex-1">
            {showing.map((one) => {
              const open = one.path === file?.path
              return (
                <div
                  key={one.path}
                  data-file={one.path}
                  aria-hidden={open ? "false" : "true"}
                  className="absolute inset-0 overflow-auto"
                  style={
                    open ? undefined : { visibility: "hidden", pointerEvents: "none" }
                  }
                >
                  <FileDiffPane
                    file={one}
                    ask={library.ask}
                    reading={open ? reading : proseAsDocument && isProse(one.path)}
                    choices={diff}
                    drafts={open ? mine : draftsIn(drafts, one.path)}
                    onSaveDraft={onSaveDraft}
                    onDropDraft={onDropDraft}
                    threads={threads}
                    viewer={viewer}
                    onPost={
                      onPost === undefined
                        ? undefined
                        : (note) => onPost({ path: one.path, ...note })
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
