/**
 * Reaching a file by typing part of its name.
 *
 * The one command in `docs/spec/following.md` that needs nothing built for it:
 * every path in a repository at a commit is already read, off `/tree-list/{sha}`
 * (`GitHubGateway.treePaths`), so the whole of this is a ranking.
 *
 * Ranking is the entire product here. A repository has tens of thousands of
 * paths and a reader types four characters, so the difference between a useful
 * command and a list to scroll is which of the two hundred matches is first.
 * Each rule below is one a reader would state if asked, and each is pinned by a
 * test that fails without it.
 *
 * Pure, and in the domain rather than beside the screen that draws it, for two
 * reasons: it can be tested against a real repository's paths without a browser,
 * and the desktop app wants the same one.
 */

/** One path that matched, with where it matched, so the screen can show why. */
export type Found = {
  readonly path: string
  /** Higher is better. Meaningful only against other scores from the same query. */
  readonly score: number
  /**
   * Which characters of the path the query landed on, ascending.
   *
   * For the screen to embolden. Kept here rather than worked out again there,
   * because the scorer already knows and a second pass would be a second answer
   * that could disagree with the first.
   */
  readonly marks: ReadonlyArray<number>
}

/** How many to answer with unless a caller says otherwise. */
const MOST = 50

/**
 * Where a word begins, for the bonus below: after a separator, or at a capital
 * following a lowercase.
 *
 * `RepoTree.tsx` is `repo` and `tree` and `tsx` to a reader typing `rtt`, and a
 * scorer that could not see the capital would rank it under every path with a
 * stray `r`, `t` and `t` in it.
 */
const startsWord = (path: string, at: number): boolean => {
  if (at === 0) return true

  const before = path[at - 1] ?? ""
  if (before === "/" || before === "-" || before === "_" || before === ".") return true

  const here = path[at] ?? ""
  return here !== here.toLowerCase() && before === before.toLowerCase()
}

/** Whether every character of the query appears in order. Cheap, and first. */
const holds = (lower: string, query: string): boolean => {
  let at = 0
  for (const character of query) {
    at = lower.indexOf(character, at)
    if (at === -1) return false
    at += 1
  }
  return true
}

/**
 * What one match is worth, walking the path once and taking the leftmost of
 * each character.
 *
 * Leftmost rather than the best arrangement of the query over the path. The
 * best arrangement is a far more expensive question — every path, every
 * keystroke — and the answers differ mostly on paths nobody meant, because the
 * rules that decide a close call are applied below on the filename, where a
 * reader is looking.
 */
const worth = (
  path: string,
  lower: string,
  query: string,
  from: number
): { score: number; marks: ReadonlyArray<number> } | null => {
  const marks: Array<number> = []
  let score = 0
  let at = from
  let previous = -2

  for (const character of query) {
    const found = lower.indexOf(character, at)
    if (found === -1) return null

    // A character that carries on the last one is the thing a reader is
    // actually typing: `find` in `findingFile` should beat an `f`, an `i`, an
    // `n` and a `d` scattered down a long path, and by a lot.
    if (found === previous + 1) score += 8
    if (startsWord(path, found)) score += 6
    // A gap costs, and a long gap costs more, up to a floor: two paths that
    // both match badly should still be told apart by everything else.
    if (previous >= 0) score -= Math.min(found - previous - 1, 4)

    marks.push(found)
    previous = found
    at = found + 1
  }

  return { score, marks }
}

/**
 * The paths this query means, best first.
 *
 * Empty query answers with the first {@link most} paths in the order they were
 * given, which is the tree's own order: a reader who has opened the command and
 * typed nothing is looking at a list of the repository, not at a ranking of
 * nothing.
 */
export const findingFile = (
  paths: ReadonlyArray<string>,
  query: string,
  most: number = MOST
): ReadonlyArray<Found> => {
  const wanted = query.trim().toLowerCase().replaceAll(" ", "")
  if (wanted === "") {
    return paths.slice(0, most).map((path) => ({ path, score: 0, marks: [] }))
  }

  const found: Array<Found> = []

  for (const path of paths) {
    const lower = path.toLowerCase()
    if (!holds(lower, wanted)) continue

    // The filename first, because that is what a reader types. A query that
    // fits inside it is scored there and carries a bonus no path-wide match can
    // reach, so `place.ts` beats `src/ui/placeholder/index.ts` for `place`
    // however many times the folder says the word.
    //
    // `lastIndexOf("/") + 1` is 0 on a path with no folder, and that is the
    // point rather than an accident: the whole of `package.json` is its
    // filename, and the first way this was written gave it no filename at all —
    // so `place.ts` at the root of a repository ranked under `a/b/c/place.ts`,
    // which is the one result a reader would call obviously wrong.
    const inName = worth(path, lower, wanted, path.lastIndexOf("/") + 1)
    const scored = inName ?? worth(path, lower, wanted, 0)
    if (scored === null) continue

    found.push({
      path,
      // Length last and small, so it only ever decides a tie: of two files that
      // match equally well, the reader nearly always means the shorter path.
      score: scored.score + (inName === null ? 0 : 40) - path.length / 200,
      marks: scored.marks
    })
  }

  return found
    .sort((one, two) => two.score - one.score || one.path.length - two.path.length)
    .slice(0, most)
}
