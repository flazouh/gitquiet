import { Effect, Fiber } from "effect"
import { useEffect, useRef, useState } from "react"
import {
  pictured,
  placed,
  swapped,
  type Uploaded,
  waiting,
  written
} from "../domain/attaching"
import {
  asking,
  chosen,
  filled,
  matching,
  type One,
  type Suggesting
} from "../domain/suggesting"
import { type ArtName, useArt } from "./art"
import { Markdown } from "./Markdown"
import { continued, indented, linked } from "./typing"
import { type Way, Ways } from "./Ways"

/**
 * The box anything is written in, wherever it is being written.
 *
 * Two places need one: a remark on some lines, which opens inside the diff, and a
 * remark on the pull request, which sits at the foot of the conversation. What
 * differs between them is what surrounds the box — a line label and a draft on one,
 * a face and one button on the other — and what is inside it is the same box, so it
 * is one box. A second copy of a Markdown toolbar is a second place for Bold to
 * stop working.
 */

/**
 * What each toolbar button wraps the selection in, or puts at the front of it.
 *
 * The glyph is named rather than drawn, because this table is built once when the
 * module loads and which set it is drawn from is the reader's answer, read in a
 * render. A name here and a lookup where the button is drawn keeps the toolbar in
 * the same set as the screen around it.
 */
type Mark = {
  readonly name: string
  readonly art: ArtName
  readonly around?: readonly [string, string]
  readonly ahead?: string
  /**
   * The letter that applies it with Command held, where it has one.
   *
   * The same four every editor uses, GitHub's own box included, and the reason they are on
   * the mark rather than in a table beside it: a button whose tooltip promises a shortcut is
   * the only honest place to keep the shortcut.
   */
  readonly key?: string
}

/** What to call the modifier, which is a different key on a different desk. */
const HELD = typeof navigator === "undefined" || !/Mac|iP/.test(navigator.platform) ? "Ctrl" : "⌘"

const said = (mark: Mark): string =>
  mark.key === undefined ? mark.name : `${mark.name} (${HELD}${mark.key.toUpperCase()})`

/** One mark's glyph, drawn in whatever set the screen around it is drawn in. */
const MarkArt = ({ mark }: { readonly mark: Mark }) => {
  const Drawn = useArt()[mark.art]
  return <Drawn size={14} />
}

const MARKS: ReadonlyArray<Mark> = [
  { name: "Bold", art: "bold", around: ["**", "**"], key: "b" },
  { name: "Italic", art: "italic", around: ["_", "_"], key: "i" },
  { name: "Code", art: "code", around: ["`", "`"], key: "e" },
  { name: "Link", art: "link", around: ["[", "](url)"], key: "k" },
  { name: "Quote", art: "quote", ahead: "> " },
  { name: "Bulleted list", art: "list", ahead: "- " }
]

/**
 * The text with a mark applied to whatever was selected in it.
 *
 * Kept out of the component because it is the fiddly half: what a reader means
 * by pressing Bold with nothing selected, with a word selected, or with three
 * lines selected are three different edits, and only the last of them is
 * obvious from the button.
 */
export const marked = (
  text: string,
  mark: Mark,
  from: number,
  to: number
): { readonly text: string; readonly from: number; readonly to: number } => {
  if (mark.ahead !== undefined) {
    // A line prefix belongs at the start of every line it touches, and the
    // selection is grown to the line it started in so a caret mid-sentence
    // still marks that sentence.
    const start = text.lastIndexOf("\n", from - 1) + 1
    const end = to === from ? text.indexOf("\n", to) : to
    const stop = end === -1 ? text.length : end
    const middle = text
      .slice(start, stop)
      .split("\n")
      .map((line) => `${mark.ahead}${line}`)
      .join("\n")

    return {
      text: text.slice(0, start) + middle + text.slice(stop),
      from: from + mark.ahead.length,
      to: to + mark.ahead.length
    }
  }

  const [open, close] = mark.around ?? ["", ""]
  const chosen = text.slice(from, to)

  return {
    text: text.slice(0, from) + open + chosen + close + text.slice(to),
    // With nothing selected the caret lands between the marks, ready to type;
    // with something selected it keeps hold of what it had.
    from: from + open.length,
    to: to + open.length
  }
}

