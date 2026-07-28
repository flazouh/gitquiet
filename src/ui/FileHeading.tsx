import { FileIcon } from "@primer/octicons-react"
import { useEffect } from "react"
import type { ChangedFile } from "../domain/PullRequest"
import { folderOf, materialIcon, nameOf } from "./fileIcon"
import { MATERIAL_SPRITE } from "./materialIcons.generated"

/** The one copy of the icon sheet the page needs, wherever it is referenced. */
const SPRITE_ID = "githubpro-material-sprite"

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

/** The word for what happened, for the five cases that are not just an edit. */
const changeWord = (file: ChangedFile): string | null =>
  file.changeType === "modified" || file.changeType === "changed" ? null : file.changeType

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
  useEffect(() => {
    if (icons === "material") mountSprite(document)
  }, [icons])

  const folder = folderOf(file.path)
  const icon = materialIcon(file.path)
  const change = changeWord(file)

  return (
    <div
      aria-label="Open file"
      // Sticky, and opaque: a file eight hundred lines long is read by
      // scrolling, and a name that leaves the screen on the first flick is a
      // name that was only ever useful for the first screenful.
      className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-canvas px-3 py-1.5"
    >
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
        <FileIcon size={16} className="shrink-0 text-ink-muted" />
      )}
      {/* One line, truncated from the left of the name rather than the right:
          the folders are what to lose when there is no room, and the name is
          what there is always room for. */}
      <span className="min-w-0 truncate font-mono text-xs" title={file.path}>
        {folder === "" ? null : <span className="text-ink-muted">{folder}</span>}
        <span className="font-semibold text-ink">{nameOf(file.path)}</span>
      </span>
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
