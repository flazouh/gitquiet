// First, and on its own line: the tree reads the custom element registry as it
// is evaluated, and in a content script there is none until this has run.
import "./customElements"

import { FileTree, useFileTree } from "@pierre/trees/react"
import type { GitStatus } from "@pierre/trees"
import { Effect, Option } from "effect"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { DiffHandle, Note as NoteAt, Picked } from "../diff/engine"
import { loadDiffEngine, type DiffEngine } from "../diff/loadEngine"
import { toPatch } from "../diff/toPatch"
import type { ChangedFile, ChangeType, FileDiff } from "../domain/PullRequest"
import type { DiffChoices, TreeChoices } from "../settings/apply"
import { draftKey, type Draft } from "./drafts"
import { Note } from "./Note"
import { ProseDiff } from "./ProseDiff"
import { rowMarks, shortCount, type RowMark } from "./rowMarks"
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
  // A real colour rather than `transparent`, and the same one the panel it sits
  // in is painted in: the tree fades a too-long name out with a gradient in its
  // own background, so a transparent one fades to nothing and a different one
  // draws a panel edge halfway down the rail.
  "--trees-bg-override": "var(--bgColor-default)",
  "--trees-bg-muted-override": "var(--bgColor-default)",
  "--trees-fg-override": "var(--fgColor-default)",
  "--trees-fg-muted-override": "var(--fgColor-muted)",
  "--trees-accent-override": "var(--bgColor-accent-emphasis)",
  "--trees-border-color-override": "transparent",
  "--trees-border-radius-override": "var(--borderRadius-medium, 6px)",

  // Tight, because every row of tree is a row of code not being read. Their
  // default spends thirty pixels of height and sixteen of margin on each file;
  // an editor's sidebar spends twenty-two and four, and nobody finds those
  // cramped.
  "--trees-padding-inline-override": "4px",
  "--trees-item-padding-x-override": "4px",
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
  choices
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

  return <FileTree model={model} style={PRIMER_TREE} />
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
  readonly ask: (path: string) => Promise<Option.Option<FileDiff>>
  /** Prose files can be read as the document they become rather than as a diff. */
  readonly reading?: boolean
  /** How the reader has asked for diffs to be drawn. */
  readonly choices: DiffChoices
  /** What has been written about this file's lines, and not sent. */
  readonly drafts?: ReadonlyArray<Draft>
  readonly onSaveDraft?: (draft: Draft) => void
  readonly onDropDraft?: (key: string) => void
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
  onDropDraft
}: FileDiffPaneProps) => {
  const host = useRef<HTMLDivElement | null>(null)
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

    ask(file.path).then((found) => {
      if (live) setFetched(found)
      settle()
    }, settle)

    return () => {
      live = false
      clearTimeout(late)
    }
  }, [file.path, file.diff, ask])

  const whole = useMemo(
    (): ChangedFile => (Option.isSome(file.diff) ? file : { ...file, diff: fetched }),
    [file, fetched]
  )
  const patch = useMemo(() => toPatch(whole), [whole])
  // The file itself when it is being read as a document, or nothing. Unwrapped
  // rather than kept in an Option: this is a render dependency, and a fresh
  // wrapper on every render is a re-render of the diff on every render.
  const prose = reading ? Option.getOrUndefined(whole.diff) : undefined

  useEffect(() => {
    let live = true
    void Effect.runPromise(loadDiffEngine).then(
      (loaded) => {
        if (live) setEngine(loaded)
      },
      () => {
        if (live) setUnavailable(true)
      }
    )
    return () => {
      live = false
    }
  }, [])

  // Every note that should be hanging in the diff: what has been written about
  // this file, and the lines being written about right now.
  const notes = useMemo((): ReadonlyArray<NoteAt> => {
    const written = drafts.map((draft) => ({
      key: draftKey(draft),
      side: draft.side,
      line: draft.to
    }))
    if (picked === null) return written

    // Marking lines that already carry a draft opens that draft rather than a
    // second box beneath it.
    const at = draftKey({ path: file.path, ...picked })
    if (written.some((note) => note.key === at)) return written
    return [...written, { key: WRITING, side: picked.side, line: picked.to }]
  }, [drafts, picked, file.path])

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
    const source = Option.getOrNull(patch)
    if (engine === null || container === null || source === null || prose !== undefined) return

    const live = engine.renderDiff(container, {
      patch: source,
      path: file.path,
      theme: preferredTheme(),
      choices,
      onPick: setPicked,
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
  }, [engine, patch, file.path, prose, choices])

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
      {notes.map((note) => {
        const node = rows.current.get(note.key)
        if (node === undefined) return null

        if (note.key === WRITING) {
          if (picked === null) return null
          return createPortal(
            <Note
              from={picked.from}
              to={picked.to}
              body=""
              onSave={(body) => {
                onSaveDraft?.({ path: file.path, ...picked, body })
                letGo()
              }}
              onDiscard={letGo}
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
            onSave={(body) => onSaveDraft?.({ ...draft, body })}
            onDiscard={() => onDropDraft?.(note.key)}
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
