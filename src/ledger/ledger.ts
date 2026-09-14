/**
 * Every Writing a repository holds, at one commit.
 *
 * The Ledger `docs/spec/following.md` is named for. What it buys is not the
 * first Follow — a single file parses in a few milliseconds — but the questions
 * one file cannot answer: every name in the repository typed at, and every Use
 * of a Writing in files the reader has never opened.
 *
 * Pure, and given its parsing rather than doing it, so the whole of it is tested
 * against the real grammar under `bun test`.
 */

import type { Held } from "./packages"
import type { Told, Writing } from "./writings"

/** One Writing, and which file writes it. */
export type Place = {
  readonly path: string
  readonly writing: Writing
}

/**
 * Which reading of which repository this is.
 *
 * The repository *and* the commit, and the first version of this was the commit
 * alone. That is wrong twice over: a branch name stands in for a sha wherever
 * one is not to hand — the archive route takes either — so two repositories
 * warmed at `main` are one key, and the second silently answers with the first's
 * names. The benchmark found it by reading three repositories and being told all
 * three held the same five files.
 */
export const keyOf = (repo: { readonly owner: string; readonly repo: string }, sha: string): string =>
  `${repo.owner}/${repo.repo}@${sha}`

/** What a repository writes down, by name. */
export type Kept = {
  /** {@link keyOf}, and never a bare sha. */
  readonly at: string
  /** The packages this repository holds itself, by the name others import them as. */
  readonly packages: ReadonlyMap<string, Held>
  /** What each file was found to say, which is what every question is answered from. */
  readonly files: ReadonlyMap<string, Told>
  /** Every Writing, by the name it is written under. */
  readonly names: ReadonlyMap<string, ReadonlyArray<Place>>
  /** How many files were read, and how many were passed over. */
  readonly read: number
  readonly skipped: number
}

/**
 * What is not worth parsing, whatever its extension says.
 *
 * Generated output and vendored copies, which are the two things a repository
 * holds most of and the two a reader never means. Following a name into a
 * bundle is following it into a file nobody wrote; `node_modules` is somebody
 * else's repository sitting inside this one.
 */
const SKIP = /(^|\/)(node_modules|dist|build|out|vendor|coverage|\.next|\.output)\//

/** Past this, a file is generated whatever it is called. */
const TOO_LONG = 400_000

/**
 * A file worth reading, which is a judgement and is therefore testable.
 */
export const worthReading = (path: string, text: string): boolean => {
  if (SKIP.test(path)) return false
  if (text.length > TOO_LONG) return false
  if (path.endsWith(".min.js") || path.endsWith(".d.ts")) return false

  return true
}

/**
 * The Ledger, built from what each file was found to say.
 *
 * Given the sayings rather than doing the parsing, and that is the change that
 * makes a Ledger worth keeping: what a file says is filed under git's own name
 * for its contents, so a file that did not change between two commits is read
 * once for both. Who parses, and what was already known, is
 * `src/ledger/keeping.ts` and the document that calls it.
 */
export const kept = (
  at: string,
  files: ReadonlyMap<string, Told>,
  skipped: number,
  packages: ReadonlyMap<string, Held> = new Map()
): Kept => {
  const names = new Map<string, Array<Place>>()

  for (const [path, told] of files) {
    for (const writing of told.writings) {
      const found = names.get(writing.name)
      if (found === undefined) names.set(writing.name, [{ path, writing }])
      else found.push({ path, writing })
    }
  }

  return { at, files, names, read: files.size, skipped, packages }
}

/**
 * Where a name is written, across the whole repository.
 *
 * Every place of that exact name. Which of them a reader meant is a question
 * this cannot answer and does not pretend to — see `Likely` in the spec — so
 * they are all offered, nearest-looking first: a name written once is a Follow,
 * and a name written eleven times is a list.
 */
export const placesFor = (ledger: Kept, name: string): ReadonlyArray<Place> =>
  ledger.names.get(name) ?? []

/**
 * Every name the repository writes, for a reader typing at it.
 *
 * Flattened once per ask rather than kept flat: the map is what every other
 * question reads, and a second copy of the same data would be a second thing to
 * keep right.
 */
export const everyPlace = (ledger: Kept): ReadonlyArray<Place> =>
  [...ledger.names.values()].flat()
