/**
 * Finding one path among every path a repository has.
 *
 * A reader who wants to bring a file into a review knows roughly what it is
 * called and not where it lives, and `treePaths` answers with the lot: seven
 * thousand of them on `facebook/react`, measured in the gateway's own note.
 *
 * This file used to hold its own filter, and used to argue for it: a substring
 * match, "deliberately nothing cleverer — no fuzzy matching, no scoring of gaps
 * between characters", on the grounds that a reader four characters in is still
 * typing rather than reading a ranked list. The reasoning was sound and the
 * conclusion is no longer the one it leads to, because there is now a second
 * place in this interface where a reader types part of a path — Go to File, on
 * a repository's front page — and two answers to one question is the thing this
 * codebase gives up more to avoid than it would ever gain by keeping a bespoke
 * filter here.
 *
 * So the ranking is `domain/findingFile.ts` and this is where the hunt asks for
 * it. Three things made that safe rather than a matter of taste, and all three
 * were measured before the change:
 *
 * 1. Every path a substring match finds, a subsequence match finds too. A
 *    substring is a subsequence with no gaps in it.
 * 2. On the case this file's own argument was built from — `config`, in a
 *    repository with both a `config.ts` and a `config/` folder — the two answer
 *    with the same paths in the same order.
 * 3. `hunting.test.ts` passed unchanged, including everything it says about
 *    which of two paths comes first.
 *
 * What is new is that a reader gets an answer for `cfg`, which this file used to
 * answer with nothing at all. Characters in a run still beat the same characters
 * scattered, by a wide margin, so what was at the top of the list is still at
 * the top of it.
 */

import { findingFile } from "./findingFile"

/**
 * The paths a reader's typing names, best first.
 *
 * Nothing at all for nothing typed, which is this hunt's own rule and not the
 * ranking's: the hunt is a box a reader opens to name a file, and answering it
 * with the first twenty of seven thousand paths is a list of whatever sorts
 * first rather than an answer to anything. Go to File is a different box with a
 * different reader — one who pressed a key to see the repository — and it shows
 * the tree's first rows instead.
 */
export const hunted = (
  paths: ReadonlyArray<string>,
  typed: string,
  most = 20
): ReadonlyArray<string> => {
  if (typed.trim() === "") return []

  return findingFile(paths, typed, most).map((found) => found.path)
}
