import type { FileTreeBatchOperation } from "@pierre/trees"

/** Every folder a path lies in, shallowest first, named as the tree names them: `a/`, `a/b/`. */
const foldersOf = (path: string): ReadonlyArray<string> => {
  const parts = path.split("/")
  return parts.slice(0, -1).map((_, at) => `${parts.slice(0, at + 1).join("/")}/`)
}

/**
 * What to tell the tree so that its rows are these paths, having been those.
 *
 * The tree reads its paths once, when it is built, and a file leaving the list
 * left its row on the rail with nothing behind it. Row by row rather than
 * building the tree again, because a rebuild closes every folder the reader had
 * opened and forgets where they were scrolled to: a background read finding one
 * new file would shut the rail under the hand, mid-review.
 *
 * A folder left with nothing in it goes whole, and takes its files with it, so
 * the removals that follow skip anything standing under one. Without that, a
 * rail with the tests stood aside kept an empty `__tests__` row.
 */
export const changesBetween = (
  was: ReadonlyArray<string>,
  now: ReadonlyArray<string>
): ReadonlyArray<FileTreeBatchOperation> => {
  const here = new Set(now)
  const held = new Set(was)
  const standing = new Set(now.flatMap(foldersOf))
  const emptied = [...new Set(was.flatMap(foldersOf))].filter((folder) => !standing.has(folder))
  const roots = emptied.filter(
    (folder) => !emptied.some((other) => other !== folder && folder.startsWith(other))
  )
  const under = (path: string): boolean => roots.some((folder) => path.startsWith(folder))

  return [
    ...roots.map((path) => ({ type: "remove" as const, path, recursive: true })),
    ...was
      .filter((path) => !here.has(path) && !under(path))
      .map((path) => ({ type: "remove" as const, path })),
    ...now.filter((path) => !held.has(path)).map((path) => ({ type: "add" as const, path }))
  ]
}
