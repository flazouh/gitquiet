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

import type { Writing } from "./writings"

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
 * The Ledger, built from a repository's files.
 *
 * `outline` is the parsing, handed in: in the extension it is a grammar in the
 * offscreen document, in a test it is the same grammar under Bun, and on a
 * desktop build it could be something better. A file it answers nothing for —
 * a language nothing here speaks — costs a call and nothing else.
 */
export const kept = (
  at: string,
  files: ReadonlyMap<string, string>,
  outline: (path: string, text: string) => ReadonlyArray<Writing>
): Kept => {
  const names = new Map<string, Array<Place>>()
  let read = 0
  let skipped = 0

  for (const [path, text] of files) {
    if (!worthReading(path, text)) {
      skipped += 1
      continue
    }

    const written = outline(path, text)
    if (written.length === 0) {
      skipped += 1
      continue
    }
    read += 1

    for (const writing of written) {
      const held = names.get(writing.name)
      if (held === undefined) names.set(writing.name, [{ path, writing }])
      else held.push({ path, writing })
    }
  }

  return { at, names, read, skipped }
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
