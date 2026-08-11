import { Option } from "effect"
import type { ChangedFile, ChangeType, DiffLine } from "@/domain/PullRequest"

/**
 * A changed file written as the patch a reader would see, rather than as lines.
 *
 * `toPatch` puts the diff back together from `line.text`, prefixes and hunk headers
 * included, so a mock that spelled out `DiffLine` objects would be spelling out the
 * patch twice: once as text, once as the numbers beside it. A patch that disagreed
 * with its own line numbers would draw a thread against the wrong line, and nothing
 * in the picture would say which of the two was wrong.
 *
 * The numbers are therefore counted here, from the hunk header, the way any patch
 * reader counts them. Deleted lines advance the left column, added lines the right,
 * context both.
 */

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

const linesOf = (patch: string): ReadonlyArray<DiffLine> => {
  const found: Array<DiffLine> = []
  let before = 0
  let after = 0

  // Trimmed at both ends, because every patch below is written as a template
  // literal starting at the left margin and so begins and ends with a newline.
  for (const text of patch.replace(/^\n/, "").replace(/\n$/, "").split("\n")) {
    const hunk = HUNK.exec(text)

    if (hunk !== null) {
      before = Number(hunk[1])
      after = Number(hunk[2])
      found.push({ kind: "hunk", text, beforeLine: Option.none(), afterLine: Option.none() })
      continue
    }

    if (text.startsWith("+")) {
      found.push({ kind: "added", text, beforeLine: Option.none(), afterLine: Option.some(after) })
      after += 1
      continue
    }

    if (text.startsWith("-")) {
      found.push({ kind: "deleted", text, beforeLine: Option.some(before), afterLine: Option.none() })
      before += 1
      continue
    }

    found.push({
      kind: "context",
      text,
      beforeLine: Option.some(before),
      afterLine: Option.some(after)
    })
    before += 1
    after += 1
  }

  return found
}

/** How much of the file each side of the patch touches, for the counts on the rail. */
const countedIn = (lines: ReadonlyArray<DiffLine>) => ({
  linesAdded: lines.filter((line) => line.kind === "added").length,
  linesDeleted: lines.filter((line) => line.kind === "deleted").length
})

/**
 * One file of a pull request or of a commit, counted from its own patch.
 *
 * The digest is what Reviewed State expires against, so it is derived from the path
 * and the patch together: two captures of the same view give the same digest, and a
 * patch edited here gives a different one, which is what the real digest does.
 */
export const fileFrom = (
  path: string,
  patch: string,
  over: {
    readonly changeType?: ChangeType
    readonly readByViewer?: boolean
  } = {}
): ChangedFile => {
  const lines = linesOf(patch)

  return {
    path,
    digest: `${path}@${lines.length}`,
    changeType: over.changeType ?? "modified",
    ...countedIn(lines),
    readByViewer: over.readByViewer ?? false,
    diff: Option.some({ isBinary: false, isTruncated: false, lines })
  }
}