/** Nobody to mention and nothing to refer to, which is where every box starts. */
const NOBODY: Suggesting = { people: [], numbered: [] }

/**
 * How big a picture is, before it goes anywhere.
 *
 * Measured here rather than after it lands, because the address GitHub gives back is private
 * to the reader: an `img` pointed at it in this tab loads, and the same tag measured in a
 * worker or fetched again would be a second request for bytes already on this machine.
 *
 * Nothing where the browser will not decode it, which is one more file rather than a failure.
 */
const measured = (
  file: File
): Effect.Effect<{ readonly width: number; readonly height: number } | undefined> =>
  Effect.callback<{ readonly width: number; readonly height: number } | undefined>((say) => {
    const address = URL.createObjectURL(file)
    const picture = new Image()
    picture.addEventListener("load", () => {
      URL.revokeObjectURL(address)
      say(Effect.succeed({ width: picture.naturalWidth, height: picture.naturalHeight }))
    })
    picture.addEventListener("error", () => {
      URL.revokeObjectURL(address)
      say(Effect.succeed(undefined))
    })
    picture.src = address
  })

/** What GitHub said about a file it would not take, where it said anything. */
const because = (cause: unknown): string | undefined => {
  const detail = (cause as { readonly detail?: unknown } | undefined)?.detail
  return typeof detail === "string" && detail.length > 0 ? detail : undefined
}

/**
 * As tall as the box is allowed to grow before it keeps its own scrollbar.
 *
 * A Tailwind class rather than a number, because it is worn twice below — once by the
 * mirror, once by the field — and the two capping at different heights is the last line
 * of a long comment slipping out of view.
 */
const ROOM = "max-h-[520px]"

/** The box, or what the words in it come to. */
const WAYS = [
  { name: "write", said: "Write", art: "write" },
  { name: "preview", said: "Preview", art: "eye" }
] as const satisfies ReadonlyArray<Way<"write" | "preview">>

