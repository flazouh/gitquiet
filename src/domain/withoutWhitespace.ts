/**
 * A patch with the changes that are only whitespace taken out of it.
 *
 * The most upvoted thing anybody has asked GitHub for about reviewing code:
 * "Many users want to by default always 'Hide whitespace changes'", 443 votes on
 * their own community board, and their answer is a checkbox that forgets itself
 * on the next page:
 * [discussion 5486](https://github.com/orgs/community/discussions/5486).
 *
 * Done here, on the patch text, rather than asked of anybody. GitHub's page does
 * it with `?w=1` and their API has no such parameter, so a reviewer who wants a
 * reindented file to read as a reindented file has to be given it by whoever
 * drew the diff. Pierre's renderer takes a patch and draws what it is given,
 * which makes the patch the one place this can happen.
 *
 * Not a re-diff. The lines are already paired up by the hunks GitHub sent, and
 * the only question asked here is whether a pair says the same thing once the
 * spacing is discounted. That keeps every line number the file arrived with,
 * which matters more than it sounds: a review comment is anchored to a line
 * number, so a transform that renumbered anything would move somebody's comment
 * onto a different line of somebody else's code.
 */

/** A line with its spacing discounted, which is the whole of the comparison. */
const ink = (line: string): string => line.slice(1).replace(/\s/g, "")

/**
 * Where two runs of lines agree, discounting spacing.
 *
 * The longest common subsequence rather than pairing them off in order, because
 * a block that removes two lines and adds five is common — a reindent with a
 * line added in the middle of it — and index-wise pairing would call the
 * reindented lines changed and the added one unchanged, which is worse than
 * doing nothing at all.
 *
 * Given up on rather than run to the end on a big enough block. The table is
 * removals by additions, so a minified file arriving as one block of ten
 * thousand lines each side is a hundred million cells to fill in during a
 * render. Nothing is hidden in that case, which is the safe way to be wrong.
 */
const ROOM = 250_000

const agreements = (
  removals: ReadonlyArray<string>,
  additions: ReadonlyArray<string>
): ReadonlyArray<readonly [number, number]> => {
  if (removals.length * additions.length > ROOM) return []

  const old = removals.map(ink)
  const now = additions.map(ink)

  // How long the agreement is from each pair of positions onwards, so the walk
  // below can always take the longer of the two ways past a disagreement.
  const far: Array<Array<number>> = Array.from({ length: old.length + 1 }, () =>
    new Array<number>(now.length + 1).fill(0)
  )
  for (let i = old.length - 1; i >= 0; i -= 1) {
    for (let j = now.length - 1; j >= 0; j -= 1) {
      far[i]![j] = old[i] === now[j] ? far[i + 1]![j + 1]! + 1 : Math.max(far[i + 1]![j]!, far[i]![j + 1]!)
    }
  }

  const found: Array<readonly [number, number]> = []
  let i = 0
  let j = 0
  while (i < old.length && j < now.length) {
    if (old[i] === now[j]) {
      found.push([i, j])
      i += 1
      j += 1
      continue
    }
    if (far[i + 1]![j]! >= far[i]![j + 1]!) i += 1
    else j += 1
  }
  return found
}

/**
 * One run of removals and additions, read as far as the spacing allows.
 *
 * The lines that agree come back as context carrying the *addition's* text,
 * which is the version in the file the reader is looking at. Handing back the
 * removal instead would print code that is no longer there and label it
 * unchanged.
 */
const settled = (block: ReadonlyArray<string>): ReadonlyArray<string> => {
  const removals = block.filter((line) => line.startsWith("-"))
  const additions = block.filter((line) => line.startsWith("+"))
  const agreed = agreements(removals, additions)
  if (agreed.length === 0) return block

  const out: Array<string> = []
  let i = 0
  let j = 0
  for (const [at, to] of agreed) {
    for (; i < at; i += 1) out.push(removals[i]!)
    for (; j < to; j += 1) out.push(additions[j]!)
    out.push(` ${additions[to]!.slice(1)}`)
    i = at + 1
    j = to + 1
  }
  for (; i < removals.length; i += 1) out.push(removals[i]!)
  for (; j < additions.length; j += 1) out.push(additions[j]!)
  return out
}

const isChange = (line: string): boolean => line.startsWith("+") || line.startsWith("-")

/** Whether a line belongs to a run of changes rather than ending one. */
const inBlock = (line: string): boolean => isChange(line) || line.startsWith("\\")

/**
 * A hunk's body, with every run of changes reconsidered.
 *
 * A run holding `\ No newline at end of file` is left exactly as it came. That
 * marker is a note about the line above it, and a line turned into context
 * would carry the note along into a claim about the file that is not true.
 */
const reconsidered = (body: ReadonlyArray<string>): ReadonlyArray<string> => {
  const out: Array<string> = []
  let at = 0
  while (at < body.length) {
    if (!inBlock(body[at]!)) {
      out.push(body[at]!)
      at += 1
      continue
    }
    let end = at
    while (end < body.length && inBlock(body[end]!)) end += 1
    const block = body.slice(at, end)
    out.push(...(block.some((line) => line.startsWith("\\")) ? block : settled(block)))
    at = end
  }
  return out
}

/** `@@ -12,7 +12,9 @@ maybe a function name`, split into the parts that matter. */
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

const counted = (lines: ReadonlyArray<string>, kind: "-" | "+"): number =>
  lines.filter((line) => line.startsWith(" ") || line === "" || line.startsWith(kind)).length

export const withoutWhitespace = (patch: string): string => {
  const ended = patch.endsWith("\n")
  const lines = patch.split("\n")
  if (ended) lines.pop()

  const first = lines.findIndex((line) => HUNK.test(line))
  if (first === -1) return ""

  const header = lines.slice(0, first)
  const kept: Array<string> = []

  let at = first
  while (at < lines.length) {
    const found = HUNK.exec(lines[at]!)
    if (found === null) {
      // Only reachable before the first hunk, which is already behind us. A
      // stray line here belongs to whatever hunk it sits in and travels with it.
      at += 1
      continue
    }

    let end = at + 1
    while (end < lines.length && !HUNK.test(lines[end]!)) end += 1
    const body = lines.slice(at + 1, end)
    const after = reconsidered(body)

    if (after.some(isChange)) {
      // The header is rewritten only when the body moved, so a hunk this does
      // not touch keeps whatever form GitHub wrote it in — including the
      // shorthand for a side that is one line long, which has no count in it.
      kept.push(
        after.length === body.length
          ? lines[at]!
          : `@@ -${found[1]},${counted(after, "-")} +${found[2]},${counted(after, "+")} @@${found[3]}`
      )
      kept.push(...after)
    }

    at = end
  }

  if (kept.length === 0) return ""
  return [...header, ...kept, ...(ended ? [""] : [])].join("\n")
}
