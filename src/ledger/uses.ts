/**
 * Everywhere in a repository that means one Writing.
 *
 * The question a single file cannot answer, and the reason a Ledger is kept at
 * all. It is answered from what each file was found to say — the words in it,
 * the names it binds, and what it borrowed — and never by reading those files
 * again: a repository of three hundred files would be three hundred parses per
 * question, and the question is asked while a reader waits.
 *
 * What that costs is certainty, and the cost is declared rather than hidden.
 * A file that states it borrowed this name from this file is **Sure**. A file
 * that merely holds the same word is **Likely**, and is marked. A file that
 * binds its own name of that spelling is neither: it is a different thing with
 * the same name, and it is left out.
 *
 * `docs/spec/following.md` has the words.
 */

import { reachingAll } from "./reaching"
import type { Mention, Told } from "./writings"

/** One Use, with the file it is in and how sure the answer is. */
export type Found = {
  readonly path: string
  readonly line: number
  readonly from: number
  readonly to: number
  readonly sure: boolean
}

/** A Writing, and the file it is written in, as a question about a repository. */
export type Asked = {
  readonly name: string
  readonly path: string
  readonly line: number
}

/**
 * Whether a file's mention of this name means the Writing that was asked about.
 *
 * Three answers, and the middle one is the one that earns the mark:
 *
 *   - the file the Writing is in: its own mentions are the Writing's, unless
 *     something inside it binds the name again — and that case is answered
 *     precisely by `usesIn`, which is what the reader's own file is asked with;
 *   - a file that borrowed this name from this file: Sure;
 *   - a file that binds its own name of that spelling: not this Writing at all;
 *   - anything else that holds the word: Likely.
 */
/**
 * How many files a name is followed back through before it is called a guess.
 *
 * Barrels nest — a folder's `index.ts` re-exported by the package's, re-exported
 * by the repository's — and each one is a hop. Four covers every layout anybody
 * writes on purpose, and the bound is what keeps a cycle of two barrels
 * re-exporting each other from being a question with no end.
 */
const THROUGH = 4

/**
 * Whether a file's borrow leads back to where the name is written, through
 * however many files pass it on.
 *
 * One hop was the whole of this, and one hop is not how a repository is laid
 * out. `ui/index.ts` re-exports a name from `ui/select-field.tsx`, and the
 * twenty files that import it import it from `../ui` — which resolves to the
 * barrel, which is not where the name is written, so every one of them was
 * offered as **Likely**. A list of guesses where the repository had stated the
 * answer twice over, once in the barrel and once in each importer.
 *
 * `seen` rather than depth alone, because two barrels may name each other and
 * the walk has to end either way.
 */
const reaches = (
  path: string,
  told: Told,
  asked: Asked,
  paths: ReadonlySet<string>,
  files: ReadonlyMap<string, Told>,
  left: number,
  seen: Set<string>
): boolean => {
  for (const from of told.borrows) {
    // A whole-module borrow carries every name that file writes, so it is
    // followed for any name asked about. A named one is only itself.
    if (from.name !== asked.name && from.name !== "*" && from.name !== "default") continue

    // Every file the specifier could be, not only the first. Go imports a
    // folder rather than a file, so which of a package's files writes the name
    // is not something the import says.
    for (const to of reachingAll(path, from.specifier, paths, from.name)) {
      if (to === asked.path) return true

      if (left === 0 || seen.has(to)) continue
      const next = files.get(to)
      if (next === undefined) continue
      seen.add(to)
      if (reaches(to, next, asked, paths, files, left - 1, seen)) return true
    }
  }
  return false
}

const sureness = (
  path: string,
  told: Told,
  asked: Asked,
  paths: ReadonlySet<string>,
  files: ReadonlyMap<string, Told>
): "sure" | "likely" | "no" => {
  if (path === asked.path) return "sure"

  /** Whether this file states it took a name of this spelling from somewhere. */
  let borrowed = false
  for (const from of told.borrows) {
    if (from.name === asked.name) borrowed = true
  }
  if (reaches(path, told, asked, paths, files, THROUGH, new Set([path]))) return "sure"

  /*
   * Its own. Two things with one spelling are two things, and offering one for
   * the other is the mistake this whole feature exists to stop a reader making.
   *
   * Unless the file said where it got the name, which is the case this used to
   * get backwards. An import binds the name, so an imported name is in
   * `declares` like any local — and a file that imports `listSecrets` was
   * therefore read as a file that writes its own `listSecrets` and dropped. The
   * evidence pointed the other way: a stated borrow is the strongest reason to
   * think two spellings are one thing, and the only question left is whether
   * the specifier could be resolved to prove it.
   *
   * So an unresolved borrow is Likely, which is what Likely is for. Dropping it
   * turned every failure to resolve — a path alias, a specifier through a
   * package, an archive read wrong — into the panel saying nobody depends on
   * this, which is an answer rather than an admission.
   */
  if (!borrowed && told.declares.includes(asked.name)) return "no"

  return "likely"
}

/**
 * Every Use of a Writing across the files a Ledger has read.
 *
 * In the repository's own order — the order the files were read in — rather
 * than sorted by how sure each is: a reader scanning a list of places wants
 * them where they are, and the mark says the rest.
 */
export const usesAcross = (
  files: ReadonlyMap<string, Told>,
  asked: Asked,
  paths: ReadonlySet<string>,
  most = 200
): ReadonlyArray<Found> => {
  const found: Array<Found> = []

  for (const [path, told] of files) {
    // The cheap question first: does this file hold the word at all. Most do
    // not, and a file that does not cannot be a Use however it is asked.
    const mentions: Array<Mention> = []
    for (const mention of told.mentions) {
      if (mention.name === asked.name) mentions.push(mention)
    }
    if (mentions.length === 0) continue

    // Asked once for the file, and only if a mention needs it.
    let how: "sure" | "likely" | "no" | undefined
    /** Whether an import leads to where the name is written, per import. */
    const leads = new Map<string, boolean>()

    for (const mention of mentions) {
      /*
       * Read through a package, a mention means that package's name and nothing
       * else: `errors.New` is never `store.New`, whatever else the file borrowed.
       * So it is judged alone, and is Sure or not a use at all.
       */
      let sure: boolean
      if (mention.through !== undefined) {
        let reached = leads.get(mention.through)
        if (reached === undefined) {
          reached = reachingAll(path, mention.through, paths, asked.name).includes(asked.path)
          leads.set(mention.through, reached)
        }
        if (!reached) continue
        sure = true
      } else {
        how ??= sureness(path, told, asked, paths, files)
        if (how === "no") continue
        sure = how === "sure"
      }

      found.push({ path, line: mention.line, from: mention.from, to: mention.to, sure })
      if (found.length >= most) return found
    }
  }

  return found
}
