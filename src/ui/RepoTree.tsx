// First, and on its own line: the tree reads the custom element registry as it
// is evaluated, and in a content script there is none until this has run.
import "./customElements"

import { FileTree, useFileTree } from "@pierre/trees/react"
import { Effect, Option } from "effect"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Entry } from "../domain/repoHome"
import {
  MATERIAL_BY_EXTENSION,
  MATERIAL_BY_FILE_NAME,
  MATERIAL_FILE,
  MATERIAL_SPRITE
} from "./materialIcons.generated"
import { Field } from "./Field"
import { ageOf } from "./when"

export type RepoTreeProps = {
  readonly entries: ReadonlyArray<Entry>
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly branch: string
  /** The commit the tree is read at. Their route refuses a branch name. */
  readonly head: string
  /** Every path in the repository. Absent until it lands, and absent if it fails. */
  readonly loadPaths?: (sha: string) => Effect.Effect<ReadonlyArray<string>, unknown>
  /** A file was pressed. The pane beside the tree shows it. */
  readonly onOpen: (path: string) => void
  /** The pointer is resting on a file. Read it now, so the press costs nothing. */
  readonly onNear?: (path: string) => void
  /** The file that pane is showing, so the row for it is marked as chosen. */
  readonly reading: string | null
}

/**
 * Reports the file the pointer settles on, and never the ones it passes over.
 *
 * Every move rather than every row entered, which is not a preference. The rows
 * live in the tree's shadow root, and an `over` event is retargeted on its way
 * out of one: to anything listening outside, the pointer entered
 * `file-tree-container` and stayed there. The browser then drops the ones that
 * would say nothing — a move from the third row to the fourth has the same
 * target as the move before it — so a handler on `pointerover` out here hears
 * the pointer arrive at the tree once and hears nothing about any row after
 * that. Measured on the page: one event on entering the card, none for the four
 * rows the pointer then crossed, and so not one file ever read early. `move` is
 * not retargeted away, and its composed path still has the row in it.
 *
 * One timer, and it belongs to a path rather than to an event. A pointer that
 * drifts a few pixels inside one row would otherwise reset its own timer for as
 * long as it kept drifting and never report the row it was sitting on.
 */
const useDwell = (onNear: ((path: string) => void) | undefined) => {
  const waiting = useRef<number | undefined>(undefined)
  const on = useRef<string | null>(null)

  useEffect(() => () => window.clearTimeout(waiting.current), [])

  return (event: PointerEvent): void => {
    if (onNear === undefined) return

    const path = fileUnder(event)
    if (path === on.current) return

    window.clearTimeout(waiting.current)
    on.current = path
    if (path === null) return

    waiting.current = window.setTimeout(() => onNear(path), DWELL)
  }
}

/**
 * The same palette the pull request rail wears, for the same reason.
 *
 * The tree ships its own colours and takes these overrides, so the reader's
 * theme is answered by naming our variables here and nothing else. The
 * file-type icon colours are left alone: a TypeScript file is blue in every
 * theme, which is what makes it readable at a glance.
 */
const OURS = {
  "--trees-bg-override": "var(--color-surface)",
  "--trees-bg-muted-override": "var(--color-surface)",
  "--trees-fg-override": "var(--color-ink)",
  "--trees-fg-muted-override": "var(--color-ink-muted)",
  "--trees-accent-override": "var(--color-accent-emphasis)",
  "--trees-border-color-override": "transparent",
  "--trees-border-radius-override": "6px",
  "--trees-padding-inline-override": "4px",
  "--trees-item-padding-x-override": "4px",
  "--trees-scrollbar-gutter-measured": "0px",
  "--trees-level-gap-override": "10px",
  "--trees-font-size-override": "12px"
} as React.CSSProperties

const ICONS = {
  set: "minimal" as const,
  spriteSheet: MATERIAL_SPRITE,
  remap: { "file-tree-icon-file": MATERIAL_FILE },
  byFileName: MATERIAL_BY_FILE_NAME,
  byFileExtension: MATERIAL_BY_EXTENSION
}

/**
 * The root directory, said in the shape the tree wants.
 *
 * A directory is a path with a slash on the end. That trailing slash is the
 * whole of how the tree is told a folder is a folder, and without it an empty
 * directory in the root of a repository is drawn as a file.
 */
export const asPaths = (entries: ReadonlyArray<Entry>): ReadonlyArray<string> =>
  entries.map((entry) => (entry.kind === "directory" ? `${entry.path}/` : entry.path))

/**
 * When each entry of the root last moved, by path.
 *
 * The date and not the message. Their own table carries both and this column is
 * four hundred pixels wide; of the two, the date is the one their readers
 * defend — one whitespace commit overwrites the headline of a large refactor,
 * and a date cannot lie in that way. The message is still one press away, on
 * the history this row's folder links to.
 */
/**
 * How long the pointer has to rest on a row before the file behind it is read.
 *
 * The same figure the shell uses for links on GitHub's own pages, and for the
 * same reason: a pointer crossing the list on its way somewhere else passes over
 * a dozen rows, and reading all twelve is twelve requests nobody asked for.
 */
const DWELL = 150

/**
 * The file a pointer event happened over, or nothing where it was not over one.
 *
 * Read from the composed path rather than from the target. The rows live in the
 * tree's shadow root, so by the time the event reaches a handler of ours its
 * target is the element holding that root and every row looks identical. The
 * composed path still has the row in it.
 *
 * A directory is not a file and there is nothing to read for it. The tree says
 * so with the word "folder" — `data-item-type` is `folder` or `file`, and
 * nothing else — and the trailing slash is checked as well because a path is
 * what the row is really keyed by.
 */
