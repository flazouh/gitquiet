// First, and on its own line: the tree reads the custom element registry as it
// is evaluated, and in a content script there is none until this has run.
import "./customElements"

import { FileTree, useFileTree, useFileTreeSelection } from "@pierre/trees/react"
import type { GitStatus } from "@pierre/trees"
import { Effect, Option } from "effect"
import { useEffect, useMemo, useRef, useState } from "react"
import { loadDiffEngine, type DiffEngine } from "../diff/loadEngine"
import { toPatch } from "../diff/toPatch"
import type { ChangedFile, ChangeType } from "../domain/PullRequest"

export type FilesViewProps = {
  readonly files: ReadonlyArray<ChangedFile>
}

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
  // A real colour rather than `transparent`: the tree fades a too-long name out
  // with a gradient in its own background, and a transparent one fades to
  // nothing, which reads as the name running into its extension.
  "--trees-bg-override": "var(--bgColor-default)",
  "--trees-bg-muted-override": "var(--bgColor-muted)",
  "--trees-fg-override": "var(--fgColor-default)",
  "--trees-fg-muted-override": "var(--fgColor-muted)",
  "--trees-accent-override": "var(--bgColor-accent-emphasis)",
  "--trees-border-color-override": "var(--borderColor-default)",
  "--trees-border-radius-override": "var(--borderRadius-medium, 6px)"
} as React.CSSProperties

/** Whichever of its two themes GitHub is currently wearing. */
const preferredTheme = (): "light" | "dark" => {
  const mode = document.documentElement.dataset.colorMode
  if (mode === "light" || mode === "dark") return mode
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * The diff for whichever file the tree has selected.
 *
 * The renderer arrives on demand and is held for the life of the page, so the
 * first file waits and the rest do not. Every render replaces the last: one
 * file is on screen at a time, which is the whole point of a master and a
 * detail rather than a scroll through everything.
 */
const Diff = ({ file }: { readonly file: ChangedFile }) => {
  const host = useRef<HTMLDivElement | null>(null)
  const [engine, setEngine] = useState<DiffEngine | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const patch = useMemo(() => toPatch(file), [file])

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

  useEffect(() => {
    const container = host.current
    const source = Option.getOrNull(patch)
    if (engine === null || container === null || source === null) return

    const handle = engine.renderDiff(container, {
      patch: source,
      path: file.path,
      theme: preferredTheme(),
      // One column: the detail pane is half a page wide, and side-by-side in
      // half a page is two columns of code cut off mid-line.
      layout: "unified"
    })
    return () => {
      handle.destroy()
    }
  }, [engine, patch, file.path])

  // The path stays put whatever the body turns out to be. A file with nothing
  // to show still has to say which file it is, or the panel reads as broken
  // rather than as empty.
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
        <span className="shrink-0 text-xs tabular-nums">
          <span className="text-pass">+{file.linesAdded}</span>{" "}
          <span className="text-fail">−{file.linesDeleted}</span>
        </span>
      </div>
      {Option.isNone(patch) ? (
        <p className="px-4 py-2.5 text-sm text-ink-muted">
          GitHub sent no content for this file. It is binary, or too large to diff in the page.
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

export const FilesView = ({ files }: FilesViewProps) => {
  const paths = useMemo(() => files.map((file) => file.path), [files])
  const gitStatus = useMemo(
    () => files.map((file) => ({ path: file.path, status: gitStatusOf(file.changeType) })),
    [files]
  )

  // Every field held still across renders. The tree reapplies its options when
  // they change, and an `initialSelectedPaths` rebuilt each render is a change:
  // choosing a file re-rendered this component, which re-seeded the selection
  // back to the first file, which looked exactly like clicks doing nothing.
  const options = useMemo(
    () => ({
      paths,
      gitStatus,
      initialExpansion: "open" as const,
      initialSelectedPaths: paths.slice(0, 1),
      flattenEmptyDirectories: true
    }),
    [paths, gitStatus]
  )

  const { model } = useFileTree(options)
  const selected = useFileTreeSelection(model)

  const chosen = selected.find((path) => paths.includes(path))
  const file = files.find((candidate) => candidate.path === chosen) ?? files[0]

  if (files.length === 0) {
    return <p className="px-4 py-2.5 text-sm text-ink-muted">No files changed</p>
  }

  return (
    // A tree that scrolls on its own beside a diff that scrolls on its own:
    // moving down the file list should not move the code, and reading to the
    // bottom of a long file should not lose the list.
    <div className="Box flex min-h-0 items-stretch" style={{ height: "min(72vh, 900px)" }}>
      <div className="w-72 shrink-0 overflow-auto border-r border-line py-1">
        <FileTree model={model} style={PRIMER_TREE} />
      </div>
      <div className="min-w-0 flex-1 overflow-auto">
        {file === undefined ? null : <Diff file={file} />}
      </div>
    </div>
  )
}
