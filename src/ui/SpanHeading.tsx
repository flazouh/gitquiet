import { Option } from "effect"
import type { Span } from "../domain/blame"
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

  return (
    <div className="flex items-center gap-2 border-y border-line bg-surface px-3 py-2 text-sm">
      <Face faceUrl={Option.some(commit.authorAvatarUrl)} name={commit.committerName} />
      <span className="font-medium text-ink">{commit.committerName}</span>
      <span className="truncate text-ink-muted">{commit.message.split("\n")[0]}</span>
      <span className="ml-auto shrink-0 text-xs text-ink-muted">{ageOf(commit.committedDate)}</span>
    </div>
  )
}
