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

import { extensionOf } from "./syntax"

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
  const extension = extensionOf(from)
  if (extension === "py" || extension === "pyi") return couldBePython(from, specifier)
  if (extension === "rs") return couldBeRust(specifier)

  if (!specifier.startsWith(".")) return []

  const folder = from.slice(0, Math.max(0, from.lastIndexOf("/")))
  const asked = plainly(`${folder}/${specifier}`)
  if (asked === null) return []

  return endingsFor(asked)
}

/**
 * What a Python module name could be, as a path.
 *
 * Python names a module and not a file, and the two differ in three ways that
 * each cost a candidate. A module is `thing.py` or the folder `thing/` with an
 * `__init__.py` in it. Its parts are separated by dots rather than by slashes.
 * And a leading dot means relative, counted in packages rather than in folders:
 * one dot is the package this file is in, two is the one above it, and there is
 * no `./` that means the same as no dot at all.
 *
 * `from . import one` is a specifier of one dot and no name, which means the
 * package's own `__init__.py` — a real answer, and the one a barrel is written
 * as in this language.
 *
 * An absolute name is tried at the repository's root and under `src/`, which are
 * where a package is laid out when it is not installed. Everything here is
 * checked against the paths the repository really holds, so a name that is also
 * a module of the standard library reaches nothing rather than reaching the
 * wrong thing.
 */
const couldBePython = (from: string, specifier: string): ReadonlyArray<string> => {
  const dots = specifier.length - specifier.replace(/^\.+/, "").length
  const rest = specifier.slice(dots)
  const parts = rest === "" ? [] : rest.split(".")

  if (dots === 0) {
    const asked = parts.join("/")
    if (asked === "") return []
    return [...pythonEndings(asked), ...pythonEndings(`src/${asked}`)]
  }

  // One dot is this file's own package, which is its folder. Every dot after the
  // first climbs one package further up.
  const folder = from.slice(0, Math.max(0, from.lastIndexOf("/")))
  const up = folder === "" ? [] : folder.split("/")
  if (dots - 1 > up.length) return []
  const base = up.slice(0, up.length - (dots - 1))

  const asked = [...base, ...parts].join("/")
  if (asked === "") return []
  if (parts.length === 0) return [`${asked}/__init__.py`, `${asked}/__init__.pyi`]
  return pythonEndings(asked)
}

/** A Python module path as the two files it could be, best first. */
const pythonEndings = (asked: string): ReadonlyArray<string> => [
  `${asked}.py`,
  `${asked}/__init__.py`,
  `${asked}.pyi`,
  `${asked}/__init__.pyi`
]

/**
 * What a Rust path could be, as a file.
 *
 * `crate::a::b` and nothing else. A crate's root is `src/`, a module is `a.rs`
 * or `a/mod.rs`, and those two are the whole of what is worth guessing.
 *
 * `self::` and `super::` are not here. Both are relative to the module a file
 * declares rather than to the file itself — `src/x/y.rs` declaring `mod a` puts
 * `a` at `src/x/y/a.rs`, and the same file reached as `src/x/y/mod.rs` puts it
 * at `src/x/y/a.rs` too. Reading `mod` items is what tells those apart, and
 * guessing between them would be offering a reader a file at random.
 *
 * `std::`, and any other crate, is outside the repository, which is the same
 * answer every dependency gets everywhere else here.
 */
const couldBeRust = (specifier: string): ReadonlyArray<string> => {
  const parts = specifier.split("::").filter((part) => part !== "")
  if (parts[0] !== "crate" || parts.length < 2) return []
  const asked = parts.slice(1).join("/")
  return [`src/${asked}.rs`, `src/${asked}/mod.rs`]
}

/**
 * The files a path inside the repository could be, before anything is checked.
 *
 * Split out from {@link couldBe} because a relative specifier is not the only
 * way to arrive at a path with no ending on it. A package this repository holds
 * itself resolves to a folder and a path inside it — `@org/type-utils` at
 * `packages/type-utils`, imported as `@org/type-utils/result-monad`, means
 * `packages/type-utils/result-monad` and whatever that file is really called.
 * That path was being handed on with no ending at all, so it matched no file in
 * the repository and the answer fell through to the first Writing of that name
 * anywhere — a different thing with the same spelling, offered as the place.
 */
export const endingsFor = (asked: string): ReadonlyArray<string> => {
  if (asked === "") return []

  // A path that already names its ending is taken as written. TypeScript's own
  // `.js`-means-`.ts` rule is the one exception worth keeping, because every
  // ES-module TypeScript repository is written that way.
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

/**
 * The file a path inside the repository names, out of the paths that exist.
 *
 * {@link reaching} for a path that is already a path — arrived at through a
 * package's own folder rather than through a specifier relative to a file.
 * Nothing where the repository holds no such file, so a path built from a
 * package's layout is checked before it is believed, like every other answer
 * here.
 */
export const within = (path: string, paths: ReadonlySet<string>): string | null =>
  endingsFor(plainly(path) ?? "").find((one) => paths.has(one)) ?? null

/**
 * Where a package's build output is written, and where its source is kept.
 *
 * A judgement about convention rather than a rule about anything, which is why
 * it is a short list and not a clever one: these are the folder names a
 * TypeScript package actually uses, and a name that is not here costs the
 * reader what they had before.
 */
const BUILT: ReadonlyArray<string> = ["dist", "build", "out", "lib", "esm", "cjs"]
const SOURCE = "src"

/**
 * Where a file of a package this repository holds might really be.
 *
 * A package's own `package.json` answers about what it *ships*, and a
 * repository holds what it *wrote*. Those are the same path in a package with
 * no build step and different paths in every package with one — measured on a
 * real monorepo, where `@org/shared` says its `./schemas` is
 * `./dist/schemas/index.js` and the file a reader wants is
 * `packages/shared/src/schemas/index.ts`. Following the manifest alone reached
 * one of seven imports; nothing in `dist` is in the repository at all.
 *
 * So both readings are offered, best first, and the caller checks each against
 * the files the repository really has. A deep import names a path inside the
 * package, which is either directly in its folder or under its source root; an
 * entry names a built file, whose source is the same path with the build folder
 * read as the source one.
 */
export const inPackage = (
  at: string,
  deeper: string | null,
  entry: string | null
): ReadonlyArray<string> => {
  const folder = at === "" ? "" : `${at}/`

  if (deeper !== null) return [`${folder}${deeper}`, `${folder}${SOURCE}/${deeper}`]
  if (entry === null) return []

  const asSource = BUILT.reduce(
    (path, built) => path.replace(`/${built}/`, `/${SOURCE}/`),
    entry
  )
  return asSource === entry ? [entry] : [entry, asSource]
}
