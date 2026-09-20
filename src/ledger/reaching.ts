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
export const couldBe = (
  from: string,
  specifier: string,
  paths: ReadonlySet<string>,
  /**
   * The name that was borrowed, for the three languages whose specifier is not
   * the whole address.
   *
   * A Java import names a type — `import com.ex.shapes.Box` — and this file
   * records `Box` as the name and `com.ex.shapes` as where it came from, which
   * reads well and is half a path. PHP and C# split the same way. So the name is
   * put back on the end before a path is built from it, and every other language
   * ignores it because its specifier already names the file.
   */
  name?: string
): ReadonlyArray<string> => {
  const resolver = RESOLVERS[extensionOf(from) ?? ""]
  return (resolver ?? couldBeTypeScript)({ from, specifier, paths, name })
}

/** What every resolver is handed, so that each takes only what it needs. */
type Asked = {
  readonly from: string
  readonly specifier: string
  readonly paths: ReadonlySet<string>
  readonly name?: string
}

/**
 * Which resolver reads a file's specifiers, by the extension it is written under.
 *
 * Keyed the same way `src/ledger/dialects.ts` keys its vocabularies, and for the
 * same reason: a language's rules belong in one place, read off a table somebody
 * can check against the language. A file whose extension is not here is read as
 * TypeScript, which is what every other extension meant before any of these.
 *
 * `dialects.test.ts` holds this list against that one, so the two cannot drift
 * into a file that parses and resolves nothing, or resolves and parses nothing.
 */
const RESOLVERS: Readonly<Record<string, (asked: Asked) => ReadonlyArray<string>>> = {
  ts: couldBeTypeScript,
  mts: couldBeTypeScript,
  cts: couldBeTypeScript,
  tsx: couldBeTypeScript,
  js: couldBeTypeScript,
  mjs: couldBeTypeScript,
  cjs: couldBeTypeScript,
  jsx: couldBeTypeScript,
  py: couldBePython,
  pyi: couldBePython,
  rs: couldBeRust,
  rb: couldBeRuby,
  go: couldBeGo,
  java: couldBeJava,
  php: couldBePhp,
  cs: couldBeCSharp,
  c: couldBeCpp,
  h: couldBeCpp,
  cc: couldBeCpp,
  cpp: couldBeCpp,
  cxx: couldBeCpp,
  hpp: couldBeCpp,
  hh: couldBeCpp,
  hxx: couldBeCpp
}

/** The folder a file sits in, which is where every relative specifier starts. */
const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")))

/** What a relative specifier names, which is a path with its ending left off. */
function couldBeTypeScript({ from, specifier }: Asked): ReadonlyArray<string> {
  if (!specifier.startsWith(".")) return []
  const asked = plainly(`${folderOf(from)}/${specifier}`)
  return asked === null ? [] : endingsFor(asked)
}

/**
 * What a `require_relative` names, which is the one exact answer of the four.
 *
 * Ruby says the path itself and leaves off the `.rb`, relative to the file that
 * wrote it. There is nothing to guess: `require_relative "local/helper"` in
 * `app/main.rb` is `app/local/helper.rb` and nothing else.
 *
 * A plain `require` names a gem and never reaches here — `ruby.ts` records only
 * the relative one, because a gem is not a file in this repository.
 */
function couldBeRuby({ from, specifier }: Asked): ReadonlyArray<string> {
  const asked = plainly(`${folderOf(from)}/${specifier}`)
  if (asked === null || asked === "") return []
  return asked.endsWith(".rb") ? [asked] : [`${asked}.rb`]
}

/**
 * What a quoted `#include` names.
 *
 * The path as written, tried against the folder the including file sits in and
 * then against the places a repository keeps headers. Quoted rather than angled
 * is the whole of what makes it this repository's — `cpp.ts` records only the
 * quoted ones, because angle brackets mean the compiler's own search path.
 *
 * The path keeps its ending: C++ writes it, where every other language here
 * leaves it off.
 */
function couldBeCpp({ from, specifier }: Asked): ReadonlyArray<string> {
  const beside = plainly(`${folderOf(from)}/${specifier}`)
  const plain = plainly(specifier)
  const asked: Array<string> = []
  for (const one of [beside, plain]) {
    if (one !== null && one !== "" && !asked.includes(one)) asked.push(one)
  }
  if (plain !== null && plain !== "") {
    for (const root of ["include", "src", "lib"]) {
      const under = `${root}/${plain}`
      if (!asked.includes(under)) asked.push(under)
    }
  }
  return asked
}

