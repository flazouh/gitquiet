/**
 * Which file a specifier names, out of the paths a repository has.
 *
 * A file says `import { one } from "./elsewhere"` and means one of about six
 * paths, depending on how the repository is laid out and which of them exists.
 * Every answer here is checked against the list of paths the repository really
 * holds — `/tree-list/{sha}`, which the tree already reads — so nothing is ever
 * fetched on a guess.
 *
 * A specifier that leaves the repository leaves this feature. `effect` and
 * `react` are in `node_modules`, which is not a repository this reader has open,
 * and `docs/spec/following.md` says so in as many words.
 */

/**
 * What a specifier may end in, tried in this order.
 *
 * TypeScript first because this is a TypeScript grammar, and `.tsx` before `.js`
 * because a repository holding both usually built the second from the first —
 * following a name into generated output is a Follow into a file nobody wrote.
 */
const ENDINGS: ReadonlyArray<string> = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".d.ts",
  "/index.ts",
  "/index.tsx",
  ".js",
  ".jsx",
  "/index.js"
]

/**
 * `a/b/../c` said plainly, and `a/b/./c` too, or nothing where it climbs out.
 *
 * Nothing, rather than the repository's own root taken as the top of the world.
 * `../../../../etc/passwd` from `src/one.ts` reduces to `etc/passwd` if a pop on
 * an empty list is ignored — a path that looks like one inside the repository
 * and is a specifier saying it wants out. The check against the real path list
 * would have refused it anyway; answering it at all is the kind of thing that is
 * harmless until the day something else reads this function.
 */
const plainly = (path: string): string | null => {
  const parts: Array<string> = []
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue
    if (part === "..") {
      if (parts.length === 0) return null
      parts.pop()
      continue
    }
    parts.push(part)
  }
  return parts.join("/")
}

/**
 * The paths a specifier could mean, best first, before anything is checked.
 *
 * Exported for its own test: which endings are tried and in which order is a
 * judgement, and a judgement with a test on it is one somebody can argue with.
 */
export const couldBe = (from: string, specifier: string): ReadonlyArray<string> => {
  if (!specifier.startsWith(".")) return []

  const folder = from.slice(0, Math.max(0, from.lastIndexOf("/")))
  const asked = plainly(`${folder}/${specifier}`)
  if (asked === null || asked === "") return []

  // A specifier that already names its ending is taken as written. TypeScript's
  // own `.js`-means-`.ts` rule is the one exception worth keeping, because
  // every ES-module TypeScript repository is written that way.
  if (asked.endsWith(".ts") || asked.endsWith(".tsx")) return [asked]
  if (asked.endsWith(".js")) {
    return [`${asked.slice(0, -3)}.ts`, `${asked.slice(0, -3)}.tsx`, asked]
  }

  return ENDINGS.map((ending) => `${asked}${ending}`)
}

/**
 * The path a specifier names, out of the paths that exist, or nothing.
 *
 * Nothing is the answer for a dependency, for a specifier that resolves out of
 * the repository, and for a file the tree has never heard of. All three leave
 * the reader with no underline, which is what they had before.
 */
export const reaching = (
  from: string,
  specifier: string,
  paths: ReadonlySet<string>
): string | null => couldBe(from, specifier).find((path) => paths.has(path)) ?? null
