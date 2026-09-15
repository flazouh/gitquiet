import type { Peeked } from "./following"

/**
 * A Writing drawn under the Name that asked for it, without leaving the file.
 *
 * What a reader wants most of the time, because the question is usually "what
 * does this do" and not "take me there" — and in a review, being moved is the
 * thing this interface exists to stop happening.
 *
 * React rather than the plain DOM the file page builds, because the rows in a
 * diff are portalled into elements the page's own stylesheet reaches, which is
 * how every review thread beside it is drawn. The file page slots its rows
 * straight into the renderer's shadow root and has to dress them in custom
 * properties instead. Same row, two reaches.
 */
export const Peek = ({ peeked }: { readonly peeked: Peeked }) => (
  <div className="text-xs">
    <p className="m-0 mb-1 text-[0.6875rem] text-ink-muted">
      {peeked.where === undefined
        ? `line ${peeked.writing.line}`
        : `${peeked.where}:${peeked.writing.line}`}
    </p>
    <pre className="m-0 overflow-x-auto font-mono leading-normal">{peeked.lines.join("\n")}</pre>
  </div>
)
