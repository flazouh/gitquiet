import { useEffect } from "react"
import type { ChangedFile } from "../domain/PullRequest"
import { useArt } from "./art"
import { folderOf, materialIcon, nameOf } from "./fileIcon"
import { MATERIAL_SPRITE } from "./materialIcons.generated"

/** The one copy of the icon sheet the page needs, wherever it is referenced. */
const SPRITE_ID = "gitquiet-material-sprite"

/**
 * Puts the Material symbols on the page, once.
 *
 * The tree has its own copy, but it keeps it inside its shadow root where a
 * `use` out here cannot reach it — a reference only resolves within the tree it
 * is written in. So the heading brings its own, and brings it once: sixty
 * symbols parsed per open file would be sixty symbols parsed per click.
 */
export const mountSprite = (target: Document): void => {
  if (target.getElementById(SPRITE_ID) !== null) return

  const holder = target.createElement("div")
  holder.id = SPRITE_ID
  holder.setAttribute("aria-hidden", "true")
  holder.style.display = "none"
  holder.innerHTML = MATERIAL_SPRITE
  // Not `body`, which GitHub's streamed page does not always have by the time
  // this runs — and a throw here happens inside React's commit, which unmounts
  // the whole interface and leaves the reader an empty column. The symbols only
  // have to be in the document for a `use` to resolve against them; where in it
  // is nobody's business, since the holder is hidden either way.
  ;(target.body ?? target.documentElement).append(holder)
}

/**
 * The word for what happened, for the five cases that are not just an edit.
 *
 * Exported because the merge card names files too, on a conflict, and a file
 * called "renamed" over its diff and nothing over the same path on the card
 * would be two answers to one question.
 */
export const changeWord = (file: ChangedFile): string | null =>
  file.changeType === "modified" || file.changeType === "changed" ? null : file.changeType

export type FileMarkProps = {
  readonly path: string
  /** The reader's choice of icons, which is the tree's choice: the two agree. */
  readonly icons: "material" | "plain"
}

/**
 * A file's icon and its name, as one thing to put at the top of that file.
 *
 * Its own component because two screens want the same chip and there is only one
 * right answer to what it looks like: the repository's reading pane sits beside
 * the same tree the diff's file list is, showing the same file, and a name drawn
 * plainly in one place and dressed in the other reads as two different products.
 */
export const FileMark = ({ path, icons }: FileMarkProps) => {
  const art = useArt()
  const File = art.file

  useEffect(() => {
    if (icons === "material") mountSprite(document)
  }, [icons])

  const folder = folderOf(path)
  const icon = materialIcon(path)

  return (
    <span className="flex min-w-0 items-center gap-2">
      {icons === "material" ? (
        <svg
          aria-hidden
          viewBox={icon.viewBox}
          className="h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
        >
          <use href={`#${icon.name}`} />
        </svg>
      ) : (
        <File size={16} className="shrink-0 text-ink-muted" />
      )}
      {/* Two boxes rather than one line, because which of them loses is the
          whole point. `truncate` clips the end of what it is put on, so putting
          it over the pair threw away the name and kept the folders — which in a
          column four hundred pixels wide made thirty different files read as
          thirty copies of "features/code-review/skills/review-pr/scripts/pro…".
          The folders shrink and ellipsise; the name never shrinks. */}
      <span className="flex min-w-0 font-mono text-xs" title={path}>
        {folder === "" ? null : <span className="truncate text-ink-muted">{folder}</span>}
        <span className="shrink-0 font-semibold text-ink">{nameOf(path)}</span>
      </span>
    </span>
  )
}

export type FileHeadingProps = {
  readonly file: ChangedFile
  /** The reader's choice of icons, which is the tree's choice: the two agree. */
  readonly icons: "material" | "plain"
}

/**
 * Which file is open, said above the file.
 *
 * The tree lights up the row it is showing, but the row is off to the left, is
 * a few characters wide by the time it has been indented five levels, and is
 * out of sight entirely once a long diff has been scrolled. The answer to
 * "what am I looking at" belongs at the top of the thing being looked at — with
 * the folders muted, because they are context, and the name in the reader's
 * own weight, because that is the part being answered.
 */
export const FileHeading = ({ file, icons }: FileHeadingProps) => {
  const change = changeWord(file)

  return (
    <div
      aria-label="Open file"
      // Sticky, and opaque: a file eight hundred lines long is read by
      // scrolling, and a name that leaves the screen on the first flick is a
      // name that was only ever useful for the first screenful.
      className="flex items-center gap-2 border-b border-line bg-canvas px-3 py-1.5"
    >
      <FileMark path={file.path} icons={icons} />
      {change === null ? null : (
        <span className="shrink-0 rounded-full bg-surface px-1.5 text-xs text-ink-muted">
          {change}
        </span>
      )}
      {/* This file's own counts. The band above holds the whole pull request's,
          which is the one number that says nothing about the file on screen. */}
      <span className="ml-auto shrink-0 text-xs tabular-nums">
        <span className="text-pass">+{file.linesAdded}</span>{" "}
        <span className="text-fail">−{file.linesDeleted}</span>
      </span>
    </div>
  )
}
