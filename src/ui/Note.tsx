import { Effect } from "effect"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import { useState } from "react"
import { PRESSABLE } from "./dress"
import { Markdown } from "./Markdown"
import { Says } from "./says"
import { Who } from "./Who"
import { Writing } from "./Writing"

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
  readonly onPost?: (body: string) => Effect.Effect<void, unknown>
  readonly onSave: (body: string) => void
  readonly onDiscard: () => void
  /** Who can be mentioned and what can be referred to. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /**
   * A file pasted or dropped into a box here, put where GitHub keeps them.
   *
   * Handed down beside `suggest` and for the same reason: the box is the only thing that knows
   * a file arrived in it. See `attaching.ts`.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
}

const BUTTON = `${PRESSABLE} px-2.5 py-1 text-xs font-semibold text-ink enabled:hover:bg-active`

/** What the send button says, at rest and while GitHub is being asked. */
const WORDS = ["Comment", "Posting…"] as const

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
export const Note = ({
  from,
  to,
  body,
  viewer,
  onPost,
  onSave,
  onDiscard,
  suggest,
  onUpload
}: NoteProps) => {
  const [editing, setEditing] = useState(body === "")
  const [text, setText] = useState(body)
  const [posting, setPosting] = useState(false)
  const [refused, setRefused] = useState<string | undefined>(undefined)

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
        <Markdown markdown={body} />
      </>
    )
  }

  const keep = () => {
    const written = text.trim()
    if (written === "") return onDiscard()
    onSave(written)
    setEditing(false)
  }

  const post = () => {
    const written = text.trim()
    if (written === "" || onPost === undefined) return

    setPosting(true)
    setRefused(undefined)

    Effect.runFork(
      onPost(written).pipe(
        Effect.catch((cause) =>
          Effect.sync(() => {
            // Kept in the box on refusal. Whatever GitHub objected to, the
            // paragraph that was typed is the one thing here that cannot be
            // fetched again.
            setRefused(cause instanceof Error ? cause.message : String(cause))
            setPosting(false)
          })
        )
      )
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {viewer === undefined ? null : <Who login={viewer.login} src={viewer.faceUrl} />}
        <span className="text-xs font-semibold text-ink-muted">{where}</span>
      </div>
      <div className="mt-1.5">
        <Writing
          text={text}
          onText={setText}
          placeholder="Say something about these lines"
          onEscape={onDiscard}
          onSend={() => void post()}
          suggest={suggest}
          onUpload={onUpload}
        />
      </div>
      {refused === undefined ? null : (
        <p className="mt-1.5 text-xs text-fail">GitHub would not take that: {refused}</p>
      )}
      {/* The send at the end of the row, the ways out before it, as every box here ends. */}
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <button type="button" className={BUTTON} disabled={posting} onClick={onDiscard}>
          Cancel
        </button>
        <button
          type="button"
          className={`${BUTTON} disabled:opacity-40`}
          disabled={text.trim() === "" || posting}
          onClick={keep}
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={text.trim() === "" || posting || onPost === undefined}
          aria-busy={posting ? true : undefined}
          onClick={() => void post()}
          className="rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis disabled:opacity-40"
        >
          <Says among={WORDS} said={posting ? WORDS[1] : WORDS[0]} waiting={WORDS[1]} />
        </button>
      </div>
    </>
  )
}
