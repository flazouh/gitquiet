// First, and on its own line: the tree reads the custom element registry as it
// is evaluated, and in a content script there is none until this has run.
import "./customElements"

import { FileTree, useFileTree } from "@pierre/trees/react"
import type { GitStatus } from "@pierre/trees"
import { Effect, Option } from "effect"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { DiffEngine, DiffHandle, DiffSide, Note as NoteAt, Picked } from "../ports/Renderer"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import { toPatch } from "../domain/toPatch"
import { withoutWhitespace } from "../domain/withoutWhitespace"
import type { ChangedFile, ChangeType, FileDiff, ReviewThread } from "../domain/PullRequest"
import { DEFAULT_PROFILE, type Profile } from "../keys/commands"
import type { DiffChoices, TreeChoices } from "../domain/choices"
import { useKeys } from "./useKeys"
import { draftKey, type Draft } from "./drafts"
import { Note } from "./Note"
import { ProseDiff } from "./ProseDiff"
import { useRenderer } from "./renderer"
import { rowMarks, shortCount, type RowMark } from "./rowMarks"
import { type Answering, ThreadInDiff } from "./ThreadView"
import { threadKey, threadNotes, threadsIn } from "./threads"
import {
  MATERIAL_BY_EXTENSION,
  MATERIAL_BY_FILE_NAME,
  MATERIAL_FILE,
  MATERIAL_SPRITE
} from "./materialIcons.generated"

/** Their word for what happened to a file; ours differs on two of six. */
const gitStatusOf = (change: ChangeType): GitStatus => {
  switch (change) {
    case "added":
      return "added"
    case "deleted":
      return "deleted"
    case "renamed":
      return "renamed"
    case "copied":
    case "modified":
    case "changed":
      return "modified"
  }
}

/**
 * The tree wearing GitHub's colours rather than Pierre's.
 *
 * It ships its own palette and takes overrides through these variables, so the
 * page's theme — dark, dark dimmed, light, high contrast, colourblind — is
 * answered by naming Primer's variables here and nothing else. The file-type
 * icon colours are left alone: they are semantic rather than themed, and GitHub
 * has no opinion about what colour a TypeScript file is.
 */
const PRIMER_TREE = {
  // A real colour rather than `transparent`, and the same one the subcard it
  // sits in is painted in (`bg-canvas`): the tree fades a too-long name out with
  // a gradient in its own background, so a transparent one fades to nothing and
  // a different one draws a panel edge halfway down the rail.
  "--trees-bg-override": "var(--color-canvas)",
  "--trees-bg-muted-override": "var(--color-canvas)",
  "--trees-fg-override": "var(--color-ink)",
  "--trees-fg-muted-override": "var(--color-ink-muted)",
  "--trees-accent-override": "var(--color-accent-emphasis)",
  "--trees-border-color-override": "transparent",
  "--trees-border-radius-override": "var(--radius-md, 6px)",

  // Tight, because every row of tree is a row of code not being read. Their
  // default spends thirty pixels of height and sixteen of margin on each file;
  // an editor's sidebar spends twenty-two and four, and nobody finds those
  // cramped.
  "--trees-padding-inline-override": "4px",
  "--trees-item-padding-x-override": "4px",

  // The tree takes its scrollbar's width off the right-hand padding so the rows
  // stay centred once a scrollbar appears, and measures that width against its
  // own styled 6px one. Overlay scrollbars reserve no room, so the measurement
  // is 6px of subtraction against 0px of scrollbar: rows sat 4px from the left
  // edge and 1.6px from the right. Zero is the true width here.
  "--trees-scrollbar-gutter-measured": "0px",
  "--trees-level-gap-override": "10px",
  "--trees-font-size-override": "12px"
} as React.CSSProperties

