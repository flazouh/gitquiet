/**
 * Which repository a package comes from, worked out from what a repository says
 * about itself.
 *
 * A file imports `@yourorg/thing`. That is not a path, it is a name, and a name
 * resolves against a folder this extension does not have — an archive carries no
 * `node_modules`. But a repository does say where its packages are, and a
 * package does say what it is called, and between the two a bare specifier can
 * be followed without asking anything of anybody.
 *
 * Three ways, cheapest first, and the first two cost no request at all:
 *
 *   1. A package in this same repository. Most monorepos, and the reason a
 *      specifier that looks foreign so often is not.
 *   2. A repository with the same name as the package's scope and package —
 *      `@yourorg/thing` is `yourorg/thing` far more often than not. A guess, and
 *      checked against that repository's own `package.json` before it is
 *      believed.
 *   3. A repository of the same owner as this one, for a package with no scope.
 *
 * What is not here is the npm registry. It knows the answer for every package
 * and it is somebody else's server; `docs/spec/following.md` says what this
 * extension will and will not send elsewhere, and a list of a private
 * repository's dependencies is on the wrong side of it.
 */

import { Effect } from "effect"

/** A repository, said the way the rest of this codebase says it. */
export type Repo = { readonly owner: string; readonly repo: string }

/** A package this repository holds itself: its name, and where it lives. */
export type Held = {
  readonly name: string
  /** The folder it is in, with no trailing slash. Empty for the root package. */
  readonly at: string
  /** The file its name resolves to, relative to the repository. */
  readonly entry: string | null
}

/**
 * A `package.json`, or nothing where it is not one.
 *
 * Not one is the ordinary case rather than the exceptional one: a file somebody
 * is in the middle of editing does not parse, and a pull request is full of
 * those. `Effect.try` rather than a `try` block, which this codebase does not
 * write — see `.oxlintrc.json`.
 */
const parsed = (text: string): Record<string, unknown> | null =>
  Effect.try({
    try: (): unknown => JSON.parse(text),
    catch: () => null
  }).pipe(
    Effect.map((found) =>
      typeof found === "object" && found !== null ? (found as Record<string, unknown>) : null
    ),
    Effect.catch(() => Effect.succeed(null)),
    Effect.runSync
  )

const stringOf = (held: Record<string, unknown>, key: string): string | null => {
  const found = held[key]
  return typeof found === "string" ? found : null
}

/**
 * The file a package's name resolves to, out of the fields that can say so.
 *
 * `types` before `main`, because what is wanted is the source a reader can read
 * rather than the bundle a build wrote. `exports` is read only in its simplest
 * shape: a map with a `.` in it. Anything cleverer is a package describing
 * conditions this cannot evaluate, and a guess between them would be a Follow
 * into whichever branch was written first.
 */
export const entryOf = (text: string): string | null => {
  const held = parsed(text)
  if (held === null) return null

  const exports = held["exports"]
  if (typeof exports === "object" && exports !== null) {
    const root = (exports as Record<string, unknown>)["."]
    if (typeof root === "string") return root
    if (typeof root === "object" && root !== null) {
      const conditions = root as Record<string, unknown>
      for (const name of ["types", "import", "default", "require"]) {
        const found = conditions[name]
        if (typeof found === "string") return found
      }
    }
  }

  return (
    stringOf(held, "types") ??
    stringOf(held, "typings") ??
    stringOf(held, "module") ??
    stringOf(held, "main")
  )
}

/** What a `package.json` calls the package it describes. */
export const nameOf = (text: string): string | null => {
  const held = parsed(text)
  return held === null ? null : stringOf(held, "name")
}

/**
 * Every package this repository holds itself, by the name other files import it
 * as.
 *
 * Read off the `package.json` files in the archive rather than off the
 * `workspaces` field, because the field is a list of globs and the files are
 * the answer those globs were written to produce.
 */
export const heldIn = (files: ReadonlyMap<string, string>): ReadonlyMap<string, Held> => {
  const held = new Map<string, Held>()

  for (const [path, text] of files) {
    if (path !== "package.json" && !path.endsWith("/package.json")) continue
    // `node_modules` in a repository is a vendored copy or a mistake, and
    // either way is not a package this repository holds.
    if (path.includes("node_modules/")) continue

    const name = nameOf(text)
    if (name === null) continue

    const at = path === "package.json" ? "" : path.slice(0, -"/package.json".length)
    const entry = entryOf(text)
    held.set(name, {
      name,
      at,
      entry: entry === null ? null : `${at === "" ? "" : `${at}/`}${entry.replace(/^\.\//, "")}`
    })
  }

  return held
}

/**
 * The repositories a bare specifier might be, best first.
 *
 * Guesses, every one, and each is checked against that repository's own
 * `package.json` before anything is followed into it. A guess that is wrong
 * costs one small request and is never shown to a reader.
 */
export const mightBe = (specifier: string, from: Repo): ReadonlyArray<Repo> => {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return []
  // A deep import — `@org/thing/helpers` — is the same package as its first two
  // segments, and the rest is a path inside it.
  const parts = specifier.split("/")
  const scoped = specifier.startsWith("@")
  const name = scoped ? parts.slice(0, 2).join("/") : (parts[0] ?? "")
  if (name === "") return []

  const found: Array<Repo> = []
  if (scoped) {
    const [scope, under] = name.slice(1).split("/")
    if (scope !== undefined && under !== undefined) {
      found.push({ owner: scope, repo: under })
      // An organisation whose packages all live in one repository, named for
      // the scope: `@effect/platform` in `effect/effect`.
      if (scope !== under) found.push({ owner: scope, repo: scope })
    }
  } else {
    // Unscoped, and the likeliest answer is that it is this owner's own.
    found.push({ owner: from.owner, repo: name })
  }

  return found.filter((one) => one.owner !== "" && one.repo !== "")
}

/** What is left of a deep import once the package's own name is taken off. */
export const withinPackage = (specifier: string): string | null => {
  const parts = specifier.split("/")
  const rest = specifier.startsWith("@") ? parts.slice(2) : parts.slice(1)
  return rest.length === 0 ? null : rest.join("/")
}
