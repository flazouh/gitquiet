import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListUnorderedIcon,
  QuoteIcon
} from "@primer/octicons-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Markdown } from "./Markdown"
import { renderMarkdown } from "./renderMarkdown"
import { Who } from "./Who"

/** "Line 12", or "Lines 12 to 14". */
export const lineLabel = (from: number, to: number): string =>
  from === to ? `Line ${from}` : `Lines ${from} to ${to}`

export type NoteProps = {
  readonly from: number
  readonly to: number
  /** What was written before, or nothing at all for a fresh box. */
  readonly body: string
  /** Whoever is writing, so a remark is signed the way it will appear. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  /** Sends it to GitHub. Absent where nothing is wired up to. */
  readonly onPost?: (body: string) => Promise<void>
  readonly onSave: (body: string) => void
  readonly onDiscard: () => void
}

const BUTTON = "rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink"

/** What each toolbar button wraps the selection in, or puts at the front of it. */
type Mark = {
  readonly name: string
  readonly icon: React.ReactNode
  readonly around?: readonly [string, string]
  readonly ahead?: string
}

const MARKS: ReadonlyArray<Mark> = [
  { name: "Bold", icon: <BoldIcon size={14} />, around: ["**", "**"] },
  { name: "Italic", icon: <ItalicIcon size={14} />, around: ["_", "_"] },
  { name: "Code", icon: <CodeIcon size={14} />, around: ["`", "`"] },
  { name: "Link", icon: <LinkIcon size={14} />, around: ["[", "](url)"] },
  { name: "Quote", icon: <QuoteIcon size={14} />, ahead: "> " },
  { name: "Bulleted list", icon: <ListUnorderedIcon size={14} />, ahead: "- " }
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

/**
 * A comment on some lines, written and sent from where the lines are.
 *
 * It opens as a box to type in and posts to GitHub for real. Everything typed
 * survives as a draft in the meantime, because a review is written over an
 * afternoon and the worst thing this box could do is lose a paragraph while
 * somebody looks at another file.
 *
 * This renders inside the diff, in the light DOM under the renderer's host: the
 * rows are slotted into its shadow tree rather than living in it, which is why
 * the page's own styles — these classes included — still reach them.
 */
export const Note = ({ from, to, body, viewer, onPost, onSave, onDiscard }: NoteProps) => {
  const [editing, setEditing] = useState(body === "")
  const [text, setText] = useState(body)
  const [previewing, setPreviewing] = useState(false)
  const [posting, setPosting] = useState(false)
  const [refused, setRefused] = useState<string | undefined>(undefined)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && !previewing) box.current?.focus()
  }, [editing, previewing])

  const where = lineLabel(from, to)
  const preview = useMemo(() => renderMarkdown(text), [text])

  if (!editing) {
    return (
      <>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">{where}</span>
          <span className="rounded-full bg-attention-muted px-1.5 text-[11px] font-semibold text-busy">
            Draft, not posted
          </span>
          <span className="flex-1" />
          <button type="button" className={BUTTON} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className={BUTTON} onClick={onDiscard}>
            Delete
          </button>
        </div>
        <Markdown html={renderMarkdown(body)} />
      </>
    )
  }

  const keep = () => {
    const written = text.trim()
    if (written === "") return onDiscard()
    onSave(written)
    setEditing(false)
  }

  const post = async () => {
    const written = text.trim()
    if (written === "" || onPost === undefined) return

    setPosting(true)
    setRefused(undefined)
    try {
      await onPost(written)
    } catch (cause) {
      // Kept in the box on refusal. Whatever GitHub objected to, the paragraph
      // that was typed is the one thing here that cannot be fetched again.
      setRefused(cause instanceof Error ? cause.message : String(cause))
      setPosting(false)
    }
  }

  const apply = (mark: Mark) => {
    const field = box.current
    if (field === null) return

    const next = marked(text, mark, field.selectionStart, field.selectionEnd)
    setText(next.text)
    // After React has written the value back, or the caret lands wherever the
    // browser last had it rather than around what was just marked.
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(next.from, next.to)
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {viewer === undefined ? null : <Who login={viewer.login} src={viewer.faceUrl} />}
        <span className="text-xs font-semibold text-ink-muted">{where}</span>
      </div>
      <div className="mt-1.5 overflow-hidden rounded-md border border-line">
        <div className="flex items-center gap-0.5 border-b border-line bg-surface px-1.5 py-1">
          <Tab name="Write" chosen={!previewing} onChoose={() => setPreviewing(false)} />
          <Tab name="Preview" chosen={previewing} onChoose={() => setPreviewing(true)} />
          <span className="mx-1 h-4 w-px bg-line" />
          {MARKS.map((mark) => (
            <button
              key={mark.name}
              type="button"
              aria-label={mark.name}
              title={mark.name}
              disabled={previewing}
              onClick={() => apply(mark)}
              className="rounded p-1 text-ink-muted hover:bg-hover hover:text-ink disabled:opacity-40"
            >
              {mark.icon}
            </button>
          ))}
        </div>
        {previewing ? (
          <div className="min-h-16 px-2.5 py-2">
            {text.trim() === "" ? (
              <p className="text-sm text-ink-muted">Nothing to preview yet.</p>
            ) : (
              <Markdown html={preview} />
            )}
          </div>
        ) : (
          <textarea
            ref={box}
            value={text}
            placeholder="Say something about these lines"
            onChange={(event) => setText(event.target.value)}
            className="block min-h-20 w-full resize-y bg-canvas px-2.5 py-2 text-sm text-ink"
            // The keys anyone already presses in a box like this. Pressing them
            // somewhere the page also listens would otherwise scroll the diff or
            // close something further out.
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === "Escape") onDiscard()
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void post()
              }
            }}
          />
        )}
      </div>
      {refused === undefined ? null : (
        <p className="mt-1.5 text-xs text-fail">GitHub would not take that: {refused}</p>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          disabled={text.trim() === "" || posting || onPost === undefined}
          onClick={() => void post()}
          className="rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis disabled:opacity-40"
        >
          {posting ? "Posting…" : "Comment"}
        </button>
        <button
          type="button"
          className={`${BUTTON} disabled:opacity-40`}
          disabled={text.trim() === "" || posting}
          onClick={keep}
        >
          Save draft
        </button>
        <button type="button" className={BUTTON} disabled={posting} onClick={onDiscard}>
          Cancel
        </button>
      </div>
    </>
  )
}

const Tab = ({
  name,
  chosen,
  onChoose
}: {
  readonly name: string
  readonly chosen: boolean
  readonly onChoose: () => void
}) => (
  <button
    type="button"
    aria-pressed={chosen}
    onClick={onChoose}
    className={`rounded px-2 py-0.5 text-xs font-semibold ${
      chosen ? "bg-canvas text-ink" : "text-ink-muted hover:text-ink"
    }`}
  >
    {name}
  </button>
)
