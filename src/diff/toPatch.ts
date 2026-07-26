import { Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"

/**
 * A changed file as a unified patch, which is what a diff renderer reads.
 *
 * GitHub's own diff lines already carry the prefixes a patch is made of — a
 * space for context, `+`, `-`, and the `@@` header verbatim — so this writes
 * the file header they arrive without and joins the rest. Nothing here
 * re-derives line numbers: the hunk headers GitHub sent are the truth about
 * where the change sits, and recomputing them would only be a chance to
 * disagree with it.
 *
 * Absent for a file GitHub sent no content for, and for a binary one: neither
 * has lines to show, and an empty patch renders as an empty file rather than
 * as the honest "nothing to show here".
 */
export const toPatch = (file: ChangedFile, renamedFrom?: string): Option.Option<string> => {
  const content = Option.getOrNull(file.diff)
  if (content === null || content.isBinary || content.lines.length === 0) return Option.none()

  const before = renamedFrom ?? file.path
  const header = [
    `diff --git a/${before} b/${file.path}`,
    `--- a/${before}`,
    `+++ b/${file.path}`
  ]

  return Option.some([...header, ...content.lines.map((line) => line.text), ""].join("\n"))
}
