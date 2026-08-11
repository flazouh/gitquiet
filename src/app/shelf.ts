import type { Effect } from "effect"
import type { Opened } from "../domain/repoHome"
import { type Kept, keptReads } from "./kept"

/** How a file is read, once the shelf finds it does not have one. */
export type ReadFile = (branch: string, path: string) => Effect.Effect<Opened, unknown>

/**
 * The files of a repository, each read once and kept for as long as the page is.
 *
 * Three ways to want a file and they are not the same want. `warm` is the
 * pointer resting on a row, and nothing is waiting on it. `held` is the render
 * that follows the press, which either has the file already or does not and must
 * not block to find out. `ask` is the read itself, which folds into whatever
 * warm already started rather than asking twice.
 */
export type Shelf = {
  readonly ask: (branch: string, path: string) => Effect.Effect<Opened, unknown>
  readonly warm: (branch: string, path: string) => void
  readonly held: (branch: string, path: string) => Opened | undefined
}

/**
 * A shelf per branch, made as each branch is first asked for.
 *
 * A path names nothing on its own — `src/main.ts` is a different file on two
 * branches — so the branch cannot be part of the answer's key by being glued to
 * the front of the path and cut off again on the way in. It picks the shelf.
 */
export const shelfOf = (read: ReadFile): Shelf => {
  const shelves = new Map<string, Kept<string, Opened>>()

  const on = (branch: string): Kept<string, Opened> => {
    const already = shelves.get(branch)
    if (already !== undefined) return already

    const made = keptReads((path: string) => read(branch, path))
    shelves.set(branch, made)
    return made
  }

  return {
    ask: (branch, path) => on(branch).ask(path),
    warm: (branch, path) => on(branch).warm(path),
    held: (branch, path) => on(branch).held(path)
  }
}
