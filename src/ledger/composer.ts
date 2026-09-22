import { Effect } from "effect"

/**
 * What a repository's `composer.json` files say its PHP namespaces are.
 *
 * PSR-4 maps a namespace prefix to a folder, and the rest of a class's name to the
 * path under it — which is what the conventions in `reaching.ts` guess at. Read,
 * the map answers where a guess cannot: Laravel maps `Illuminate\Support\` to five
 * folders, and `Illuminate\Support\Traits\Conditionable` is in the fourth.
 *
 * A package's own `composer.json` counts, with its folders read from where it is.
 * One under `vendor` is somebody else's, and a file that is not JSON says nothing.
 */

/** Somebody else's packages, kept inside this repository. */
const NOT_OURS = /(^|\/)(vendor|node_modules)\//u

/** Whether a path is a `composer.json` this repository wrote. */
export const isComposerJson = (path: string): boolean =>
  (path === "composer.json" || path.endsWith("/composer.json")) && !NOT_OURS.test(path)

/** The two sections a PSR-4 map is kept in. */
const SECTIONS: ReadonlyArray<string> = ["autoload", "autoload-dev"]

/**
 * Every namespace prefix a repository maps, to the folders it is mapped to.
 *
 * Folders are said from the root of the repository, with no slash at either end;
 * a prefix mapped in several files keeps every folder, in the order they were read.
 */
export const phpPrefixesIn = (files: ReadonlyMap<string, string>): ReadonlyMap<string, ReadonlyArray<string>> => {
  const prefixes = new Map<string, Array<string>>()
  for (const [path, text] of files) {
    if (!isComposerJson(path)) continue
    const at = path === "composer.json" ? "" : path.slice(0, -"/composer.json".length)
    for (const [prefix, folder] of psr4In(text)) {
      const whole = [at, folder.replace(/^\.?\/+|\/+$/gu, "")].filter((part) => part !== "").join("/")
      const held = prefixes.get(prefix)
      if (held === undefined) prefixes.set(prefix, [whole])
      else if (!held.includes(whole)) held.push(whole)
    }
  }
  return prefixes
}

/** A `composer.json`'s PSR-4 entries, one per folder, or none where it has none. */
const psr4In = (text: string): ReadonlyArray<readonly [string, string]> => {
  const said = parsed(text)
  if (said === null) return []
  const entries: Array<readonly [string, string]> = []
  for (const section of SECTIONS) {
    const map = objectAt(objectAt(said, section), "psr-4")
    if (map === null) continue
    for (const [prefix, folders] of Object.entries(map)) {
      for (const folder of Array.isArray(folders) ? folders : [folders]) {
        if (typeof folder === "string") entries.push([prefix, folder])
      }
    }
  }
  return entries
}

/** JSON, or nothing where it is not. */
const parsed = (text: string): unknown =>
  Effect.runSync(
    Effect.try({ try: (): unknown => JSON.parse(text), catch: (cause) => cause }).pipe(
      Effect.catch(() => Effect.succeed(null))
    )
  )

/** A key of an object that is itself an object, or nothing. */
const objectAt = (from: unknown, key: string): Readonly<Record<string, unknown>> | null => {
  if (from === null || typeof from !== "object") return null
  const value = (from as Record<string, unknown>)[key]
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}
