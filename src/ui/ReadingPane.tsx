import { Effect, Option } from "effect"
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react"
import { diffChoices } from "../domain/choices"
import type { Opened } from "../domain/repoHome"
import { wholeFile } from "../domain/wholeFile"
import { type DiffEngine, PAPER } from "../ports/Renderer"
import { PRESSABLE } from "./dress"
import { FileMark } from "./FileHeading"
import { Markdown } from "./Markdown"
import { useRenderer } from "./renderer"
import { useSettings } from "./useSettings"
import { type Way, Ways } from "./Ways"

export type ReadingProps = {
  readonly path: string
  /** The file, once it lands. Nothing while it is in the air. */
  readonly opened: Opened | undefined
  /** True where the read failed, which is a sentence rather than an empty pane. */
  readonly failed?: boolean
  /** Back to the README, which is what this pane replaced. */
  readonly onClose: () => void
}

/**
 * The sheet a file is read on, and the one thing here that is not the page.
 *
 * Raised rather than the surface the lists wear. Every pack puts raised above
 * the page; only some put surface above it, and in the pack this was built
 * against surface is four values *below* the canvas, which is a card nobody can
 * see. On the body rather than on the card, because a card's first child is a
 * label strip that `quiet.css` deliberately leaves unpainted.
 */
const SHEET = "bg-raised"

/** Whichever of the two themes the page is wearing, which the renderer asks for. */
const preferredTheme = (): "light" | "dark" =>
  document.documentElement.dataset.colorMode === "light" ? "light" : "dark"

/**
 * The file, drawn by the renderer every diff on every other screen is drawn by.
 *
 * A file nothing has happened to is a patch of all context, so this hands the
 * renderer one and gets the reader's theme, font, wrapping and line numbers for
 * nothing. See `src/domain/wholeFile.ts`.
 */
const Source = ({ opened }: { readonly opened: Opened }) => {
  const host = useRef<HTMLDivElement | null>(null)
  const load = useRenderer()
  const { settings } = useSettings()
  const [engine, setEngine] = useState<DiffEngine | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const patch = useMemo(() => wholeFile(opened.path, opened.lines), [opened])
  const choices = useMemo(() => diffChoices(settings.diff), [settings.diff])

  useEffect(() => {
    const loading = Effect.runFork(
      load.pipe(Effect.match({ onSuccess: setEngine, onFailure: () => setUnavailable(true) }))
    )
    return () => loading.interruptUnsafe()
  }, [load])

  useEffect(() => {
    const container = host.current
    const source = Option.getOrNull(patch)
    if (engine === null || container === null || source === null) return

    const live = engine.renderDiff(container, {
      patch: source,
      path: opened.path,
      theme: preferredTheme(),
      // Unified whatever the reader chose for diffs. Split is two columns of the
      // same file here, which is the setting doing the opposite of what it is
      // for: there is no before and after in a file nothing happened to.
      choices: { ...choices, layout: "unified" },
      notes: [],
      fillNote: () => undefined
    })
    return () => live.destroy()
  }, [engine, patch, opened.path, choices])

  if (Option.isNone(patch)) {
    return <p className="px-4 py-3 text-sm text-ink-muted">This file is empty.</p>
  }

  if (unavailable) {
    return (
      <p className="px-4 py-3 text-sm text-ink-muted">
        The renderer could not be loaded, so nothing is shown rather than half of it.
      </p>
    )
  }

  /*
   * The renderer paints its own background, so it is told which one.
   *
   * Everywhere else it prints on the page's canvas and there that is right: a
   * diff is the whole screen. Here the file is one card of three, so it prints
   * on the sheet and the page shows around it. The variable is the only way in:
   * the renderer writes its colours onto its own host as inline styles, which no
   * container can overrule, but it reads this one from whatever is above it.
   */
  return <div ref={host} style={{ [PAPER]: "var(--color-raised)" } as CSSProperties} />
}

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
export const Reading = ({ path, opened, failed = false, onClose }: ReadingProps) => {
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
      className="min-w-0 overflow-hidden rounded-lg border border-line lg:col-start-1 lg:row-start-2"
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to the README"
          className={`px-2 py-0.5 text-xs text-ink-muted hover:bg-active ${PRESSABLE}`}
        >
          ← README
        </button>
        {/* The same chip the diff prints over a file, because the tree beside
            this pane is the same tree the diff has beside it and the two are
            showing the same file. Material always, which is what that tree is
            drawn with here: the icon in the row and the icon in the heading are
            one file said twice. */}
        <FileMark path={path} icons="material" />
        {canRender ? (
          <span className="ml-auto shrink-0">
            <Ways ways={WAYS} on={way} onPick={setWay} label="How to read this file" />
          </span>
        ) : null}
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
            <Markdown markdown={source} />
          </div>
        ) : (
          <Source opened={opened} />
        )}
      </div>
    </section>
  )
}
