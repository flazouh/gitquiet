import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Effect, Option } from "effect"
import type { AcrossUse, Use, Writing } from "../ports/Ledger"
import { FLOAT } from "./dress"
import { partOfFile } from "../domain/wholeFile"
import { diffChoices } from "../domain/choices"
import type { DiffEngine } from "../ports/Renderer"
import { PAPER } from "../ports/Renderer"
import { onward } from "@/observability/report"
import { useLedger } from "./ledger"
import { useRenderer } from "./renderer"
import { drawnIn } from "./showLine"
import { usePaintedTheme } from "./Theme"
import { useSettings } from "./useSettings"

/**
 * Everywhere in this file that means the same Writing.
 *
 * Counted by name and not by word: `shape` inside a function that declares its
 * own `shape` is a different thing with the same spelling, and a list that held
 * it would be a list of a word rather than of a name. `src/ledger/writings.ts`
 * resolves every one of them; this draws what comes back.
 *
 * This file first, because it is the question asked most and the only one that
 * can be answered exactly: the reader's own file is parsed, and every mention in
 * it is resolved by scope.
 *
 * Then the repository, where a Ledger has read one. That half cannot be exact
 * without parsing every file at the moment of asking, so it is not pretended to
 * be: a file that states it borrowed this name from this file is **Sure**, a
 * file that merely holds the same word is **Likely** and says so, and a file
 * that binds its own name of that spelling is left out — two things with one
 * spelling are two things.
 */
export type UsesPanelProps = {
  readonly writing: Writing
  readonly reading: { readonly path: string; readonly text: string }
  /**
   * The file the Writing is in, where it is not the one being read.
   *
   * A name this file borrowed is written somewhere else, and this file's own
   * mentions of it are then Uses like any other file's — so the exact in-file
   * list is skipped and the repository answers for all of them, this one
   * included. Resolving a Writing from another file against this file's text
   * would match nothing at all, which would read as "used nowhere".
   */
  readonly where?: string
  /** Puts one on the screen. The pane scrolls; the address does not change. */
  readonly onGo: (line: number) => void
  readonly onClose: () => void
  /**
   * Opens another file at a line, where the screen can.
   *
   * Separate from {@link UsesPanelProps.across} on purpose: going to a file is
   * not the same capability as asking a Ledger about a repository, and a screen
   * that can do the first and not the second was a screen where the row saying
   * where a name is written did nothing at all.
   */
  readonly onOpen?: (path: string, line: number) => void
  /**
   * Which repository to ask about the rest of the Uses, at which commit.
   *
   * Absent where the screen does not know, and then this is the file's Uses and
   * says so — rather than an empty list of the repository's, which a reader
   * deciding whether a name is safe to change would read as an answer.
   */
  readonly across?: {
    readonly repo: { readonly owner: string; readonly repo: string }
    readonly sha: string
  }
}

/** How many lines of context the preview shows either side of a row. */
const AROUND = 8

/**
 * How the panel was last left, kept for the next time it opens.
 *
 * On the module rather than in settings: the settings here are knobs with named
 * choices, and a ratio is neither. This is the same scope VS Code gives it —
 * a `layoutData` object on the widget, seven parts to three and eighteen lines
 * tall until somebody drags it otherwise — and like theirs it is remembered for
 * the rest of the visit rather than for ever. A reader who makes the list wider
 * to read a long path does not want it narrow again at the next name.
 */
const LAYOUT = { ratio: 0.7, tall: 352 }
/** Neither half may be dragged smaller than this, in pixels. */
const LEAST = { preview: 224, listed: 144 }
/** The panel itself, which is a reader's window and not a reader's file. */
const SHORTEST = 160
const TALLEST = 640

/**
 * One line of the answer: where the name is written, a use of it in this file,
 * or a use somewhere else in the repository.
 */
type Row = {
  readonly kind: "written" | "use" | "beyond"
  readonly line: number
  /** The columns the name itself occupies, one-based, for marking it. */
  readonly from?: number
  readonly to?: number
  /** What the row reads as: the signature, the line of code, or the path. */
  readonly said: string
  /** The file it is in, where that is not the file being read. */
  readonly path?: string
  /** Whether the repository stated this use or merely holds the word. */
  readonly sure?: boolean
}

