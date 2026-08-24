import { Effect } from "effect"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import { useState } from "react"
import { PRESSABLE } from "./dress"
import { forget, held, hold } from "./held"
import { Says } from "./says"
import { Who } from "./Who"
import { Writing } from "./Writing"

/**
 * Saying something about the pull request itself.
 *
 * At the foot of the conversation, where GitHub put it, because that is where a
 * reader arrives having read what everyone else said and having formed the thought
 * this box is for. Most of what is said on a pull request is said here rather than
 * against a line — "rebased", "screenshots in the description", "let's do the rest
 * separately" — and until this box existed, that was the one thing the interface
 * sent a reader back to GitHub's page for.
 *
 * Folded until pressed. Unfolded it is a two-hundred pixel box under every thread
 * on every pull request, most of which are read without a word being added.
 */
/** What the send button says, at rest and while GitHub is being asked. */
const WORDS = ["Comment", "Posting…"] as const

export const Saying = ({
  viewer,
  subject = "pull request",
  keep,
  suggest,
  onUpload,
  onSay
}: {
  /** Whoever is writing, so the box is signed the way the remark will be. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  /**
   * What this box is a comment on, in the reader's own words for it.
   *
   * A word rather than a whole sentence, because the same panel now sits under
   * a pull request and under an issue, and every line here that named one of
   * them was wrong on the other. Defaulted so that the page this was written
   * for says what it always said.
   */
  readonly subject?: string
  /**
   * What to keep an unsent draft under, where this box is on a page worth keeping one for.
   *
   * A name for the thing being commented on, `issue:owner/repo#77`. Absent in a test that
   * is about something else, and absent is the same as a box that keeps nothing, which is
   * what every box here was until now.
   */
  readonly keep?: string
  /** Who can be mentioned and what can be referred to. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /**
   * A file pasted or dropped into a box here, put where GitHub keeps them.
   *
   * Handed down beside `suggest` and for the same reason: the box is the only thing that knows
   * a file arrived in it. See `attaching.ts`.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
  readonly onSay: (body: string) => Effect.Effect<unknown, unknown>
}) => {
  /*
   * A draft that outlived the page it was written on opens the box on arrival.
   *
   * Folded, it would be words the reader left here and cannot see, which is the same as
   * losing them. Read once, in the first render, because reading it in an effect would
   * take whatever was typed in the meantime.
   */
  const [waiting] = useState(() => (keep === undefined ? "" : held(keep)))
  const [writing, setWriting] = useState(waiting !== "")
  const [text, setText] = useState(waiting)
  const [saying, setSaying] = useState(false)
  const [refused, setRefused] = useState<string | undefined>(undefined)

  /** Every keystroke goes to storage as well as to the screen. See `held.ts`. */
  const write = (said: string) => {
    setText(said)
    if (keep !== undefined) hold(keep, said)
  }

  /*
   * Folding the box away keeps the words; posting them is what drops them.
   *
   * Cancel is not a discard here, the way it is nowhere else people write: a reader who
   * folds a half-written comment away and comes back to an empty box has lost it, and they
   * pressed a button that said Cancel, not one that said Delete.
   */
  const close = () => {
    setWriting(false)
    setRefused(undefined)
  }

  const say = () => {
    const written = text.trim()
    if (written === "" || saying) return

    setSaying(true)
    setRefused(undefined)

    Effect.runFork(
      onSay(written).pipe(
        Effect.match({
          onSuccess: () => {
            setSaying(false)
            setText("")
            if (keep !== undefined) forget(keep)
            close()
          },
          // Kept in the box on refusal, for the same reason a line comment is:
          // whatever GitHub objected to, the paragraph that was typed is the one
          // thing here that cannot be fetched again.
          onFailure: (cause: unknown) => {
            setRefused(cause instanceof Error ? cause.message : String(cause))
            setSaying(false)
          }
        })
      )
    )
  }

  if (!writing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        {viewer === undefined ? null : <Who login={viewer.login} src={viewer.faceUrl} />}
        <button
          type="button"
          onClick={() => setWriting(true)}
          className={`${PRESSABLE} flex-1 px-2.5 py-1 text-left text-xs text-ink-muted hover:bg-active hover:text-ink`}
        >
          {text.trim() === ""
            ? `Say something about this ${subject}`
            : "Carry on with what you were writing"}
        </button>
      </div>
    )
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2 pb-1.5">
        {viewer === undefined ? null : <Who login={viewer.login} src={viewer.faceUrl} />}
        <span className="text-xs font-semibold text-ink-muted">On this {subject}</span>
      </div>
      <Writing
        text={text}
        onText={write}
        placeholder={`Say something about this ${subject}`}
        onEscape={close}
        onSend={say}
        suggest={suggest}
        onUpload={onUpload}
      />
      {refused === undefined ? null : (
        <p className="mt-1.5 text-xs text-fail">GitHub would not take that: {refused}</p>
      )}
      {/* The send at the end of the row, under the corner the reader finishes writing in,
          with the way out before it: every box on this interface ends the same way round. */}
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={saying}
          onClick={close}
          className={`${PRESSABLE} px-2.5 py-1 text-xs font-semibold text-ink enabled:hover:bg-active`}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={text.trim() === "" || saying}
          aria-busy={saying ? true : undefined}
          onClick={say}
          className="rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis enabled:hover:opacity-90 disabled:opacity-40"
        >
          <Says among={WORDS} said={saying ? WORDS[1] : WORDS[0]} waiting={WORDS[1]} />
        </button>
      </div>
    </div>
  )
}
