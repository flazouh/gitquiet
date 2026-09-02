import { Option } from "effect"
import type { Span } from "../domain/blame"
import { nameOn } from "../domain/blame"
import { Face } from "./Face"
import { ageOf } from "./when"

export type SpanHeadingProps = {
  readonly span: Span
}

/**
 * One Span's commit, told once: a face, a name, the message's first line, and
 * how long ago. Drawn thin instead where the commit already told its story
 * higher on the page — see `docs/spec/blame.md`'s Solution.
 */
export const SpanHeading = ({ span }: SpanHeadingProps) => {
  const { commit } = span

  if (span.repeat) {
    return (
      <div className="flex items-center gap-2 border-y border-line bg-surface px-3 py-1 text-xs text-ink-muted">
        <span>Same as above:</span>
        <span className="truncate">{commit.message.split("\n")[0]}</span>
      </div>
    )
  }

  // Nothing where GitHub applied the commit itself. The face is the author's
  // either way, so it stays; what goes is a name that was never a person's.
  const name = nameOn(commit)

  return (
    <div className="flex items-center gap-2 border-y border-line bg-surface px-3 py-2 text-sm">
      {/* Face draws an initial only where GitHub gave no picture, and a Span
          always has one, so a Web Landing has no initial to draw either. */}
      <Face faceUrl={Option.some(commit.authorAvatarUrl)} name={name ?? ""} />
      {name === null ? null : <span className="font-medium text-ink">{name}</span>}
      {/* The message leads the row where no name does, so it is not dimmed
          there: a row of muted text on its own reads as a row switched off. */}
      <span className={`truncate ${name === null ? "text-ink" : "text-ink-muted"}`}>
        {commit.message.split("\n")[0]}
      </span>
      <span className="ml-auto shrink-0 text-xs text-ink-muted">{ageOf(commit.committedDate)}</span>
    </div>
  )
}