/**
 * What a Java import names, as a path.
 *
 * A package is a folder and a type is a file, so `com.example.app.Box` is
 * `com/example/app/Box.java` — under one of the roots a build tool puts sources
 * in. Maven and Gradle both use `src/main/java`, a module of either prefixes it
 * with the module's own folder, and a repository with no build tool at all
 * writes the package straight off the root.
 *
 * `import java.util.List` reaches nothing, which is right: it is the standard
 * library, and no root here holds it.
 */
function couldBeJava({ specifier, name }: Asked): ReadonlyArray<string> {
  const whole = named(specifier, name, ".")
  const asked = whole.split(".").filter((part) => part !== "").join("/")
  if (asked === "") return []
  return JAVA_ROOTS.map((root) => (root === "" ? `${asked}.java` : `${root}/${asked}.java`))
}

/**
 * A specifier with the name it brought in put back on the end.
 *
 * Nothing is added for `*` or `default`, which name no type and are how a
 * whole-file borrow is written here.
 */
const named = (specifier: string, name: string | undefined, separator: string): string => {
  if (name === undefined || name === "*" || name === "default") return specifier
  if (specifier === "") return name
  // Always put it back. A guard against a specifier that already ends in the
  // name looks like a safety net and is a trap: every caller records the
  // specifier with `pathBefore`, which has already taken the last segment off,
  // so the only thing the guard caught was a namespace whose last segment
  // happens to match the type — and `App\Thing\Thing` is an ordinary class.
  return `${specifier}${separator}${name}`
}

/** Where a build tool puts Java sources, tried in this order. */
const JAVA_ROOTS: ReadonlyArray<string> = [
  "src/main/java",
  "src",
  "",
  "app/src/main/java",
  "lib/src/main/java",
  "core/src/main/java"
]

/**
 * What a PHP `use` names, as a path.
 *
 * PSR-4 says a namespace is a folder and a class is a file, and that a prefix of
 * the namespace maps to a source root — `App\Other\Thing` is `src/Other/Thing.php`
 * where `App\` is mapped to `src/`. The mapping lives in `composer.json`, which
 * is not read here, so every shape it usually takes is offered and the one the
 * repository really holds is the one that answers.
 */
function couldBePhp({ specifier, name }: Asked): ReadonlyArray<string> {
  const parts = named(specifier, name, "\\").split("\\").filter((part) => part !== "")
  if (parts.length === 0) return []
  const whole = parts.join("/")
  const after = parts.slice(1).join("/")

  const asked: Array<string> = [`src/${after}.php`, `src/${whole}.php`, `${whole}.php`]
  if (after !== "") asked.push(`lib/${after}.php`, `app/${after}.php`)
  return asked.filter((one, at) => one !== ".php" && asked.indexOf(one) === at)
}

/**
 * What a C# alias names, as a path.
 *
 * Convention only, and thinner than the others: a namespace in C# is not a
 * folder and may be written across any number of files. What is offered is the
 * shape most projects use anyway — `App.Other.Thing` at `App/Other/Thing.cs` —
 * checked against the paths that exist, so a project laid out any other way
 * reaches nothing rather than reaching the wrong file.
 *
 * Only an aliased `using` arrives here. A plain one opens a namespace and names
 * nothing, so `csharp.ts` records no borrow for it.
 */
function couldBeCSharp({ specifier, name }: Asked): ReadonlyArray<string> {
  const parts = named(specifier, name, ".").split(".").filter((part) => part !== "")
  if (parts.length === 0) return []
  const whole = parts.join("/")
  const after = parts.slice(1).join("/")
  const asked = [`${whole}.cs`, `src/${whole}.cs`]
  if (after !== "") asked.push(`src/${after}.cs`, `${after}.cs`)
  return asked.filter((one, at) => asked.indexOf(one) === at)
}

