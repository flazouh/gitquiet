import { ArrowLeftIcon, ArrowRightIcon } from "@primer/octicons-react"
import { Option } from "effect"
import { useCallback, useEffect, useMemo, useState } from "react"
import { diffLibrary, type DiffFetcher } from "../diff/library"
import { readingOrder } from "../diff/readingOrder"
import type { DiffChoices, TreeChoices } from "../settings/apply"
import type { ChangedFile } from "../domain/PullRequest"
import { draftsIn, dropDraft, saveDraft, type Draft } from "./drafts"
import { FileDiffPane, FileTreePane } from "./Files"
import { FileHeading } from "./FileHeading"
import { seenFiles } from "./rowMarks"

export type FileBrowserProps = {
  readonly files: ReadonlyArray<ChangedFile>
  readonly fetchDiffs: DiffFetcher
  readonly diff: DiffChoices
  readonly tree: TreeChoices
  /** The settings menu, handed in so the browser owns where it sits, not what it is. */
  readonly menu?: React.ReactNode
  /** Markdown files open as documents unless the reader turned that off. */
  readonly proseAsDocument?: boolean
}

/**
 * How far ahead to read. A pull request of nine hundred files is not going to
 * be read to the end, and fetching all of it to find that out is rude to
 * whoever's connection it is.
 */
const WARM_LIMIT = 120

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
  proseAsDocument = true
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

  const onSelect = useCallback((path: string) => {
    setChosen(path)
    setReading(proseAsDocument && isProse(path))
    setOpened((held) => (held.has(path) ? held : new Set([...held, path])))
  }, [proseAsDocument])

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
            way back a hunt through the tree. */}
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={previous === undefined}
            onClick={() => previous !== undefined && onSelect(previous.path)}
            className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted disabled:opacity-40"
          >
            <ArrowLeftIcon size={12} />
            Previous
          </button>
          <button
            type="button"
            disabled={next === undefined}
            onClick={() => next !== undefined && onSelect(next.path)}
            className="flex items-center gap-1.5 rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis disabled:opacity-40"
          >
            Next file
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
          />
        </div>
        <div className="min-w-0 flex-1 overflow-auto">
          {file === undefined ? null : (
            <>
              <FileHeading file={file} icons={tree.icons} />
              <FileDiffPane
                file={file}
                ask={library.ask}
                reading={reading}
                choices={diff}
                drafts={mine}
                onSaveDraft={onSaveDraft}
                onDropDraft={onDropDraft}
              />
            </>
          )}
        </div>
      </div>
    </section>
  )
}
