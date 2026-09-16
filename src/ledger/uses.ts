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

import { reaching } from "./reaching"
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
const sureness = (
  path: string,
  told: Told,
  asked: Asked,
  paths: ReadonlySet<string>
): "sure" | "likely" | "no" => {
  if (path === asked.path) return "sure"

  /** Whether this file states it took a name of this spelling from somewhere. */
  let borrowed = false
  for (const from of told.borrows) {
    if (from.name === asked.name) borrowed = true
    else if (from.name !== "*" && from.name !== "default") continue
    if (reaching(path, from.specifier, paths) === asked.path) return "sure"
  }

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

    const how = sureness(path, told, asked, paths)
    if (how === "no") continue

    for (const mention of mentions) {
      found.push({
        path,
        line: mention.line,
        from: mention.from,
        to: mention.to,
        sure: how === "sure"
      })
      if (found.length >= most) return found
    }
  }

  return found
}
