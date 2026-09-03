import { Option } from "effect"
import { useEffect, useState } from "react"
import type { Opened } from "../domain/repoHome"
import { CARD } from "./dress"
import { FileAlso } from "./FileAlso"
import { FileMark } from "./FileHeading"
import { Markdown } from "./Markdown"
import { type Way, Ways } from "./Ways"
import { WholeFile } from "./WholeFile"

export type ReadingProps = {
  readonly path: string
  /** The file, once it lands. Nothing while it is in the air. */
  readonly opened: Opened | undefined
  /** True where the read failed, which is a sentence rather than an empty pane. */
  readonly failed?: boolean
  /** Whose repository this file is, so a picture written beside it can be found. */
  readonly repo?: { readonly owner: string; readonly repo: string }
  /** Which branch it was read from, for the same reason. */
  readonly branch?: string
  /**
   * The head this page was read from, so the permalink in the menu is a sha
   * rather than a branch that will move.
   */
  readonly head?: string
}

/**
 * The sheet a file is read on, and the one thing here that is not the page.
 *
 * Raised rather than the surface the lists wear. Every pack puts raised above
 * the page; only some put surface above it, and in the pack this was built
 * against surface is four values *below* the canvas, which is a card nobody can
 * see. On the body rather than on the card, so the heading strip stays the
 * card's own fill.
 */
const SHEET = "bg-raised"

/** The two ways to read the same markdown file, where GitHub rendered it. */
const WAYS = [
  { name: "rendered", said: "Rendered", art: "eye" },
  { name: "source", said: "Source", art: "code" }
] as const satisfies ReadonlyArray<Way<"rendered" | "source">>

/**
 * One file, in the pane the README was in.
 *
 * The README is not a special document on this page; it is the one shown when
 * no file is asked for. So a file takes the same pane rather than a third column
 * — 1256 pixels is a laptop at full screen, and three columns on one is two
 * columns of code and a gutter — and the tree beside it stays exactly where it
 * was, which is the whole point of opening a file here rather than on their page.
 *
 * A markdown file opens rendered, because that is what a reader wants from a
 * document, and the source is one press away for the reader who wants what it
 * says rather than what it looks like.
 */
export const Reading = ({
  path,
  opened,
  failed = false,
  repo,
  branch,
  head
}: ReadingProps) => {
  const [way, setWay] = useState<"rendered" | "source">("rendered")

  // Back to rendered on every new file. The choice is about the document being
  // read, not a mode the pane is left in: a reader who looked at one README's
  // source has not asked for every file after it to open the same way.
  useEffect(() => {
    setWay("rendered")
  }, [path])

  const canRender = opened !== undefined && Option.isSome(opened.rendered)
  const source = opened === undefined ? "" : opened.lines.join("\n")
  const showing = canRender && way === "rendered"

  return (
    <section
      aria-label="File"
      className={`min-w-0 overflow-hidden lg:col-start-2 lg:row-start-2 ${CARD}`}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* The same chip the diff prints over a file, because the tree beside
            this pane is the same tree the diff has beside it and the two are
            showing the same file. Material always, which is what that tree is
            drawn with here: the icon in the row and the icon in the heading are
            one file said twice. */}
        <FileMark path={path} icons="material" />
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {canRender ? (
            <Ways ways={WAYS} on={way} onPick={setWay} label="How to read this file" />
          ) : null}
          {repo === undefined || branch === undefined ? null : (
            <FileAlso
              owner={repo.owner}
              repo={repo.repo}
              branch={branch}
              path={path}
              head={head}
              lines={opened?.lines}
            />
          )}
        </span>
      </div>
      <div className={SHEET}>
        {failed ? (
          <p className="px-4 py-3 text-sm text-ink-muted">
            This file could not be read. GitHub may have moved it, or it is too large for their
            page.
          </p>
        ) : opened === undefined ? (
          <p className="px-4 py-3 text-sm text-ink-muted">Reading this file…</p>
        ) : showing ? (
          <div className="px-6 py-5">
            <Markdown
              markdown={source}
              owner={repo?.owner}
              repo={repo?.repo}
              branch={branch}
              at={path}
            />
          </div>
        ) : (
          <WholeFile path={opened.path} lines={opened.lines} />
        )}
      </div>
    </section>
  )
}
