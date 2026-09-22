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

import { dialectFor } from "./dialects"
import { importsAFolder, reachingAll } from "./reaching"
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
  seen: Set<string>,
  /** Whether this is the file the use is in, rather than one it was followed to. */
  first = true
): boolean => {
  for (const from of told.borrows) {
    // A whole-module borrow carries every name that file writes, so it is
    // followed for any name asked about. A named one is only itself.
    if (from.name !== asked.name && from.name !== "*" && from.name !== "default") continue
    /*
     * Past the file the use is in, a file taken whole is followed only where that
     * passes its names on — a barrel's `export *`, a package's `import *`. A Go
     * file's imports, a C++ include and a Ruby require are for the file's own use,
     * and following them counted `shapes.Box` a Sure use of `other.Box`.
     */
    if (from.name === "*" && !first && dialectFor(path)?.passesOnWhole !== true) continue

    // Every file the specifier could be, not only the first. Go imports a
    // folder rather than a file, so which of a package's files writes the name
    // is not something the import says.
    // Every file of a Go package; the one file anywhere else. See `importsAFolder`.
    const reached = reachingAll(path, from.specifier, paths, from.name)
    for (const to of importsAFolder(path) ? reached : reached.slice(0, 1)) {
      if (to === asked.path) return true

      if (left === 0 || seen.has(to)) continue
      const next = files.get(to)
      if (next === undefined) continue
      seen.add(to)
      if (reaches(to, next, asked, paths, files, left - 1, seen, false)) return true
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
  /*
   * Its own first, where it did not name the borrow: a Ruby file that requires
   * the one writing `Connection` and writes its own `Connection` is using its own.
   * Taking a file whole says nothing about which names it came for; writing one
   * says which it meant.
   */
  if (!borrowed && told.declares.includes(asked.name)) return "no"
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
    /** What each module a mention was read through says about it, per module. */
    const leads = new Map<string, "sure" | "plain" | "no">()
    /*
     * A module leads to the name where it is the file that writes it, or passes
     * it on to one that does — a package's `__init__.py`, a barrel. Where it
     * reaches no file at all and the name is written as a plain one, it is read
     * as the mention it always was: `Status.ACTIVE` read through a class is read
     * through a module nobody has.
     */
    const leadsTo = (module: string, orPlain: boolean): "sure" | "plain" | "no" => {
      const held = leads.get(module)
      if (held !== undefined) return held
      const reached = reachingAll(path, module, paths, asked.name)
      const onward = (to: string): boolean => {
        const next = files.get(to)
        return next !== undefined && reaches(to, next, asked, paths, files, THROUGH - 1, new Set([path, to]), false)
      }
      const said =
        reached.includes(asked.path) || reached.some(onward)
          ? "sure"
          : reached.length === 0 && orPlain
            ? "plain"
            : "no"
      leads.set(module, said)
      return said
    }

    for (const mention of mentions) {
      /*
       * Read through a package, a mention means that package's name and nothing
       * else: `errors.New` is never `store.New`, whatever else the file borrowed.
       * So it is judged alone, and is Sure or not a use at all.
       */
      let sure: boolean
      const through = mention.through === undefined ? "plain" : leadsTo(mention.through, mention.orPlain === true)
      if (through === "no") continue
      if (through === "sure") sure = true
      else {
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