export const fileUnder = (event: PointerEvent): string | null => {
  for (const step of event.composedPath()) {
    if (!(step instanceof HTMLElement)) continue
    const { itemPath, itemType } = step.dataset
    if (itemPath === undefined) continue
    return itemType === "folder" || itemPath.endsWith("/") ? null : itemPath
  }
  return null
}

export const agesOf = (entries: ReadonlyArray<Entry>): ReadonlyMap<string, string> => {
  const ages = new Map<string, string>()
  for (const entry of entries) {
    const touch = Option.getOrUndefined(entry.touched)
    if (touch !== undefined) ages.set(entry.path, ageOf(touch.at))
  }
  return ages
}

/**
 * The repository, as a tree a reader can open.
 *
 * Drawn twice. The root directory is in the page payload and goes up
 * immediately; every path in the repository is six hundred kilobytes on a large
 * one, and folds in behind it when it lands. A reader who never opens a folder
 * never waits for any of it, and one who opens the first folder before it lands
 * finds it a moment later — which is the same bargain the commit column makes.
 *
 * A file opens in the pane beside the tree rather than on GitHub's page for it.
 * That is the whole reason this page claims the blob address: a reader following
 * a repository through four files should keep the tree, the README's place and
 * their scroll position, and lose all three on every press if the file were
 * theirs to show.
 */
export const RepoTree = ({
  entries,
  repo,
  branch,
  head,
  loadPaths,
  onOpen,
  onNear,
  reading
}: RepoTreeProps) => {
  const [whole, setWhole] = useState<ReadonlyArray<string> | undefined>(undefined)
  const [hunting, setHunting] = useState("")

  useEffect(() => {
    if (loadPaths === undefined) return
    let watching = true

    void Effect.runPromise(
      loadPaths(head).pipe(
        Effect.map((paths) => {
          if (watching) setWhole(paths)
        }),
        // The root is on the screen and is not wrong, only shallow. There is
        // nothing here worth an error message over.
        Effect.catch(() => Effect.void)
      )
    )

    return () => {
      watching = false
    }
  }, [loadPaths, head])

  const root = useMemo(() => asPaths(entries), [entries])

  // Through a ref because the tree reads its options once, when it is built.
  const at = useRef({ repo, branch, onOpen })
  at.current = { repo, branch, onOpen }

  // Same reason, and this one changes a second after the tree is built: the
  // commit column arrives behind the rows it decorates.
  const ages = useRef(agesOf(entries))
  ages.current = agesOf(entries)

  const options = useMemo(
    () => ({
      paths: root,
      icons: ICONS,
      // Their field is off and ours is above the tree instead. Theirs lives in
      // the tree's shadow root, which is what put a keystroke of ours in front
      // of GitHub's single-letter bindings: see the note in `Field.tsx`. Ours is
      // in the page, dressed like every other field in this interface, and drives
      // the same filter through `setSearch`.
      search: false,
      fileTreeSearchMode: "hide-non-matches" as const,
      stickyFolders: true,
      // A repository's root is not a set of changes, so there is no git lane
      // worth the width. The names take it.
      unsafeCSS:
        '[data-item-section="git"] { display: none; }' +
        '[data-item-section="decoration"] { flex: 0 0 auto; }',
      renderRowDecoration: ({ row }: { row: { path: string } }) => {
        // A directory's path ends in a slash here and nowhere else.
        const age = ages.current.get(row.path.replace(/\/$/, ""))
        return age === undefined ? null : { text: age }
      },
      onSelectionChange: (chosen: ReadonlyArray<string>) => {
        const [first] = chosen
        // A folder opens where it is. Sending the reader to GitHub's page for it
        // is the behaviour a tree exists to replace, and it would throw away
        // both the tree and the README beside it to show one directory.
        if (first === undefined || first.endsWith("/")) return

        at.current.onOpen(first)
      }
    }),
    [root]
  )

  const { model } = useFileTree(options)

  // Handed to the tree rather than fed back through its options, because the
  // tree reads those once, when it is built, and never again: the whole list
  // put back through them was a tree that stayed one directory deep. This is
  // the call that replaces what it holds while it is up.
  useEffect(() => {
    model.setSearch(hunting === "" ? null : hunting)
  }, [model, hunting])

  useEffect(() => {
    if (whole !== undefined) model.resetPaths(whole)
  }, [model, whole])

  /*
   * The row for the open file, marked.
   *
   * Also the row a reader arrived on by address rather than by press, which is
   * why it is not left to the tree's own click handling: a link into a file, or
   * the back button, has to light the same row that pressing it would.
   *
   * Runs again when the whole tree lands, because a file three folders down is
   * not a row the tree has until then. Selecting a row that is already selected
   * would call back into `onOpen` and push the address a second time, so the
   * ones already right are left alone.
   */
  useEffect(() => {
    for (const path of model.getSelectedPaths()) {
      if (path !== reading) model.getItem(path)?.deselect()
    }
    if (reading === null) return
    const row = model.getItem(reading)
    if (row !== null && !row.isSelected()) row.select()
  }, [model, reading, whole])

  const resting = useDwell(onNear)

  if (root.length === 0) return null

  return (
    <>
      <div className="shrink-0 px-2 pb-2">
        <Field value={hunting} onChange={setHunting} label="Find a file" art="search" room="tight" />
      </div>
      <div className="min-h-0 flex-1" onPointerMove={(event) => resting(event.nativeEvent)}>
        <FileTree model={model} style={OURS} />
      </div>
    </>
  )
}