export const UsesPanel = ({
  writing,
  reading,
  onGo,
  onOpen,
  onClose,
  across,
  where
}: UsesPanelProps) => {
  /** Whether the Writing is in the file being read, which decides what can be exact. */
  const here = where === undefined || where === reading.path
  const ledger = useLedger()
  // Whether the reader asked for a compiler to answer. Off, and this is the
  // tier that reads shapes — fast, every language, honest about its guesses.
  const { settings } = useSettings()
  const exact = settings.diff.exact === "on"
  /** Which row the preview is showing, as an index into the rows below. */
  const [picked, setPicked] = useState(0)
  /** The split, and the height, as the reader last left them. */
  const [ratio, setRatio] = useState(LAYOUT.ratio)
  const [tall, setTall] = useState(LAYOUT.tall)
  const body = useRef<HTMLDivElement | null>(null)
  /** Where the preview is drawn, by the renderer that drew the file above it. */
  const shownIn = useRef<HTMLDivElement | null>(null)
  const load = useRenderer()
  const painted = usePaintedTheme()
  const [engine, setEngine] = useState<DiffEngine | null>(null)
  /** Drawn the way the file above it is drawn, which is what the reader chose. */
  const choices = useMemo(() => diffChoices(settings.diff), [settings.diff])
  /** The rows, so the arrow keys can move between them. */
  const listed = useRef<Array<HTMLButtonElement | null>>([])
  const [uses, setUses] = useState<ReadonlyArray<Use> | null>(null)
  const [elsewhere, setElsewhere] = useState<{
    readonly uses: ReadonlyArray<AcrossUse>
    readonly ready: boolean
    readonly exact?: boolean
  } | null>(null)
  const lines = reading.text.split("\n")
  /**
   * The repository's Uses, minus the ones in the file already listed above.
   *
   * The Ledger answers about every file including this one, and this one is
   * answered exactly a few lines up. Listing both would be the same lines twice,
   * once precisely and once by a rule that cannot see scopes.
   */
  const beyond = (elsewhere?.uses ?? []).filter((use) => !here || use.path !== reading.path)

  /** The uses worth a row, which is every one that is not the writing itself. */
  const elsewhereInFile =
    uses === null ? null : uses.filter((use) => use.line !== writing.line || use.from !== writing.from)

  /*
   * Escape puts it away, which is what Escape means everywhere else here.
   *
   * On the document and in the capture phase: this row lives inside the
   * renderer's shadow root, and a key pressed over it is reported against
   * whatever the event was retargeted to.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [onClose])

  /*
   * The first row takes the focus, which is what opens this to a keyboard.
   *
   * Without it the answer appeared and the focus stayed wherever the reader had
   * left it — the list could be tabbed into eventually, from somewhere else on
   * a page that is mostly a file, and the arrow keys did nothing at all. A
   * panel a reader can open and cannot move through is a panel for one kind of
   * reader.
   */
  useEffect(() => {
    /*
     * Waited for, because the row is not on the page when this first renders.
     *
     * The panel is drawn into an element the renderer has not been handed yet:
     * React fills the row, an effect tells the renderer about it, and the
     * renderer puts it under the line. Focusing in between focuses a node
     * attached to nothing, which does nothing and reports nothing — the panel
     * simply opened with the focus still wherever the reader had left it.
     */
    let frame = 0
    let tries = 0
    const reach = () => {
      const first = listed.current[0]
      if (first?.isConnected === true) {
        first.focus()
        return
      }
      // Bounded: a row that never arrives is a row nobody can focus, and a
      // loop asking for ever costs a frame a frame for the life of the pane.
      if (tries++ > 30) return
      frame = requestAnimationFrame(reach)
    }
    frame = requestAnimationFrame(reach)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!here) {
      setUses([])
      return
    }

    const asking = Effect.runFork(
      ledger.usesIn(reading, writing).pipe(
        Effect.map(setUses),
        Effect.catch(() => Effect.sync(() => setUses([])))
      )
    )
    return () => asking.interruptUnsafe()
  }, [here, ledger, reading, writing])

  /*
   * The rest of the repository, where there is a Ledger that has read it.
   *
   * Warmed first: a reader who presses this without having opened Go to Name is
   * asking the repository a question for the first time, and being told "no
   * Ledger" would be being told about a mechanism rather than answered.
   */
  useEffect(() => {
    if (across === undefined) return

    const asking = Effect.runFork(
      ledger.warm(across.repo, across.sha, exact).pipe(
        Effect.flatMap(() =>
          ledger.usesAcross(across.repo, across.sha, {
            name: writing.name,
            path: where ?? reading.path,
            line: writing.line,
            column: writing.from - 1
          })
        ),
        Effect.map(setElsewhere),
        Effect.catch(() => Effect.sync(() => setElsewhere({ uses: [], ready: false })))
      )
    )
    return () => asking.interruptUnsafe()
  }, [ledger, across, exact, reading.path, where, writing])

  /**
   * The rows, in the order an editor lists them: where it is written, then
   * every use in this file, then the rest of the repository.
   *
   * One list rather than three, because the preview beside it shows one row at
   * a time and "which row is showing" has to mean something across all of them.
   */
  const rows: ReadonlyArray<Row> = [
    {
      kind: "written",
      line: writing.line,
      from: writing.from,
      to: writing.to,
      said: writing.signature,
      path: where
    },
    ...(elsewhereInFile ?? []).map((use) => ({
      kind: "use" as const,
      line: use.line,
      from: use.from,
      to: use.to,
      said: (lines[use.line - 1] ?? "").trim()
    })),
    ...beyond.map((use) => ({
      kind: "beyond" as const,
      line: use.line,
      said: use.path,
      path: use.path,
      sure: use.sure
    }))
  ]

  const showing = rows[Math.min(picked, rows.length - 1)] ?? rows[0]

  /**
   * The lines behind whichever row is showing.
   *
   * Only for this file: a use in another file is a file this pane has not read,
   * and inventing a preview of it would be inventing code. Those rows say where
   * they are and open when pressed, which is what the tree in an editor does
   * with a file it has not loaded either.
   */
  const previewFrom = showing === undefined ? 1 : Math.max(1, showing.line - AROUND)
  const patch =
    showing === undefined || showing.path !== undefined
      ? Option.none<string>()
      : partOfFile(
          reading.path,
          lines.slice(previewFrom - 1, showing.line - 1 + AROUND + 1),
          previewFrom
        )

  /**
   * A drag, started on a four-pixel strip and finished wherever it likes.
   *
   * Pointer capture rather than listeners on the document: the pointer leaves
   * the strip on the first move of any drag worth making, and a drag that stops
   * when the pointer leaves the thing that started it is a drag nobody can
   * finish.
   */
  const dragging =
    (onMove: (at: PointerEvent) => void) =>
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const strip = event.currentTarget
      strip.setPointerCapture(event.pointerId)
      strip.onpointermove = onMove
      strip.onpointerup = () => {
        strip.releasePointerCapture(event.pointerId)
        strip.onpointermove = null
        strip.onpointerup = null
      }
    }

  /** The split between the code and the list, kept for the next name. */
  const dragSash = dragging((at) => {
    const box = body.current?.getBoundingClientRect()
    if (box === undefined) return
    const wide = Math.min(Math.max(at.clientX - box.left, LEAST.preview), box.width - LEAST.listed)
    LAYOUT.ratio = wide / box.width
    setRatio(LAYOUT.ratio)
  })

  /** How much of the file this covers, which is a question this cannot see. */
  const dragEdge = dragging((at) => {
    const box = body.current?.getBoundingClientRect()
    if (box === undefined) return
    LAYOUT.tall = Math.min(Math.max(at.clientY - box.top, SHORTEST), TALLEST)
    setTall(LAYOUT.tall)
  })

  useEffect(() => {
    const loading = Effect.runFork(load.pipe(Effect.match({ onSuccess: setEngine, onFailure: onward })))
    return () => loading.interruptUnsafe()
  }, [load])

  /*
   * The preview, drawn by the renderer rather than printed as text.
   *
   * There is no second renderer for code here and there should not be one — the
   * one this extension ships knows the reader's theme, their font, their
   * colours and how a line number is drawn, and seventeen lines printed beside
   * a file it drew would agree with none of it. A run of lines is a patch of
   * all context, so that is what it is handed. See `src/domain/wholeFile.ts`,
   * which makes the same argument one size up.
   *
   * Then the name itself is marked, by hand, in the row that was drawn. The
   * renderer's own `mark` cannot: it marks the Name it last reported, which is
   * the one under the pointer in the file above, and this is a different
   * element in a different drawing. Walking the spans to find the column is
   * three lines and does not ask the renderer for anything it does not offer.
   */
  useEffect(() => {
    const container = shownIn.current
    const source = Option.getOrNull(patch)
    if (engine === null || container === null || source === null || showing === undefined) return

    const live = engine.renderDiff(container, {
      patch: source,
      path: reading.path,
      theme: painted.scheme,
      pack: painted.pack,
      // Unified, whatever the reader chose: there is no before and after in a
      // run of lines nothing has happened to.
      choices: { ...choices, layout: "unified" },
      notes: []
    })

    const marking = requestAnimationFrame(() => {
      /*
       * The separator the renderer draws above a hunk that does not start at
       * line one, taken away.
       *
       * It reads "119 unmodified lines" and it is an offer to see them. This
       * preview is seventeen lines handed over as a whole file and there is
       * nothing behind it to reveal, so the offer cannot be kept — and an offer
       * this interface cannot keep is the thing it takes most care not to make.
       * The same argument as the gutter's plus in `engine.ts`, one panel down.
       */
      for (const row of drawnIn(container)?.querySelectorAll("div") ?? []) {
        if (!(row instanceof HTMLElement)) continue
        // Exactly the separator and nothing containing it: the first try
        // matched any box whose text mentioned those words, which included the
        // one holding the gutter, and the preview lost its line numbers.
        if (/^\d+ unmodified lines?$/.test((row.textContent ?? "").trim())) {
          row.style.display = "none"
        }
      }

      if (showing.from === undefined) return
      const row = drawnIn(container)?.querySelector(`[data-line="${showing.line}"]`)
      if (!(row instanceof HTMLElement)) return

      let at = 1
      for (const span of row.querySelectorAll("span")) {
        if (span.childElementCount > 0) continue
        const wide = (span.textContent ?? "").length
        if (at <= showing.from && showing.from < at + wide) {
          span.style.backgroundColor = "color-mix(in srgb, currentColor 22%, transparent)"
          span.style.borderRadius = "2px"
          break
        }
        at += wide
      }
    })

    return () => {
      cancelAnimationFrame(marking)
      live.destroy()
    }
  }, [engine, patch, reading.path, painted.scheme, painted.pack, choices, showing])

  const goTo = (row: Row): void => {
    if (row.path !== undefined && row.path !== reading.path) onOpen?.(row.path, row.line)
    else onGo(row.line)
    onClose()
  }

  return (
    <div
      aria-label={`Uses of ${writing.name}`}
      className={`overflow-hidden border-y border-line bg-raised text-ink ${FLOAT}`}
    >
      {/* The head: what was asked about, and how many answers there are. */}
      <div className="flex items-baseline gap-2 border-b border-line bg-surface px-3 py-2">
        <h2 className="text-sm font-semibold">
          <code className="font-mono">{writing.name}</code>
        </h2>
        <span className="text-xs text-ink-muted">
          {!here
            ? `written in ${where}`
            : uses === null
              ? "reading…"
              : uses.length === 1
                ? "written here, used nowhere else in this file"
                : `${uses.length} in this file`}
        </span>
        {across === undefined ? null : (
          <span className="text-xs text-ink-muted">
            {elsewhere === null
              ? "reading the repository…"
              : !elsewhere.ready
                ? "the repository could not be read"
                : `${beyond.length} elsewhere${elsewhere.exact === true ? ", exactly" : ""}`}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto shrink-0 rounded px-1.5 text-xs text-ink-muted hover:bg-hover"
        >
          Esc
        </button>
      </div>

      {/*
        The body, split the way an editor splits it: the code on the left, the
        list on the right. Seven parts to three, which is theirs — the code is
        the answer and the list is the way through it.
      */}
      <div className="flex" ref={body} style={{ height: tall }}>
        <div
          className="min-w-[14rem] shrink-0 overflow-auto bg-raised"
          style={{ width: `${ratio * 100}%` }}
        >
          {Option.isNone(patch) ? (
            <p className="px-3 py-2 font-mono text-xs text-ink-muted">
              {showing?.path === undefined ? "nothing to show" : `${showing.path} — press to open it`}
            </p>
          ) : (
            /*
             * The renderer paints its own background, so it is told which one —
             * the same note as `WholeFile`. Here the preview is a panel inside a
             * file, so it prints on the raised surface the panel is drawn on.
             */
            <div ref={shownIn} style={{ [PAPER]: "var(--color-raised)" } as CSSProperties} />
          )}
        </div>

        {/* The sash. Four pixels wide, the whole height of the body, and it
            lights up under the pointer so a reader can find it without being
            told it is there. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="How wide the code is"
          onPointerDown={dragSash}
          className="w-1 shrink-0 cursor-col-resize bg-line hover:bg-accent"
        />
        <ul
          className="min-w-[9rem] flex-1 overflow-y-auto py-1"
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
            if (step === 0) return
            // Theirs and not the page's: an arrow key inside a list of results
            // is the list's, and the file behind it scrolling as well would
            // take the row out from under the reader.
            event.preventDefault()
            event.stopPropagation()
            const next = Math.min(Math.max(picked + step, 0), rows.length - 1)
            setPicked(next)
            listed.current[next]?.focus()
          }}
        >
          {rows.map((row, index) => (
            <li key={`${row.kind}:${row.path ?? ""}:${row.line}`}>
              {/*
                Grouped, the way an editor's reference tree groups: this file
                first, then the rest of the repository under a heading of its
                own. A flat list of twenty rows where three of them are in the
                file being read and seventeen are not is a list that answers a
                different question than the one asked.
              */}
              {row.kind !== "beyond" || rows[index - 1]?.kind === "beyond" ? null : (
                <p className="border-t border-line px-3 pb-1 pt-2 text-[0.6875rem] text-ink-muted">
                  {here ? "Elsewhere in the repository" : "In the repository"}
                </p>
              )}
              <button
                type="button"
                ref={(node) => {
                  listed.current[index] = node
                }}
                // Only the row the preview is showing is in the tab order, so
                // Tab leaves this list rather than walking every use in it.
                tabIndex={index === picked ? 0 : -1}
                // Showing on hover as well as on focus: a reader running the
                // pointer down the list is reading the code beside it, which is
                // the whole reason the code is there.
                onMouseEnter={() => setPicked(index)}
                onFocus={() => setPicked(index)}
                onClick={() => goTo(row)}
                className={`flex w-full items-baseline gap-2 px-3 py-1 text-left font-mono text-xs hover:bg-hover ${
                  index === picked ? "bg-hover" : ""
                }`}
              >
                <span className="w-12 shrink-0 whitespace-nowrap text-right text-[0.6875rem] text-ink-muted">
                  {row.kind === "written" ? "written" : row.line}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.said}</span>
                {row.kind !== "beyond" ? null : (
                  /* Sure and Likely, where a reader can see them. A file that
                     states it borrowed this name is one thing; a file that
                     merely holds the word is another, and a reader deciding
                     whether a rename is safe needs to know which. */
                  <span
                    className={`shrink-0 text-[0.6875rem] ${
                      row.sure === true ? "text-ink-muted" : "text-busy"
                    }`}
                  >
                    {row.sure === true ? "Sure" : "Likely"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* The bottom edge, for a reader who wants more of the file or less of
          this. Eighteen lines is a guess about a question this cannot see. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="How tall this is"
        onPointerDown={dragEdge}
        className="h-1 cursor-row-resize bg-line hover:bg-accent"
      />
    </div>
  )
}