/**
 * What a Go import names, which is a folder rather than a file.
 *
 * Every other language here imports a file. Go imports a package, and a package
 * is a directory: `example.com/app/shapes` is every `.go` file in `shapes/`, and
 * which of them writes the name asked about is not something the import says.
 * So this answers with all of them, and the caller takes the first that holds
 * the name — which is what {@link reachingAll} is for.
 *
 * The module's own prefix is in `go.mod`, which is not read here. What is done
 * instead is the same guess-and-check the rest of this file does: the longest
 * tail of the import path that is really a folder in this repository is the
 * folder meant. `example.com/app/shapes` tries `example.com/app/shapes`, then
 * `app/shapes`, then `shapes`, and stops at the first that holds a `.go` file.
 *
 * A test file is left out. `_test.go` is compiled into the package and a reader
 * following a name wants where it is written, not where it is exercised.
 */
function couldBeGo({ specifier, paths }: Asked): ReadonlyArray<string> {
  const parts = specifier.split("/").filter((part) => part !== "")
  if (parts.length === 0) return []

  const packages = goPackages(paths)
  for (let at = 0; at < parts.length; at++) {
    const inside = packages.get(parts.slice(at).join("/"))
    if (inside !== undefined) return inside
  }
  return []
}

/**
 * Every folder of Go in a repository, by the folder's own path.
 *
 * Worked out once per set of paths rather than once per import. `reaches` asks
 * about every borrow of every file when it counts the uses of a name, and a
 * sweep that read the whole path list on each of those was the length of the
 * repository times the number of imports in it — 20,000 paths and a thousand
 * asks is several seconds of walking a list to find the same answers again.
 *
 * Held against the set itself, which a sweep keeps for its length and drops
 * afterwards, so nothing here outlives the reading it was built for.
 *
 * A test file is left out. `_test.go` is compiled into the package and a reader
 * following a name wants where it is written, not where it is exercised.
 */
const GO_PACKAGES = new WeakMap<ReadonlySet<string>, ReadonlyMap<string, ReadonlyArray<string>>>()

const goPackages = (paths: ReadonlySet<string>): ReadonlyMap<string, ReadonlyArray<string>> => {
  const held = GO_PACKAGES.get(paths)
  if (held !== undefined) return held

  const folders = new Map<string, Array<string>>()
  for (const path of paths) {
    if (!path.endsWith(".go") || path.endsWith("_test.go")) continue
    const slash = path.lastIndexOf("/")
    if (slash === -1) continue
    const folder = path.slice(0, slash)
    const inside = folders.get(folder)
    if (inside === undefined) folders.set(folder, [path])
    else inside.push(path)
  }
  for (const inside of folders.values()) inside.sort()

  GO_PACKAGES.set(paths, folders)
  return folders
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
function couldBePython({ from, specifier }: Asked): ReadonlyArray<string> {
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
function couldBeRust({ specifier }: Asked): ReadonlyArray<string> {
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
 * The one path a specifier names, out of the paths that exist, or nothing.
 *
 * The first of {@link reachingAll}. Nothing in the interface uses it — both
 * callers want every candidate — and it stays because a test that means "this
 * specifier is that file" should be able to say so in one line.
 *
 * Nothing is the answer for a dependency, for a specifier that resolves out of
 * the repository, and for a file the tree has never heard of. All three leave
 * the reader with no underline, which is what they had before.
 */
export const reaching = (
  from: string,
  specifier: string,
  paths: ReadonlySet<string>,
  name?: string
): string | null => reachingAll(from, specifier, paths, name)[0] ?? null

/** The extensions a specifier can be resolved for, for a test that holds two lists together. */
export const RESOLVES: ReadonlySet<string> = new Set(Object.keys(RESOLVERS))

/**
 * Every file a specifier could be, out of the paths that exist, best first.
 *
 * One answer is enough for a language whose import names a file, which is most
 * of them. Go's names a folder, and which file in it writes the name asked
 * about is not something the import says — so the caller is given all of them
 * and takes the first that holds the name.
 *
 * Capped, because a Go package can be thirty files and a reader pressing a name
 * should not cost thirty reads. The cap is generous next to a real package and
 * small next to a directory somebody has let grow.
 */
export const reachingAll = (
  from: string,
  specifier: string,
  paths: ReadonlySet<string>,
  name?: string,
  most = 12
): ReadonlyArray<string> =>
  couldBe(from, specifier, paths, name)
    .filter((path) => paths.has(path))
    .slice(0, most)

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
