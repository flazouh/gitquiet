/**
 * The changed files in the order the rail draws them.
 *
 * GitHub hands over its own order, and the tree does not keep it: folders are
 * gathered above the loose files and everything is sorted by name. Next and
 * Previous used to step through the order GitHub sent, so on any commit with a
 * folder in it the highlight jumped up and down the rail instead of walking
 * down it, and pressing `s` five times on five files visited them in an order
 * nothing on the screen explained.
 *
 * One order for both, and this is it: what the reader can see. The rules are
 * the tree's own — see `@pierre/trees`, `comparePreparedEntries` — copied here
 * rather than read off the drawn rows, because the answer is also needed for
 * reading ahead, before a row exists to read it off.
 */

const isDigit = (code: number): boolean => code >= 48 && code <= 57

type Token = string | number

/**
 * A name cut into the runs of letters and runs of digits it is made of, so
 * `step2` sorts before `step10` rather than after it. The way a person reads a
 * list of names, and the way an editor's sidebar orders them.
 */
const tokens = (value: string): ReadonlyArray<Token> => {
  const found: Array<Token> = []
  let start = 0
  let at = 0

  while (at < value.length) {
    while (at < value.length && !isDigit(value.charCodeAt(at))) at += 1
    if (at >= value.length) break
    if (at > start) found.push(value.slice(start, at))

    let number = 0
    while (at < value.length && isDigit(value.charCodeAt(at))) {
      number = number * 10 + (value.charCodeAt(at) - 48)
      at += 1
    }
    found.push(number)
    start = at
  }

  if (start < value.length || found.length === 0) found.push(value.slice(start))
  return found
}

const compareTokens = (left: ReadonlyArray<Token>, right: ReadonlyArray<Token>): number => {
  const shared = Math.min(left.length, right.length)
  for (let at = 0; at < shared; at += 1) {
    const one = left[at]
    const other = right[at]
    if (one === other) continue
    if (typeof one === "number" && typeof other === "number") return one < other ? -1 : 1
    const asText = String(one)
    const otherAsText = String(other)
    if (asText !== otherAsText) return asText < otherAsText ? -1 : 1
  }
  if (left.length !== right.length) return left.length < right.length ? -1 : 1
  return 0
}

/** One segment against another: by letter, ignoring case, with case as the tie. */
const compareSegments = (left: string, right: string): number => {
  const lower = left.toLowerCase()
  const otherLower = right.toLowerCase()
  if (lower !== otherLower) {
    const natural = compareTokens(tokens(lower), tokens(otherLower))
    if (natural !== 0) return natural
    return lower < otherLower ? -1 : 1
  }
  if (left === right) return 0
  return left < right ? -1 : 1
}

/**
 * Whether the segment at this depth is a folder. Every path here is a file, so
 * only the last segment is ever the file itself.
 */
const isFolderAt = (segments: ReadonlyArray<string>, depth: number): boolean =>
  depth !== segments.length - 1

const compare = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): number => {
  const shared = Math.min(left.length, right.length)
  for (let depth = 0; depth < shared; depth += 1) {
    const one = left[depth]!
    const other = right[depth]!
    if (one === other) continue

    // Folders above files, at every level. This is the whole of the difference
    // between what GitHub sends and what the rail shows.
    const folder = isFolderAt(left, depth)
    if (folder !== isFolderAt(right, depth)) return folder ? -1 : 1

    return compareSegments(one, other)
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1
}

export const railOrder = (paths: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...paths]
    .map((path) => ({ path, segments: path.split("/") }))
    .sort((left, right) => compare(left.segments, right.segments))
    .map((one) => one.path)
