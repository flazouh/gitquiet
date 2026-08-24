import { useMemo } from "react"
import { proseRuns, type ProseKind } from "../domain/proseRuns"
import type { FileDiff } from "../domain/PullRequest"
import { Markdown } from "./Markdown"

/**
 * Green for what the change adds, red for what it takes away, and nothing at
 * all for what it leaves — the same three states the code diff uses, so the two
 * views of a file are read the same way.
 */
const TONE: Record<ProseKind, string> = {
  added: "border-l-2 border-pass bg-pass-muted",
  deleted: "border-l-2 border-fail bg-fail-muted",
  context: "border-l-2 border-transparent"
}

/**
 * A markdown file as the document it becomes, with the change still visible.
 *
 * The plain rendering of a README answers "what will this say", and the diff
 * answers "what moved"; neither alone is how anyone reviews prose. Each run of
 * added, removed or untouched lines is rendered as markdown and tinted, so the
 * page reads as a document and the edits are still where they happened.
 */
export const ProseDiff = ({ diff }: { readonly diff: FileDiff }) => {
  const runs = useMemo(() => proseRuns(diff), [diff])

  return (
    <div data-gitquiet-prose-runs className="flex flex-col">
      {runs.map((run, at) => (
        <div
          // Runs have no identity of their own — two paragraphs can be added
          // with the same words — so position is the honest key.
          key={`${run.kind}-${at}`}
          data-change={run.kind}
          style={{ contentVisibility: "auto", containIntrinsicSize: "auto 48px" }}
          className={`px-2 ${TONE[run.kind]}`}
        >
          <Markdown markdown={run.text} />
        </div>
      ))}
    </div>
  )
}
