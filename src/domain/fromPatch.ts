import { Option } from "effect"
import type { DiffLine } from "./PullRequest"

/**
 * Where a hunk header says the two sides start, or absent if the line is not one.
 *
 * `@@ -12,7 +12,9 @@ maybe a function name` — the counts are what follow the
 * comma and are not read here: they say how long the hunk is, and the lines that
 * come after it say the same thing by being there. A one-line side is written
 * without its count, which is why the comma is optional.
 */
const startsAt = (text: string): Option.Option<{ before: number; after: number }> => {
  const found = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text)
  if (found === null) return Option.none()
  return Option.some({ before: Number(found[1]), after: Number(found[2]) })
}

/**
 * A unified patch read back into diff lines.
 *
 * This is the other direction from `toPatch`, and exists for the same reason it
 * does: GitHub's official API hands a changed file's content over as patch text,
 * where the page's private routes hand over rows that already carry a line number
 * on each side. So the numbers are counted here, from the hunk headers outward,
 * which is the one place a patch says them.
 *
 * The header three lines a patch may begin with — `diff --git`, `---`, `+++` — are
 * skipped rather than read: the path is already known by whoever asked for the
 * file, and a patch that disagreed with it would be a patch for another file.
 *
 * `\ No newline at end of file` is dropped. It is a note about the line above it
 * rather than a line of the file, there is nowhere in a `DiffLine` to keep it, and
 * leaving it in would break the one rule the diff renderer needs a patch to keep:
 * every line begins with a space, a plus or a minus.
 */
export const fromPatch = (patch: string): ReadonlyArray<DiffLine> => {
  const lines: Array<DiffLine> = []
  let before = 0
  let after = 0

  for (const text of patch.split("\n")) {
    const hunk = startsAt(text)
    if (Option.isSome(hunk)) {
      before = hunk.value.before
      after = hunk.value.after
      lines.push({ kind: "hunk", text, beforeLine: Option.none(), afterLine: Option.none() })
      continue
    }

    // Before the first hunk header there is nothing to count from, so anything
    // there is a file header, and after it a stray blank line from the trailing
    // newline the patch ends with.
    if (lines.length === 0 || text.startsWith("\\")) continue

    if (text.startsWith("+")) {
      lines.push({
        kind: "added",
        text,
        beforeLine: Option.none(),
        afterLine: Option.some(after)
      })
      after += 1
      continue
    }

    if (text.startsWith("-")) {
      lines.push({
        kind: "deleted",
        text,
        beforeLine: Option.some(before),
        afterLine: Option.none()
      })
      before += 1
      continue
    }

    // A context line begins with a space, and the last line of a patch that ends
    // without a newline arrives as the empty string. Both are context; the empty
    // one is given its space back so the patch stays a patch.
    if (text === "" && lines.length > 0) continue

    lines.push({
      kind: "context",
      text,
      beforeLine: Option.some(before),
      afterLine: Option.some(after)
    })
    before += 1
    after += 1
  }

  return lines
}