export const Writing = ({
  text,
  onText,
  placeholder,
  focused = true,
  onEscape,
  onSend,
  suggest,
  onUpload
}: {
  readonly text: string
  readonly onText: (text: string) => void
  readonly placeholder: string
  /** Whether the caret belongs here as soon as the box appears. */
  readonly focused?: boolean
  readonly onEscape: () => void
  /** Command-Enter, which is what anybody who writes on GitHub presses. */
  readonly onSend: () => void
  /**
   * Who can be mentioned and what can be referred to, read once when the box opens.
   *
   * Asked here rather than passed in whole, because the box is the only thing that knows it
   * has been opened, and a page that read every suggester for every screen would pay for a
   * list nobody was going to type an at sign into. Absent where nothing offers one, which is
   * a box that offers nobody and works as it did.
   */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /**
   * A file pasted or dropped in, put where GitHub keeps them.
   *
   * Absent where nothing is wired up to take one, and then a paste of an image is a paste of
   * nothing, which is what it was before. See `attaching.ts` for what gets written.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
}) => {
  const [previewing, setPreviewing] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [offering, setOffering] = useState<Suggesting>(NOBODY)
  const [caret, setCaret] = useState(0)
  const [chose, setChose] = useState(0)
  /** Escape closes the offer without closing the box, so it stays shut until the next word. */
  const [shut, setShut] = useState(false)
  /** What a file went wrong with, said under the box until the next one is tried. */
  const [wrong, setWrong] = useState<string>()
  /** Something is over the box and could be let go, which the box says by lighting up. */
  const [over, setOver] = useState(false)
  const [going, setGoing] = useState(0)

  /*
   * The text as it is now, for the swap when an upload lands.
   *
   * The reader goes on typing while the bytes go up, so the text this render closed over is
   * old by then, and writing it back would take away whatever was typed in the meantime.
   */
  const standing = useRef(text)
  standing.current = text

  useEffect(() => {
    if (suggest === undefined) return

    // Nothing here waits on it: a box with no list yet is a box that offers nobody, and the
    // read lands long before anybody has typed an at sign.
    const reading = Effect.runFork(
      suggest().pipe(
        Effect.catch(() => Effect.succeed(NOBODY)),
        Effect.map(setOffering)
      )
    )
    return () => {
      Effect.runFork(Fiber.interrupt(reading))
    }
  }, [suggest])

  const asked = previewing || shut ? undefined : asking(text, caret)
  const offered: ReadonlyArray<One> =
    asked === undefined
      ? []
      : asked.kind === "person"
        ? matching(offering.people, asked.said)
        : matching(offering.numbered, asked.said)
  const showing = offered.length > 0
  const at = Math.min(chose, offered.length - 1)

  /** Writes the chosen one in, where the trigger was, and puts the caret after it. */
  const take = (one: One) => {
    const field = box.current
    if (field === null || asked === undefined) return

    const next = filled(text, asked.from, caret, chosen(one))
    onText(next.text)
    setChose(0)
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(next.caret, next.caret)
      setCaret(next.caret)
    })
  }

  useEffect(() => {
    if (focused && !previewing) box.current?.focus()
  }, [focused, previewing])

  /**
   * Files into the box: a mark where they will be, then the image or the link in its place.
   *
   * The mark goes in first and the reader carries on typing around it. Each file is its own
   * mark and its own upload, so three screenshots dropped together land as they finish rather
   * than all at the end, and one refused takes only its own mark out.
   */
  const attach = (files: ReadonlyArray<File>) => {
    if (onUpload === undefined || files.length === 0) return

    setWrong(undefined)
    const field = box.current
    const from = field === null ? standing.current.length : field.selectionStart

    for (const [index, file] of files.entries()) {
      const mark = waiting(file.name, index)
      const put = placed(standing.current, index === 0 ? from : standing.current.length, mark)
      standing.current = put.text
      onText(put.text)
      requestAnimationFrame(() => field?.setSelectionRange(put.caret, put.caret))

      const swap = (put: string) => {
        const next = swapped(standing.current, mark, put)
        // Nothing where the reader has deleted the mark, which is how a paste is cancelled.
        if (next === undefined) return
        standing.current = next
        onText(next)
      }

      setGoing((one) => one + 1)
      Effect.runFork(
        Effect.gen(function* () {
          const size = pictured(file.type)
            ? yield* measured(file)
            : undefined
          const one = yield* onUpload(file)

          return written({ ...one, ...size })
        }).pipe(
          Effect.match({
            onSuccess: swap,
            onFailure: (cause) => {
              swap("")
              setWrong(because(cause) ?? `${file.name} could not be attached.`)
            }
          }),
          Effect.ensuring(Effect.sync(() => setGoing((one) => Math.max(0, one - 1))))
        )
      )
    }
  }

  const apply = (mark: Mark) => {
    const field = box.current
    if (field === null) return

    const next = marked(text, mark, field.selectionStart, field.selectionEnd)
    onText(next.text)
    // After React has written the value back, or the caret lands wherever the
    // browser last had it rather than around what was just marked.
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(next.from, next.to)
    })
  }

  return (
    <div
      className={`relative rounded-md bg-canvas ${over ? "outline outline-2 outline-accent" : ""}`}
      /*
       * Dropping a file anywhere on the box, not only on the field. A reader dragging a
       * screenshot aims at the box they can see, and the toolbar is part of it.
       */
      onDragOver={(event) => {
        if (onUpload === undefined || !event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setOver(false)
      }}
      onDrop={(event) => {
        if (onUpload === undefined || event.dataTransfer.files.length === 0) return
        event.preventDefault()
        setOver(false)
        attach([...event.dataTransfer.files])
      }}
    >
      {/* The tabs and the marks, on the surface above the box being typed in: the
          inset fill under the field is what separates the two now. */}
      <div className="flex items-center gap-0.5 bg-surface px-1.5 py-1">
        <Ways
          ways={WAYS}
          on={previewing ? "preview" : "write"}
          onPick={(way) => setPreviewing(way === "preview")}
          label="How to look at this comment"
        />
        <span className="mx-1 h-4 w-px bg-line" />
        {MARKS.map((mark) => (
          <button
            key={mark.name}
            type="button"
            aria-label={mark.name}
            /*
             * The shortcut is told rather than folded into the name: a screen reader saying
             * "Bold Command B button" is worse than the attribute that exists to carry it.
             */
            aria-keyshortcuts={mark.key === undefined ? undefined : `Meta+${mark.key}`}
            title={said(mark)}
            disabled={previewing}
            onClick={() => apply(mark)}
            className="rounded p-1 text-ink-muted hover:bg-hover hover:text-ink disabled:opacity-40"
          >
            <MarkArt mark={mark} />

          </button>
        ))}
        {onUpload === undefined ? null : (
          <>
            <span className="mx-1 h-4 w-px bg-line" />
            {/*
              A control for the thing paste and drop already do, because neither of them is
              visible and one of them needs a mouse that can drag.
            */}
            <button
              type="button"
              aria-label="Attach a file"
              title="Attach a file"
              disabled={previewing}
              onClick={() => picker.current?.click()}
              className="rounded p-1 text-ink-muted hover:bg-hover hover:text-ink disabled:opacity-40"
            >
              <MarkArt mark={{ name: "Attach a file", art: "attach" }} />
            </button>
            <input
              ref={picker}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                attach([...(event.target.files ?? [])])
                // Emptied, or the same file chosen twice in a row is chosen once.
                event.target.value = ""
              }}
            />
          </>
        )}
      </div>
      {previewing ? (
        <div className="min-h-16 px-2.5 py-2">
          {text.trim() === "" ? (
            <p className="text-sm text-ink-muted">Nothing to preview yet.</p>
          ) : (
            <Markdown markdown={text} />
          )}
        </div>
      ) : (
        /*
         * The box is as tall as what is in it, up to the height of a screenful.
         *
         * A fixed box with a scrollbar in it is the thing people complain about in GitHub's
         * own, because a comment of any length is written through a five line window.
         *
         * Grown by a mirror rather than measured. The old way set the height to `auto` and
         * read `scrollHeight` back on every keystroke, and each read is a forced synchronous
         * layout of everything on the page — which, on a pull request with a conversation of
         * any size, was this box being laggy to type in. The mirror stands behind the field
         * with the same words in the same metrics, the grid makes the taller of the two the
         * height of both, and the browser lays it out once, in the frame it was already
         * going to paint.
         *
         * The metrics live on the wrapper and both children inherit them — the field through
         * `[font:inherit]`, because a textarea is the one element that refuses the family on
         * its own — so the two cannot drift apart, and a wrapped line counts as the two
         * lines it is.
         */
        <div className={`grid text-sm ${ROOM}`}>
          <div
            aria-hidden="true"
            /*
             * `[visibility:hidden]` where `invisible` reads better, because the page is
             * GitHub's and their sheet has an `.invisible` of its own — theirs adds
             * `position: absolute`, which lifts the mirror out of the row it exists to
             * size. An arbitrary property makes a class name nobody else has.
             */
            className={`col-start-1 row-start-1 overflow-hidden whitespace-pre-wrap break-words px-2.5 py-2 [visibility:hidden] ${ROOM}`}
          >
            {/* The space is load-bearing: a trailing newline draws no line box of its own,
                and without it Enter opened a line the box was one line too short for. */}
            {`${text} `}
          </div>
          <textarea
            ref={box}
            value={text}
            placeholder={placeholder}
            onChange={(event) => {
              onText(event.target.value)
              setCaret(event.target.selectionStart)
              setShut(false)
            }}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            className="col-start-1 row-start-1 block min-h-20 w-full resize-none overflow-y-auto bg-canvas px-2.5 py-2 text-ink [font:inherit]"
            /*
             * An address pasted over chosen words is a link around them, which is what the
             * reader meant and what every other box they write in already does.
             */
            onPaste={(event) => {
              const field = box.current

              // A screenshot on the clipboard, which is the commonest thing anybody attaches.
              const files = [...event.clipboardData.files]
              if (files.length > 0 && onUpload !== undefined) {
                event.preventDefault()
                attach(files)
                return
              }

              const pasted = event.clipboardData.getData("text/plain")
              if (field === null || pasted === "") return

              const next = linked(text, field.selectionStart, field.selectionEnd, pasted)
              if (next === undefined) return

              event.preventDefault()
              const caret = field.selectionStart + (field.selectionEnd - field.selectionStart) + 2
              onText(next)
              requestAnimationFrame(() => field.setSelectionRange(caret, caret))
            }}
            // The keys anyone already presses in a box like this. Pressing them
            // somewhere the page also listens would otherwise scroll the diff or
            // close something further out.
            onKeyDown={(event) => {
              event.stopPropagation()

              /*
               * While an offer is up it takes the arrows, Enter, Tab and Escape, because that
               * is what those keys mean to a list under the caret. Everything below only sees
               * a key once the list is not there, which is why this is first.
               */
              if (showing) {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setChose((one) => (one + 1) % offered.length)
                  return
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault()
                  setChose((one) => (one - 1 + offered.length) % offered.length)
                  return
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  const one = offered[at]
                  if (one !== undefined) {
                    event.preventDefault()
                    take(one)
                    return
                  }
                }
                // Escape puts the offer away and leaves the box open, which is the difference
                // between not wanting the list and not wanting to write.
                if (event.key === "Escape") {
                  event.preventDefault()
                  setShut(true)
                  return
                }
              }

              if (event.key === "Escape") onEscape()
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                onSend()
                return
              }

              const held = event.metaKey || event.ctrlKey
              if (held && !event.altKey) {
                const mark = MARKS.find((one) => one.key === event.key.toLowerCase())
                if (mark !== undefined) {
                  event.preventDefault()
                  apply(mark)
                  return
                }
              }

              /*
               * Tab indents, which a plain textarea does not do and which markdown needs:
               * a nested list and a fenced block are both spacing, and the only way to
               * write either was to hold the space bar. See `indented` for when the press
               * is taken and when it is handed back to the browser, which matters — Tab is
               * how a reader working from the keyboard leaves this box.
               */
              if (event.key === "Tab" && !held && !event.altKey) {
                const field = box.current
                if (field === null) return

                const moved = indented(
                  text,
                  field.selectionStart,
                  field.selectionEnd,
                  event.shiftKey
                )
                if (moved === undefined) return

                event.preventDefault()
                onText(moved.text)
                requestAnimationFrame(() => field.setSelectionRange(moved.from, moved.to))
                return
              }

              // Enter under a list carries the list on, and Enter under an empty marker
              // leaves the list. See `continued`, where the rule is and where it is tested.
              if (event.key === "Enter" && !held && !event.shiftKey) {
                const field = box.current
                if (field === null || field.selectionStart !== field.selectionEnd) return

                const carried = continued(text, field.selectionStart)
                if (carried === undefined) return

                event.preventDefault()
                const at = field.selectionStart
                const next = `${text.slice(0, at - carried.drop)}${carried.put}${text.slice(at)}`
                const caret = at - carried.drop + carried.put.length
                onText(next)
                requestAnimationFrame(() => field.setSelectionRange(caret, caret))
              }
            }}
          />
        </div>
      )}
      {showing ? (
        <ul
          role="listbox"
          aria-label={asked?.kind === "person" ? "People to mention" : "Issues to refer to"}
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-lg"
        >
          {offered.map((one, index) => (
            <li key={chosen(one)}>
              {/*
                A press rather than a click on the item: the box has to keep the caret, and a
                mouse down anywhere else takes it away before the choice is made.
              */}
              <button
                type="button"
                role="option"
                aria-selected={index === at}
                onMouseDown={(event) => {
                  event.preventDefault()
                  take(one)
                }}
                onMouseEnter={() => setChose(index)}
                className={`flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-xs ${
                  index === at ? "bg-active text-ink" : "text-ink-muted"
                }`}
              >
                <span className="font-semibold text-ink">{chosen(one)}</span>
                <span className="truncate">{beside(one)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {/*
        What the files are doing, under the box rather than over the words. Said out loud as
        well: the mark in the text is a comment, which a screen reader passes over in silence.
      */}
      {going > 0 || wrong !== undefined ? (
        <p
          aria-live="polite"
          className={`px-2.5 pb-1.5 text-xs ${wrong === undefined ? "text-ink-muted" : "text-danger"}`}
        >
          {going > 0
            ? `Attaching ${going === 1 ? "a file" : `${going} files`}…`
            : wrong}
        </p>
      ) : null}
    </div>
  )
}

/** What is said beside the name: a person's own name, or an issue's title. */
const beside = (one: One): string => ("login" in one ? one.name : one.title)