/**
 * Material's file icons, which is what an editor's sidebar looks like.
 *
 * The tree's own set is drawn to its own taste; these are the icons anyone who
 * has opened VS Code already reads without looking. The sheet holds the sixty
 * that a code repository actually contains — see scripts/build-tree-icons.ts —
 * and the built-in `minimal` set still draws the chrome around them: chevrons,
 * folders, the dot that marks a change.
 */
const MATERIAL_ICONS = {
  set: "minimal" as const,
  spriteSheet: MATERIAL_SPRITE,
  remap: { "file-tree-icon-file": MATERIAL_FILE },
  byFileName: MATERIAL_BY_FILE_NAME,
  byFileExtension: MATERIAL_BY_EXTENSION
}

/**
 * The tree's own icons, for a reader who would rather not have Material's.
 *
 * Their complete set: one glyph per file type, drawn to match the chrome around
 * it rather than to be recognised from across a room.
 */
const PLAIN_ICONS = { set: "complete" as const }

/** Nothing seen yet, shared so a default prop is not a new set every render. */
const EMPTY: ReadonlySet<string> = new Set()

/** Whichever of its two themes GitHub is currently wearing. */
const preferredTheme = (): "light" | "dark" => {
  const mode = document.documentElement.dataset.colorMode
  if (mode === "light" || mode === "dark") return mode
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export type FileTreePaneProps = {
  readonly files: ReadonlyArray<ChangedFile>
  readonly selected: Option.Option<string>
  readonly onSelect: (path: string) => void
  /** The files already opened, which the rows mark off. */
  readonly seen?: ReadonlySet<string>
  /** How the reader has asked for the rail to be drawn. */
  readonly choices: TreeChoices
  /** Whose keys open the filter. */
  readonly keys?: Profile
}

/**
 * What a row says to the right of its name: whether it has been read, and how
 * much of it there is to read.
 *
 * The numbers are the reason a rail beats a list — which of forty files is the
 * two-line rename and which is the eight-hundred-line rewrite is the first
 * thing anyone wants to know, and it is the one thing a list of names cannot
 * say. Zeroes are left out: a file that only adds should not spend a third of
 * a narrow rail saying it deleted nothing.
 */
const rowDecoration = (mark: RowMark, show: { counts: boolean; ticks: boolean }) => {
  const { counts: withCounts } = show
  const parts = [
    ...(show.ticks && mark.seen ? [{ text: "✓\u00a0", color: "var(--fgColor-muted)" }] : []),
    ...(withCounts && mark.added > 0
      ? [{ text: `+${shortCount(mark.added)}`, color: "var(--fgColor-success)" }]
      : []),
    ...(withCounts && mark.added > 0 && mark.deleted > 0 ? [{ text: "\u00a0" }] : []),
    ...(withCounts && mark.deleted > 0
      ? [{ text: `−${shortCount(mark.deleted)}`, color: "var(--fgColor-danger)" }]
      : [])
  ]
  if (parts.length === 0) return null

  const counts = `+${mark.added} −${mark.deleted}`
  return { text: counts, title: mark.seen ? `${counts}, seen` : counts, parts }
}

/**
 * Every changed file, as a tree, in the rail.
 *
 * The tree owns its own selection and reports it outwards; a file chosen
 * anywhere else is pushed back in, so the highlighted row and the panel never
 * disagree about which file is being read.
 */
export const FileTreePane = ({
  files,
  selected,
  onSelect,
  seen = EMPTY,
  choices,
  keys = DEFAULT_PROFILE
}: FileTreePaneProps) => {
  const paths = useMemo(() => files.map((file) => file.path), [files])
  const gitStatus = useMemo(
    () => files.map((file) => ({ path: file.path, status: gitStatusOf(file.changeType) })),
    [files]
  )

  // Through a ref for the same reason the selection callback is: the tree reads
  // its options once, when it is built, and never again.
  const marks = useRef(rowMarks(files, seen))
  marks.current = rowMarks(files, seen)
  const marking = useRef({ counts: choices.counts, ticks: choices.ticks })
  marking.current = { counts: choices.counts, ticks: choices.ticks }

  // The callback through a ref, and the first selection captured once: the tree
  // reapplies its options whenever they change, and options rebuilt on every
  // render reset the selection to the first file on every click — which looked
  // exactly like clicks doing nothing.
  const report = useRef(onSelect)
  useEffect(() => {
    report.current = onSelect
  }, [onSelect])
  const openedOn = useRef(Option.getOrUndefined(selected))

  const options = useMemo(
    () => ({
      paths,
      gitStatus,
      initialExpansion: choices.folders,
      // Their presets: a row height, and every gap scaled with it.
      density: choices.density,
      initialSelectedPaths: openedOn.current === undefined ? [] : [openedOn.current],
      flattenEmptyDirectories: choices.flatten,
      icons: choices.icons === "material" ? MATERIAL_ICONS : PLAIN_ICONS,
      search: choices.search,
      stickyFolders: choices.sticky,
      // Their lane for these takes whatever room is left over and clips what
      // does not fit, which in a rail this narrow was most of the numbers. The
      // numbers are short and fixed; the names are long and already truncate
      // themselves in the middle, so the names are what should give way.
      //
      // The git lane goes entirely: it spells out A, M, D beside a name that
      // the same status has already coloured, and every folder in a rail of
      // changed files contains a change, so its dot marks nothing out. Its
      // width goes back to the names.
      unsafeCSS:
        '[data-item-section="decoration"] { flex: 0 0 auto; }' +
        '[data-item-section="git"] { display: none; }',
      renderRowDecoration: ({ row }: { row: { path: string } }) => {
        // A directory's path ends in a slash here and nowhere else.
        const mark = marks.current.get(row.path.replace(/\/$/, ""))
        return mark === undefined ? null : rowDecoration(mark, marking.current)
      },
      onSelectionChange: (chosen: ReadonlyArray<string>) => {
        const [first] = chosen
        if (first !== undefined) report.current(first)
      }
    }),
    [paths, gitStatus, choices]
  )

  const { model } = useFileTree(options)

  // The filter is the tree's own, in its shadow root, and nothing outside could
  // reach it before. Bound only when the reader has the filter turned on: a key
  // that silently does nothing is worse than one that was never mentioned.
  useKeys(choices.search ? keys : "off", { search: () => model.openSearch() })

  // Rows are drawn once and left alone, so a file being marked off has to ask
  // for them again. Handing back the same icons is the only call in the tree's
  // API that redraws every row while leaving the selection, the scroll and what
  // is expanded exactly as they were.
  useEffect(() => {
    model.setIcons(choices.icons === "material" ? MATERIAL_ICONS : PLAIN_ICONS)
  }, [model, seen, choices])

  // A file chosen anywhere else — Next, Previous, a link — pushed into the tree,
  // through the handle for the row rather than a method on the tree: the tree
  // itself has none, and the call we used to make silently did nothing, which
  // is why the highlight stayed behind when Next moved on.
  const wanted = Option.getOrUndefined(selected)
  useEffect(() => {
    if (wanted === undefined) return

    const row = model.getItem(wanted)
    if (row === null || row.isSelected()) return

    for (const held of model.getSelectedPaths()) {
      if (held !== wanted) model.getItem(held)?.deselect()
    }
    row.select()
    // Selecting a row far down a long tree is only useful if it can be seen.
    model.scrollToPath(wanted)
  }, [model, wanted])

  if (files.length === 0) {
    return <p className="px-3 py-2 text-sm text-ink-muted">No files changed</p>
  }

  // Fills the card so the tree's surface runs the height of the file diff
  // beside it. Height is named: the host is virtualised and sizes to its box,
  // and a box with no height draws no rows.
  return (
    <div className="min-h-0 flex-1">
      <FileTree model={model} style={{ ...PRIMER_TREE, height: "100%" }} />
    </div>
  )
}

/**
 * The diff for whichever file is being read.
 *
 * The renderer arrives on demand and is held for the life of the page, so the
 * first file waits and the rest do not. Every render replaces the last: one
 * file is on screen at a time, which is the whole point of a rail and a panel
 * rather than a scroll through everything.
 */
export type FileDiffPaneProps = {
  readonly file: ChangedFile
  /** The library's answer for a file: memory when it has it, GitHub when it does not. */
  readonly ask: (path: string) => Effect.Effect<Option.Option<FileDiff>>
  /** Prose files can be read as the document they become rather than as a diff. */
  readonly reading?: boolean
  /** How the reader has asked for diffs to be drawn. */
  readonly choices: DiffChoices
  /** What has been written about this file's lines, and not sent. */
  readonly drafts?: ReadonlyArray<Draft>
  readonly onSaveDraft?: (draft: Draft) => void
  readonly onDropDraft?: (key: string) => void
  /**
   * Every review thread on the pull request. The ones hung off a line of this
   * file are drawn against that line; the rest are the column's business.
   */
  readonly threads?: ReadonlyArray<ReviewThread>
  /** What can be done to a thread hung off a line here. See `ThreadView`. */
  readonly answering?: Answering
  /** Sends a remark to GitHub. Absent where nothing is wired up to. */
  readonly onPost?: (note: {
    /** Which half of the diff the lines were marked on, since the two are numbered apart. */
    readonly side: DiffSide
    readonly from: number
    readonly to: number
    readonly body: string
  }) => Effect.Effect<void, unknown>
  /** Whoever is writing, so the box is signed the way the remark will be. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  /** Who can be mentioned and what can be referred to, for a box on a line. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /**
   * A file pasted or dropped into a box here, put where GitHub keeps them.
   *
   * Handed down beside `suggest` and for the same reason: the box is the only thing that knows
   * a file arrived in it. See `attaching.ts`.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
}

/** Long enough that a cached answer or a quick one never flashes a message. */
const PATIENCE = 150

/** The row for lines being written about now, which is not a draft yet. */
const WRITING = "writing"

export const FileDiffPane = ({
  file,
  ask,
  reading = false,
  choices,
  drafts = [],
  onSaveDraft,
  onDropDraft,
  threads = [],
  answering,
  onPost,
  viewer,
  suggest,
  onUpload
}: FileDiffPaneProps) => {
  const host = useRef<HTMLDivElement | null>(null)
  const load = useRenderer()
  const [engine, setEngine] = useState<DiffEngine | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [picked, setPicked] = useState<Picked | null>(null)

  // GitHub serves the first few files' content with the page and holds the rest
  // back, so most files arrive as a summary and a promise. The library decides
  // whether that costs a request; this only has to ask.
  const [fetched, setFetched] = useState<Option.Option<FileDiff>>(Option.none())
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (Option.isSome(file.diff)) {
      setAsking(false)
      return
    }

    let live = true
    setFetched(Option.none())

    // The message waits: warmed files answer immediately, and a panel that
    // says it is fetching for one frame reads as a fault rather than as speed.
    const late = setTimeout(() => {
      if (live) setAsking(true)
    }, PATIENCE)

    const settle = () => {
      clearTimeout(late)
      if (live) setAsking(false)
    }

    const asking = Effect.runFork(
      ask(file.path).pipe(
        Effect.map((found) => {
          if (live) setFetched(found)
        }),
        Effect.ensuring(Effect.sync(settle))
      )
    )

    return () => {
      live = false
      clearTimeout(late)
      asking.interruptUnsafe()
    }
  }, [file.path, file.diff, ask])

  const whole = useMemo(
    (): ChangedFile => (Option.isSome(file.diff) ? file : { ...file, diff: fetched }),
    [file, fetched]
  )
  const patch = useMemo(() => toPatch(whole), [whole])

  /**
   * The patch as it will be drawn, which is the patch itself unless the reader
   * asked for spacing to be held back.
   *
   * Here rather than inside the renderer, and the reason is the line below it:
   * a file whose every change was spacing comes back empty, and the pane has to
   * say so. The renderer would have nothing to draw and no way to tell the
   * difference between that and a file GitHub sent no content for.
   */
  const shown = useMemo(
    () => (choices.hideWhitespace ? Option.map(patch, withoutWhitespace) : patch),
    [patch, choices.hideWhitespace]
  )
  const onlySpacing = Option.isSome(shown) && shown.value === ""

  // The file itself when it is being read as a document, or nothing. Unwrapped
  // rather than kept in an Option: this is a render dependency, and a fresh
  // wrapper on every render is a re-render of the diff on every render.
  const prose = reading ? Option.getOrUndefined(whole.diff) : undefined

  useEffect(() => {
    const loading = Effect.runFork(
      load.pipe(
        Effect.match({
          onSuccess: setEngine,
          onFailure: () => setUnavailable(true)
        })
      )
    )
    return () => loading.interruptUnsafe()
  }, [load])

  // The threads GitHub already holds against lines of this file. Read here
  // rather than passed in already filtered, so a caller cannot hand this file
  // another file's remarks.
  const hung = useMemo(() => threadsIn(threads, file.path), [threads, file.path])

  // Every note that should be hanging in the diff: what has been said about
  // this file, what has been written about it, and the lines being written
  // about right now.
  const notes = useMemo((): ReadonlyArray<NoteAt> => {
    const said = threadNotes(threads, file.path)
    const written = drafts.map((draft) => ({
      key: draftKey(draft),
      side: draft.side,
      line: draft.to
    }))
    if (picked === null) return [...said, ...written]

    // Marking lines that already carry a draft opens that draft rather than a
    // second box beneath it.
    const at = draftKey({ path: file.path, ...picked })
    if (written.some((note) => note.key === at)) return [...said, ...written]
    return [...said, ...written, { key: WRITING, side: picked.side, line: picked.to }]
  }, [threads, drafts, picked, file.path])

  // One element per note, made here and kept: the renderer asks for a row's
  // contents while it is drawing, which is no time to be creating React roots,
  // and a row rebuilt on every render is a comment box that loses what is in it
  // between keystrokes.
  const rows = useRef(new Map<string, HTMLElement>())
  const rowFor = (key: string): HTMLElement => {
    const held = rows.current.get(key)
    if (held !== undefined) return held
    const made = document.createElement("div")
    // Sticky, because the row it hangs in is as wide as the widest line in the
    // file and a comment box a screen and a half to the right is a comment box
    // nobody finds. Font and wrapping named again: the renderer's host sets
    // both to what code needs, and these rows inherit from it.
    made.className =
      "ghpro-note sticky left-0 w-[min(46rem,100%)] whitespace-normal border-y border-line bg-surface px-3 py-2 font-sans text-sm text-ink"
    rows.current.set(key, made)
    return made
  }
  for (const note of notes) rowFor(note.key)

  // The renderer is told about notes twice over: the set at the time it draws,
  // and every set after that. Neither belongs in the effect below — a comment
  // box appearing is not a reason to re-render the file it is in.
  const atRender = useRef(notes)
  atRender.current = notes
  const handle = useRef<DiffHandle | null>(null)

  useEffect(() => {
    const container = host.current
    const source = Option.getOrNull(shown)
    if (engine === null || container === null || source === null || source === "" || prose !== undefined)
      return

    const live = engine.renderDiff(container, {
      patch: source,
      path: file.path,
      theme: preferredTheme(),
      choices,
      // Off where a remark has nowhere to go, which takes the gutter's plus and
      // the drag across the line numbers with it. A commit read on its own page
      // is the case: GitHub's route for a review comment belongs to a pull
      // request, and this commit is not being read on one. Left on, both ways in
      // open a box whose Comment button cannot come up, over a draft that can be
      // saved and never sent.
      onPick: onPost === undefined ? undefined : setPicked,
      notes: atRender.current,
      fillNote: (key) => rows.current.get(key)
    })
    handle.current = live
    return () => {
      handle.current = null
      live.destroy()
    }
    // Every one of these is baked into the DOM the renderer writes, so a change
    // to any of them is a file drawn again from the patch.
  }, [engine, shown, file.path, prose, choices, onPost])

  useEffect(() => {
    handle.current?.showNotes(notes)
  }, [notes])

  // Moving to another file leaves the marked lines behind with it. The drafts
  // stay — they are held a level up, against their own file — but a range
  // marked in one file means nothing in the next.
  useEffect(() => {
    setPicked(null)
  }, [file.path])

  const letGo = () => {
    setPicked(null)
    handle.current?.unpick()
  }

  // No header of its own: which file this is, and by how much it changed, is
  // said by the heading the browser sticks directly above this.
  return (
    <div className="min-w-0 flex-1">
      {/* The rows live in the renderer's shadow DOM, under the lines they are
          about. React fills them from out here, so a comment box is a component
          like any other and keeps what is typed into it. */}
      {hung.map(({ thread }) => {
        const node = rows.current.get(threadKey(thread))
        return node === undefined
          ? null
          : createPortal(
              <ThreadInDiff thread={thread} answering={answering} />,
              node,
              threadKey(thread)
            )
      })}
      {notes.map((note) => {
        const node = rows.current.get(note.key)
        if (node === undefined) return null
        if (note.key.startsWith("thread:")) return null

        if (note.key === WRITING) {
          if (picked === null) return null
          return createPortal(
            <Note
              from={picked.from}
              to={picked.to}
              body=""
              viewer={viewer}
              onPost={
                onPost === undefined
                  ? undefined
                  : (body) =>
                      onPost({ ...picked, body }).pipe(Effect.tap(() => Effect.sync(letGo)))
              }
              onSave={(body) => {
                onSaveDraft?.({ path: file.path, ...picked, body })
                letGo()
              }}
              onDiscard={letGo}
              suggest={suggest}
              onUpload={onUpload}
            />,
            node,
            note.key
          )
        }

        const draft = drafts.find((held) => draftKey(held) === note.key)
        if (draft === undefined) return null
        return createPortal(
          <Note
            from={draft.from}
            to={draft.to}
            body={draft.body}
            viewer={viewer}
            onPost={
              onPost === undefined
                ? undefined
                : (body) =>
                    onPost({ side: draft.side, from: draft.from, to: draft.to, body }).pipe(
                      Effect.tap(() => Effect.sync(() => onDropDraft?.(note.key)))
                    )
            }
            onSave={(body) => onSaveDraft?.({ ...draft, body })}
            onDiscard={() => onDropDraft?.(note.key)}
            suggest={suggest}
            onUpload={onUpload}
          />,
          node,
          note.key
        )
      })}
      {prose !== undefined ? (
        <ProseDiff diff={prose} />
      ) : asking ? (
        <p className="px-4 py-2.5 text-sm text-ink-muted">Fetching this file…</p>
      ) : Option.isNone(patch) ? (
        <p className="px-4 py-2.5 text-sm text-ink-muted">
          GitHub has no content for this file. It is binary, or too large to diff in the page.
        </p>
      ) : onlySpacing ? (
        // Said, rather than drawn as a file with no marks in it. The reader
        // turned a setting on and this is the one case where it accounts for
        // everything, so the pane owes them the reason it is empty.
        <p className="px-4 py-2.5 text-sm text-ink-muted">
          Only the spacing changed in this file.
        </p>
      ) : unavailable ? (
        <p className="px-4 py-2.5 text-sm text-ink-muted">
          The diff renderer could not be loaded, so nothing is shown rather than half of it.
        </p>
      ) : (
        <div ref={host} />
      )}
    </div>
  )
}
