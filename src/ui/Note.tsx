import { useEffect, useRef, useState } from "react"

/** "Line 12", or "Lines 12 to 14". */
export const lineLabel = (from: number, to: number): string =>
  from === to ? `Line ${from}` : `Lines ${from} to ${to}`

export type NoteProps = {
  readonly from: number
  readonly to: number
  /** What was written before, or nothing at all for a fresh box. */
  readonly body: string
  readonly onSave: (body: string) => void
  readonly onDiscard: () => void
}

const BUTTON = "rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink"

/**
 * A comment on some lines, before it is a comment.
 *
 * It opens as a box to type in when there is nothing written yet, and settles
 * into what was written once there is — saying plainly that it is a draft,
 * because until the posting transport is worked out that is the truth, and a
 * comment that looks sent but never arrives is worse than no comment.
 *
 * This renders inside the diff, in the light DOM under the renderer's host: the
 * rows are slotted into its shadow tree rather than living in it, which is why
 * the page's own styles — these classes included — still reach them.
 */
export const Note = ({ from, to, body, onSave, onDiscard }: NoteProps) => {
  const [editing, setEditing] = useState(body === "")
  const [text, setText] = useState(body)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) box.current?.focus()
  }, [editing])

  const where = lineLabel(from, to)

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
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{body}</p>
      </>
    )
  }

  const keep = () => {
    const written = text.trim()
    if (written === "") return onDiscard()
    onSave(written)
    setEditing(false)
  }

  return (
    <>
      <span className="text-xs font-semibold text-ink-muted">{where}</span>
      <textarea
        ref={box}
        value={text}
        placeholder="Say something about these lines"
        onChange={(event) => setText(event.target.value)}
        className="mt-1.5 block min-h-16 w-full resize-y rounded-md border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
        // The two keys anyone already presses in a box like this. Pressing them
        // somewhere the page also listens would otherwise scroll the diff or
        // close something further out.
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            onDiscard()
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            keep()
          }
        }}
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          disabled={text.trim() === ""}
          onClick={keep}
          className="rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis disabled:opacity-40"
        >
          Save draft
        </button>
        <button type="button" className={BUTTON} onClick={onDiscard}>
          Cancel
        </button>
      </div>
    </>
  )
}
