import { createPortal } from "react-dom"
import type { Writing } from "../ports/Ledger"
import type { Bounds } from "../ports/Renderer"
import { FLOAT } from "./dress"

/**
 * What a Name means, beside the Name, while the key is held.
 *
 * Four things and no more: the line it is written on, the comment written above
 * it where there is one, where that is, and whether the answer is Sure or
 * Likely. A reader holding a key over a word wants to know what it is without
 * going anywhere, and everything past those four is something they would have
 * to read instead of the code they were reading.
 *
 * Nothing in it can be pressed and nothing in it takes the focus. It is a label
 * on the pointer, and a card a reader has to aim at is a card that has cost them
 * more than it gave.
 */
export type FollowCardProps = {
  readonly writing: Writing
  readonly at: Bounds
  /** The file the Writing is in, where it is not the file being read. */
  readonly where?: string
}

/** How far above the word the card sits, in pixels. Enough to clear the underline. */
const CLEAR = 8

export const FollowCard = ({ writing, at, where }: FollowCardProps) => {
  // Above the word unless there is no room, and then below it. Measured against
  // the viewport rather than the pane: the pane scrolls, the viewport is what a
  // reader can see, and a card off the top of it is a card that is not there.
  const above = at.top > 160

  return createPortal(
    <div
      // Not interactive, and said so: a card that answers the pointer would take
      // the hover off the word that opened it, which closes the card, which
      // gives it back — a flicker the reader cannot get out of.
      aria-hidden="true"
      className={`${FLOAT} pointer-events-none fixed z-50 max-w-[32rem] px-3 py-2 text-ink`}
      style={{
        left: Math.max(8, Math.min(at.left, window.innerWidth - 520)),
        ...(above ? { bottom: window.innerHeight - at.top + CLEAR } : { top: at.bottom + CLEAR })
      }}
    >
      <code className="block whitespace-pre-wrap break-words font-mono text-xs leading-snug">
        {writing.signature}
      </code>
      {writing.doc === null ? null : (
        <p className="mt-1.5 max-h-24 overflow-hidden whitespace-pre-wrap text-xs leading-snug text-ink-muted">
          {writing.doc}
        </p>
      )}
      <p className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] text-ink-muted">
        <span className="font-mono">
          {where === undefined ? `line ${writing.line}` : `${where}:${writing.line}`}
        </span>
        {/*
          How the answer was reached, in the reader's sight and not in a tooltip.
          A name resolved by a compiler, one proved by scope, and one matched by
          spelling are three different answers, and a reader who is not told
          which they have will stop trusting all three.
          See `docs/spec/following.md`.
        */}
        <span className={writing.sure ? "text-ink-muted" : "text-busy"}>
          {writing.exact === true ? "Types" : writing.sure ? "Sure" : "Likely"}
        </span>
      </p>
    </div>,
    document.body
  )
}
