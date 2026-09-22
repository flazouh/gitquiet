/**
 * Reading a repository again, cheaply.
 *
 * A Ledger is kept per file under git's name for that file's contents, and per
 * commit as a list of which name each path had. So the second visit to a
 * repository is a list read off disk, and a visit after a push is the files the
 * push touched — because every other file has the name it had, and what it says
 * is already under that name.
 *
 * Pure. What is decided here is only *what* needs reading; the reading, the
 * parsing and the storing are the offscreen document's, which is where a grammar
 * may be compiled.
 */

import type { Manifest } from "./store"

/** One file of a repository, as the archive gives it and as git names it. */
export type Named = {
  readonly path: string
  readonly sha: string
  readonly text: string
}

/**
 * Which files still have to be read, given what is already known.
 *
 * The same file twice under two paths — a copy, a vendored duplicate — is read
 * once: the key is the contents, and two paths naming the same contents are one
 * question. Which is not a trick, it is the whole reason git names files this
 * way.
 */
export const stillToRead = (
  files: ReadonlyArray<Named>,
  known: ReadonlySet<string>
): ReadonlyArray<Named> => {
  const wanted = new Map<string, Named>()

  for (const file of files) {
    if (known.has(file.sha)) continue
    if (wanted.has(file.sha)) continue
    wanted.set(file.sha, file)
  }

  return [...wanted.values()]
}

/** What a commit held, for the store to keep. */
export const manifestOf = (
  at: string,
  files: ReadonlyArray<Named>,
  seen: number,
  goModules: ReadonlyMap<string, string> = new Map(),
  phpPrefixes: ReadonlyMap<string, ReadonlyArray<string>> = new Map()
): Manifest => ({
  at,
  files: files.map((file) => [file.path, file.sha] as const),
  seen,
  ...(goModules.size === 0 ? {} : { goModules: [...goModules] }),
  ...(phpPrefixes.size === 0 ? {} : { phpPrefixes: [...phpPrefixes] })
})

/**
 * Whether a commit can be answered from what is on disk alone.
 *
 * Every path it held has to have a saying under its blob sha. A manifest with
 * one file missing is a manifest that cannot be trusted — the missing one is
 * exactly the file a reader is about to ask about — so the repository is read
 * again rather than answered incompletely.
 */
export const whollyKnown = (
  manifest: Manifest,
  known: ReadonlyMap<string, unknown>
): boolean => manifest.files.every(([, sha]) => known.has(sha))

/**
 * What each path says, out of what each blob sha says.
 *
 * The join between the two stores, and the only place the two are put back
 * together.
 */
export const byPath = <A>(
  manifest: Manifest,
  known: ReadonlyMap<string, A>
): ReadonlyMap<string, A> => {
  const files = new Map<string, A>()
  for (const [path, sha] of manifest.files) {
    const told = known.get(sha)
    if (told !== undefined) files.set(path, told)
  }
  return files
}
