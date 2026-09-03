/**
 * Finding one path among every path a repository has.
 *
 * A reader who wants to bring a file into a review knows roughly what it is
 * called and not where it lives, and `treePaths` answers with the lot: seven
 * thousand of them on `facebook/react`, measured in the gateway's own note. So
 * this is a filter over strings and deliberately nothing cleverer — no fuzzy
 * matching, no scoring of gaps between characters. Their own file finder is a
 * substring match too, and a reader who has typed four characters is still
 * typing rather than reading a ranked list.
 *
 * What it does rank is where the hit landed, which is the one thing a plain
 * substring match gets wrong often enough to notice. See {@link hunted}.
 */

/** How far through the path the last segment starts. */
const nameStarts = (path: string): number => path.lastIndexOf("/") + 1

/**
 * The paths a reader's typing names, best first.
 *
 * Nothing at all for nothing typed. The alternative is answering the first
 * twenty of seven thousand paths, which is a list of whatever sorts first
 * rather than an answer to anything.
 *
 * Two rules order what is left, and both exist because of what a repository
 * with a `config` folder does to a search for `config`:
 *
 * 1. A hit in the file's own name comes before a hit only in a folder above it.
 *    Somebody typing `config` wants `src/config.ts` before the eleven files
 *    under `src/config/`.
 * 2. Among those, the shorter path comes first, which is the closer one to the
 *    root and the likelier one to be meant.
 */
export const hunted = (
  paths: ReadonlyArray<string>,
  typed: string,
  most = 20
): ReadonlyArray<string> => {
  const needle = typed.trim().toLowerCase()
  if (needle === "") return []

  const found: Array<{ readonly path: string; readonly inTheName: boolean }> = []

  for (const path of paths) {
    const at = path.toLowerCase().indexOf(needle)
    if (at === -1) continue
    found.push({ path, inTheName: at >= nameStarts(path) })
  }

  return found
    .sort((one, two) => {
      if (one.inTheName !== two.inTheName) return one.inTheName ? -1 : 1
      if (one.path.length !== two.path.length) return one.path.length - two.path.length
      // Named last so the answer is the same twice for the same repository,
      // which a caller drawing a list has to be able to count on.
      return one.path.localeCompare(two.path)
    })
    .slice(0, most)
    .map((one) => one.path)
}
