/**
 * The Ledger's three questions, answered where a grammar may be compiled.
 *
 * One message in, one answer out, and the parsing between them. Nothing here
 * decides anything about a Name — `src/ledger/writings.ts` does that, purely,
 * and is tested against the real grammar under `bun test` with none of this
 * around it.
 */

import { Effect } from "effect"
import { filesIn, unzipped } from "@/ledger/archive"
import { blobSha } from "@/ledger/blob"
import { dialectFor } from "@/ledger/dialects"
import { byPath, manifestOf, stillToRead, whollyKnown, type Named } from "@/ledger/keeping"
import { everyPlace, kept, keyOf, placesFor, worthReading, type Kept } from "@/ledger/ledger"
import {
  heldIn as packagesIn,
  mightBe,
  nameOf,
  withinPackage,
  type Held
} from "@/ledger/packages"
import { inPackage, knowGoModules, within } from "@/ledger/reaching"
import { goModulesIn } from "@/ledger/goModules"
import { asking, publishedAt } from "@/ledger/registry"
import { heldIn, holdIn, holdingOf } from "@/ledger/holding"
import { idbStore, noStore, type Store } from "@/ledger/store"
import { usesAcross, type Asked } from "@/ledger/uses"
import type { Exact } from "@/ledger/exact"
import { parsed, ready, readyFor, reader, type Shelf } from "@/ledger/parse"
import { findingFile } from "@/domain/findingFile"
import {
  isLedgerAcrossWork,
  isLedgerBeyondWork,
  isLedgerReadyWork,
  isLedgerNamesWork,
  isLedgerWarmWork,
  isLedgerWork,
  LEDGER_ANSWER,
  type LedgerAnswer,
  type LedgerAcross,
  type LedgerAcrossWork,
  type LedgerBeyondWork,
  type LedgerFound,
  LEDGER_WARM_WORK,
  type LedgerNamesWork,
  type LedgerPlaces,
  type LedgerWarmth,
  type LedgerWarmWork,
  type LedgerWork
} from "@/ledger/protocol"
import {
  toldBy,
  usesIn,
  writingAt,
  writingNamed,
  writingsIn,
  type Told,
  type Writing
} from "@/ledger/writings"
import type { Repo, Spot } from "@/ports/Ledger"
import { onward } from "@/observability/report"

const shelf = (): Shelf => {
  const getURL = browser.runtime.getURL as (path: string) => string
  return {
    runtime: getURL("/ledger/web-tree-sitter.wasm"),
    grammar: (file) => getURL(`/ledger/${file}`)
  }
}

/**
 * The compiler's answer to where a name is written, where there is one.
 *
 * Tried before the shapes, and falling through to them where it has nothing:
 * the tier is built after the reading and may not be ready, the file may be in
 * a language it does not compile, and a name in a dependency resolves to
 * nothing because an archive carries no `node_modules`.
 *
 * What it adds is the question the shapes cannot answer at all — a method call,
 * whose meaning is the type of the thing it is called on.
 */
const exactWriting = (work: LedgerWork, at: Spot): Writing | null => {
  if (work.owner === undefined || work.repo === undefined || work.sha === undefined) return null

  const key = keyOf({ owner: work.owner, repo: work.repo }, work.sha)
  const exact = exactness?.at === key ? exactness.exact : null
  if (exact === null) return null

  const found = exact.definitionAt({
    path: `/${work.path}`,
    line: at.row + 1,
    column: at.column
  })
  if (found === null) return null

  const path = found.path.replace(/^\//, "")
  return {
    name: found.name,
    kind: kindOfExact(found.kind),
    line: found.line,
    from: found.column + 1,
    to: found.column + 1 + found.name.length,
    signature: found.signature,
    doc: null,
    sure: true,
    exact: true,
    ...(path === work.path ? {} : { path })
  }
}

/** The compiler's word for what a thing is, in this codebase's own words. */
const kindOfExact = (kind: string): Writing["kind"] => {
  if (kind === "method" || kind === "property" || kind === "getter" || kind === "setter") {
    return "member"
  }
  if (kind === "class") return "class"
  if (kind === "interface" || kind === "type" || kind === "enum") return "type"
  if (kind === "function" || kind === "local function") return "function"
  if (kind === "parameter") return "parameter"
  if (kind === "alias") return "import"
  return "value"
}

const answer = (work: LedgerWork): Effect.Effect<LedgerAnswer> =>
  parsed(shelf(), work.path, work.text, (root): LedgerAnswer => {
    const question = work.question
    // A grammar with no vocabulary parses a file nobody can ask about. It is the
    // same answer as no grammar, said where the difference could arise.
    const dialect = dialectFor(work.path)
    if (dialect === null) return { kind: LEDGER_ANSWER, why: "no grammar for this file" }
    if (question.of === "writingAt") {
      // The compiler first, where there is one: it answers questions the shapes
      // cannot, and answers the rest of them better.
      const exact = exactWriting(work, question.at)
      if (exact !== null) return { kind: LEDGER_ANSWER, writing: exact }

      const answer = writingAt(root, work.text, question.at, dialect)
      if (answer === null) return { kind: LEDGER_ANSWER, writing: null }
      return answer.at === "here"
        ? { kind: LEDGER_ANSWER, writing: answer.writing }
        : {
            kind: LEDGER_ANSWER,
            writing: null,
            borrowed: answer.borrowed,
            ...(answer.orFrom === undefined ? {} : { orFrom: answer.orFrom })
          }
    }
    if (question.of === "writingNamed") {
      return {
        kind: LEDGER_ANSWER,
        writing: writingNamed(root, work.text, question.name, dialect)
      }
    }
    if (question.of === "usesIn") {
      return { kind: LEDGER_ANSWER, uses: usesIn(root, work.text, question.writing, dialect) }
    }
    return { kind: LEDGER_ANSWER, writings: writingsIn(root, work.text, dialect) }
  }).pipe(
    Effect.map(
      (found) =>
        found ?? ({ kind: LEDGER_ANSWER, why: "no grammar for this file" } satisfies LedgerAnswer)
    ),
    // A parse that threw is a file this cannot answer about, which is the same
    // to a reader as a language nothing here speaks: the file reads exactly as
    // it does today. What it must not be is an unhandled rejection in a document
    // nobody is looking at.
    Effect.catch((cause) =>
      Effect.succeed({ kind: LEDGER_ANSWER, why: String(cause) } satisfies LedgerAnswer)
    )
  )

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isLedgerReadyWork(message)) {
    // Nothing is parsed and nothing is answered: the runtime and the grammar
    // this file would need, fetched and compiled before anybody asks.
    return Effect.runPromise(
      readyFor(shelf(), message.path).pipe(
        Effect.as({ ready: true }),
        Effect.catch(() => Effect.succeed({ ready: false }))
      )
    )
  }
  if (!isLedgerWork(message)) return undefined

  return Effect.runPromise(answer(message))
})


/**
 * The Ledgers this document is holding, newest read last.
 *
 * More than one, because a reader moves between repositories and the one they
 * came back to should not have to be read again. Three, which is a guess at how
 * many a person has open at once and is cheap to be wrong about in one
 * direction: what is let go of is on disk, and coming back to it is a list read
 * rather than an archive fetched.
 */
const ledgers = holdingOf<Kept>()

/** How many Ledgers to hold in this document, and how many commits to keep on disk. */
const IN_MEMORY = 3
const ON_DISK = 20

const holding = (at: string): Kept | undefined => heldIn(ledgers, at)
const hold = (built: Kept): void => holdIn(ledgers, built.at, built, IN_MEMORY)

/**
 * The exact tier, where a reader has asked for one.
 *
 * One at a time, and lazily: it is nine megabytes of compiler and a second of
 * work, and every question is answerable without it. What it adds is the
 * questions types are needed for — `thing.method()`, and telling a method from
 * an unrelated name that merely shares its spelling.
 *
 * Held beside the Ledger rather than inside it, because it is built after and
 * may never be built at all. A question asked before it is ready is answered by
 * the tier below, which is the whole point of having two.
 */
let exactness: { readonly at: string; readonly exact: Exact } | null = null
let buildingExact: string | null = null

/** The compiler, fetched once. Nine megabytes that most reading never needs. */
let engine: Effect.Effect<typeof import("@/ledger/exact"), unknown> | undefined

const exactEngine = (): Effect.Effect<typeof import("@/ledger/exact"), unknown> => {
  const getURL = browser.runtime.getURL as (path: string) => string
  engine ??= Effect.tryPromise({
    try: () => import(/* @vite-ignore */ getURL("/exact.js")),
    catch: (cause) => cause
  }).pipe(Effect.cached, Effect.runSync)
  return engine
}

/** The standard library, without which nothing in a program resolves. */
let libs: Effect.Effect<ReadonlyMap<string, string>, unknown> | undefined

const standardLibrary = (): Effect.Effect<ReadonlyMap<string, string>, unknown> => {
  const getURL = browser.runtime.getURL as (path: string) => string
  libs ??= Effect.gen(function* () {
    const listed = yield* Effect.tryPromise({
      try: () => fetch(getURL("/exact/libs.json")),
      catch: (cause) => cause
    })
    const names = yield* Effect.tryPromise({
      try: () => listed.json(),
      catch: (cause) => cause
    })

    const held = new Map<string, string>()
    yield* Effect.forEach(
      names as ReadonlyArray<string>,
      (name) =>
        Effect.tryPromise({
          try: () => fetch(getURL(`/exact/${name}`)),
          catch: (cause) => cause
        }).pipe(
          Effect.flatMap((answer) =>
            Effect.tryPromise({ try: () => answer.text(), catch: (cause) => cause })
          ),
          Effect.map((text) => held.set(`/${name}`, text))
        ),
      { concurrency: 8, discard: true }
    )
    return held as ReadonlyMap<string, string>
  }).pipe(Effect.cached, Effect.runSync)
  return libs
}

/**
 * Builds the exact tier for a repository, in the background, once.
 *
 * Nothing waits for it. The warm that started it has already answered, the
 * screens are already being answered by the tier below, and when this lands the
 * answers quietly get better — a Likely becomes a Sure, and a method call starts
 * resolving.
 */
const beExact = (at: string, files: ReadonlyMap<string, string>): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (exactness?.at === at || buildingExact === at) return
    buildingExact = at

    const { exactly, readable, MOST_FILES } = yield* exactEngine()

    const wanted = new Map<string, string>()
    for (const [path, text] of files) if (readable(path)) wanted.set(`/${path}`, text)

    // Past the cap, the tier below answers — which it was doing anyway while
    // this was being built. See `MOST_FILES` for the measurements behind it.
    if (wanted.size > MOST_FILES) return

    const library = yield* standardLibrary()
    exactness = { at, exact: exactly(wanted, library) }
  }).pipe(
    Effect.catch(onward),
    Effect.ensuring(
      Effect.sync(() => {
        buildingExact = null
      })
    )
  )

/** The archive again, for a repository whose Ledger came off disk without it. */
const exactFrom = (work: LedgerWarmWork, at: string): Effect.Effect<void> =>
  archive(work.owner, work.repo, work.sha).pipe(
    Effect.flatMap((bytes) => beExact(at, filesIn(bytes))),
    Effect.catch(onward)
  )

/**
 * What each repository is made of, kept apart from its Ledger.
 *
 * A Ledger can come back off disk without ever seeing a `package.json` — that
 * is not a file anything here parses, so nothing was kept about it. This is the
 * small thing that has to survive anyway, because a bare specifier cannot be
 * resolved without it.
 */
const holdingPackages = new Map<string, ReadonlyMap<string, Held>>()

/** The Go modules each repository declares, module to folder. See `src/ledger/goModules.ts`. */
const holdingModules = new Map<string, ReadonlyMap<string, string>>()

/** What is being read now, so two asks do not read a repository twice. */
let warming: { readonly at: string; readonly work: Effect.Effect<LedgerWarmth> } | null = null

/**
 * Where a Ledger is kept between visits.
 *
 * IndexedDB, unless this browser has none — in which case nothing is kept and
 * every visit reads the repository, which is what this feature did before any
 * of it was written and is slower rather than broken.
 */
const store: Store = typeof indexedDB === "undefined" ? noStore : idbStore

/**
 * The archive, on the session this browser already has.
 *
 * Credentials first, because a private repository needs the cookie to be given
 * the signed redirect at all. Without, second: `codeload` refuses a request that
 * carries one, and a public repository is reached either way — so the pair is
 * tried rather than the right one being guessed at from the repository's
 * visibility, which this does not know.
 */
const archive = (owner: string, repo: string, sha: string): Effect.Effect<Uint8Array, unknown> => {
  const url = `https://github.com/${owner}/${repo}/archive/${sha}.tar.gz`

  const asked = (credentials: RequestCredentials) =>
    Effect.tryPromise({
      try: () => fetch(url, { credentials }),
      catch: (cause) => cause
    }).pipe(
      Effect.flatMap((response) =>
        response.ok && response.body !== null
          ? unzipped(response.body)
          : Effect.fail(`HTTP ${response.status} for the archive`)
      )
    )

  return asked("include").pipe(Effect.catch(() => asked("omit")))
}

/** Every file of the archive worth reading, under git's name for its contents. */
const namesFor = (files: ReadonlyMap<string, string>): Effect.Effect<ReadonlyArray<Named>, unknown> =>
  Effect.forEach(
    [...files].filter(([path, text]) => worthReading(path, text)),
    ([path, text]) => blobSha(text).pipe(Effect.map((sha) => ({ path, sha, text }))),
    { concurrency: 8 }
  )

/**
 * A repository read, off disk where it can be and off the network where it
 * cannot.
 *
 * Three ways this ends, cheapest first:
 *
 *   1. The commit is on disk whole. Nothing is fetched and nothing is parsed —
 *      a list of forty-character names, and what each one says.
 *   2. The commit is new but its files are not. A push touched four files; the
 *      other four hundred already have sayings under the names they still have.
 *   3. Nothing is known. The archive, once.
 */
const read = (work: LedgerWarmWork, at: string): Effect.Effect<LedgerWarmth> =>
  Effect.gen(function* () {
    const where = shelf()
    yield* ready(where)
    const outline = yield* reader(where, (root, text, path) => {
      // A grammar without a vocabulary reads nothing here, the same as no
      // grammar at all — see `src/ledger/dialects.ts`.
      const dialect = dialectFor(path)
      return dialect === null ? null : toldBy(root, text, dialect)
    })

    const manifest = yield* store.manifest(at).pipe(Effect.catch(() => Effect.succeed(null)))

    if (manifest !== null) {
      const known = yield* store
        .told(manifest.files.map(([, sha]) => sha))
        .pipe(Effect.catch(() => Effect.succeed(new Map<string, Told>())))

      if (whollyKnown(manifest, known)) {
        const files = byPath(manifest, known)
        if (manifest.goModules !== undefined) holdingModules.set(at, new Map(manifest.goModules))
        // A Ledger off disk knows what the files say and not what the
        // repository is made of: a `package.json` is not a file this parses, so
        // nothing kept it. Reading them again is one archive, and only a reader
        // who follows a bare specifier ever pays for it — see `packagesFor`.
        hold(kept(at, files, 0, holdingPackages.get(at) ?? new Map()))
        // The exact tier needs the files themselves, which a manifest does not
        // carry. Answering off disk is the fast path and stays the fast path;
        // a reader who asked for exactness pays one archive for it.
        if (work.exact === true) yield* Effect.forkDetach(exactFrom(work, at))
        yield* store
          .keepManifest({ ...manifest, seen: Date.now() })
          .pipe(Effect.catch(onward))
        return {
          ready: true,
          read: files.size,
          skipped: 0,
          kept: true,
          exactReady: exactness?.at === at
        } satisfies LedgerWarmth
      }
    }

    const bytes = yield* archive(work.owner, work.repo, work.sha)
    const whole = filesIn(bytes)
    const named = yield* namesFor(whole)

    const already = yield* store
      .told(named.map((one) => one.sha))
      .pipe(Effect.catch(() => Effect.succeed(new Map<string, Told>())))

    const toRead = stillToRead(named, new Set(already.keys()))
    const fresh = new Map<string, Told>()
    for (const file of toRead) {
      const told = outline(file.path, file.text)
      if (told !== null) fresh.set(file.sha, told)
    }

    const known = new Map([...already, ...fresh])
    // Only the files something could be said about. A `.md` has no grammar
    // here, and a commit's manifest that named it would be a commit that could
    // never be answered off disk.
    const held = named.filter((one) => known.has(one.sha))

    const files = new Map<string, Told>()
    for (const one of held) {
      const told = known.get(one.sha)
      if (told !== undefined) files.set(one.path, told)
    }

    const packages = packagesIn(whole)
    holdingPackages.set(at, packages)
    const modules = goModulesIn(whole)
    holdingModules.set(at, modules)
    hold(kept(at, files, whole.size - files.size, packages))

    // After the answer, never before it. The tier below is already answering,
    // and this is a second of work that makes those answers better.
    if (work.exact === true) yield* Effect.forkDetach(beExact(at, whole))

    yield* store.keepTold(fresh).pipe(Effect.catch(onward))
    yield* store
      .keepManifest(manifestOf(at, held, Date.now(), modules))
      .pipe(Effect.catch(onward))
    yield* store.forgetBeyond(ON_DISK).pipe(Effect.catch(() => Effect.succeed(0)))

    return {
      ready: true,
      read: files.size,
      skipped: whole.size - files.size,
      parsed: fresh.size,
      exactReady: exactness?.at === at
    } satisfies LedgerWarmth
  }).pipe(
    Effect.catch((cause) => Effect.succeed({ ready: false, why: String(cause) } satisfies LedgerWarmth))
  )

const warm = (work: LedgerWarmWork): Effect.Effect<LedgerWarmth> =>
  Effect.gen(function* () {
    const at = keyOf({ owner: work.owner, repo: work.repo }, work.sha)

    const found = holding(at)
    if (found !== undefined) {
      /*
       * Held, and that is the whole answer unless a compiler is wanted and
       * there is not one.
       *
       * A reader turns the knob on while looking at a repository this has
       * already read. Answering "held" and stopping there is what this did, and
       * what it meant was that the setting did nothing at all until the Ledger
       * happened to be let go of — which a measurement caught by finding the
       * same memory held with the compiler on as with it off.
       */
      if (work.exact === true && exactness?.at !== at) {
        yield* Effect.forkDetach(exactFrom(work, at))
      }
      return {
        ready: true,
        read: found.read,
        skipped: found.skipped,
        kept: true,
        exactReady: exactness?.at === at
      }
    }
    // Already on its way. The second asker waits on the first's read rather
    // than starting a second one, which on a large repository is ten megabytes
    // fetched twice.
    if (warming?.at === at) return yield* warming.work

    const reading = read(work, at).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          warming = null
        })
      ),
      Effect.cached,
      Effect.runSync
    )

    warming = { at, work: reading }
    return yield* reading
  })

/**
 * Every name in the repository that the typing names, best first.
 *
 * Ranked by `domain/findingFile.ts`, which is what ranks paths in Go to File
 * and names in the outline. One set of rules for every box a reader types a
 * name into.
 */
const named = (work: LedgerNamesWork): LedgerPlaces => {
  const ledger = holding(keyOf({ owner: work.owner, repo: work.repo }, work.sha))
  if (ledger === undefined) return { places: [], ready: false }

  const places = everyPlace(ledger)
  if (work.query.trim() === "") {
    return { places: places.slice(0, work.most ?? 50), ready: true }
  }

  const wanted = new Map<string, Array<(typeof places)[number]>>()
  for (const place of places) {
    const held = wanted.get(place.writing.name)
    if (held === undefined) wanted.set(place.writing.name, [place])
    else held.push(place)
  }

  const ranked = findingFile([...wanted.keys()], work.query, work.most ?? 50)
  return {
    places: ranked.flatMap((found) => wanted.get(found.path) ?? []).slice(0, work.most ?? 50),
    ready: true
  }
}

/** Everywhere in the repository that means one Writing. */
const across = (work: LedgerAcrossWork): LedgerAcross => {
  const at = keyOf({ owner: work.owner, repo: work.repo }, work.sha)
  const ledger = holding(at)
  if (ledger === undefined) return { uses: [], ready: false }

  /*
   * The exact tier where there is one, and it answers a different question:
   * not "which files hold this word" but "which of them mean this thing". Every
   * answer it gives is Sure, and the ones it leaves out are the ones the tier
   * below would have offered as Likely and been wrong about.
   */
  const exact = exactness?.at === at ? exactness.exact : null
  if (exact !== null) {
    const found = exact.usesAt({ path: `/${work.path}`, line: work.line, column: work.column ?? 0 })
    if (found.length > 0) {
      return {
        ready: true,
        exact: true,
        uses: found.slice(0, work.most ?? 200).map((one) => ({
          path: one.path.replace(/^\//, ""),
          line: one.line,
          from: one.column + 1,
          to: one.column + 1 + work.name.length,
          sure: true
        }))
      }
    }
  }

  const asked: Asked = { name: work.name, path: work.path, line: work.line }
  const paths = new Set(ledger.files.keys())
  // A Go import is read against the modules the repository declares, where known.
  const modules = holdingModules.get(at)
  if (modules !== undefined) knowGoModules(paths, modules)
  return {
    uses: usesAcross(ledger.files, asked, paths, work.most ?? 200),
    ready: true
  }
}

/**
 * One small file from any repository, without reading the whole of it.
 *
 * `package.json` and nothing else: this is how a guess about which repository a
 * package is gets checked before an archive is fetched on the strength of it.
 * The raw route answers the text and redirects to a host that allows any origin
 * to read it, which is the same arrangement `GitHubGateway.rawFileAt` relies on.
 */
const smallFile = (repo: Repo, ref: string, path: string): Effect.Effect<string, unknown> =>
  Effect.tryPromise({
    try: () => fetch(`https://github.com/${repo.owner}/${repo.repo}/raw/${ref}/${path}`),
    catch: (cause) => cause
  }).pipe(
    Effect.flatMap((answer) =>
      answer.ok
        ? Effect.tryPromise({ try: () => answer.text(), catch: (cause) => cause })
        : Effect.fail(`HTTP ${answer.status} for ${path}`)
    )
  )

/**
 * Where a name borrowed from a package is written.
 *
 * Three ways, and the first costs nothing: a package this repository holds
 * itself is a path in the archive already read. Past that it is a guess about
 * which repository the package is, checked against that repository's own
 * `package.json` before anything is followed into it — a guess that is wrong
 * costs one small file and is never shown to a reader.
 *
 * What comes back is an address rather than a Writing, because the file it names
 * is in another repository and this extension already draws those: following it
 * is going to a page, which is the same thing pressing a row of a tree does.
 */
const beyond = (work: LedgerBeyondWork): Effect.Effect<LedgerFound> =>
  Effect.gen(function* () {
    const from: Repo = { owner: work.owner, repo: work.repo }
    const at = keyOf(from, work.sha)
    const ledger = holding(at)

    // Its own, which is most monorepos and costs no request at all.
    const own = ledger?.packages.get(packageOf(work.specifier))
    if (own !== undefined) {
      /*
       * Where that file really is, checked against what the repository holds.
       *
       * A deep import names a path inside the package and not a file, and a
       * package's manifest answers about what it ships rather than what the
       * repository wrote. `@org/type-utils/result-monad` is
       * `packages/type-utils/result-monad`, with no ending on it; `@org/shared`
       * says its `./schemas` is `./dist/schemas/index.js`, and nothing in
       * `dist` is in the repository at all.
       *
       * Both were handed on as written, matched no file, and the answer fell
       * through to the first Writing of that name anywhere in the repository —
       * a different thing with the same spelling, offered to the reader as the
       * place it is written. Which is the one mistake this feature exists to
       * prevent, and it was being made silently.
       */
      const deeper = withinPackage(work.specifier)
      const paths = ledger === undefined ? null : new Set(ledger.files.keys())
      const found = paths === null
        ? null
        : inPackage(own.at, deeper, own.entry)
            .map((one) => within(one, paths))
            .find((one) => one !== null) ?? null
      const path =
        found ?? (deeper === null ? own.entry : `${own.at === "" ? "" : `${own.at}/`}${deeper}`)
      if (path !== null) {
        const found = ledger === undefined ? [] : placesFor(ledger, work.name)
        const here = found.find((one) => one.path === path) ?? found[0]
        return {
          here: true,
          owner: work.owner,
          repo: work.repo,
          ref: work.sha,
          path: here?.path ?? path,
          line: here?.writing.line ?? 1,
          name: work.name,
          signature: here?.writing.signature ?? ""
        }
      }
    }

    // Somebody else's, and each guess is checked before it is believed.
    for (const guess of mightBe(work.specifier, from)) {
      const said = yield* smallFile(guess, "HEAD", "package.json").pipe(
        Effect.catch(() => Effect.succeed(null))
      )
      if (said === null) continue
      if (nameOf(said) !== packageOf(work.specifier)) continue

      // The guess held. Reading that repository is one archive, and it is kept
      // exactly as this one is — so the second name followed into it is free.
      const theirs = keyOf(guess, "HEAD")
      yield* warm({
        kind: LEDGER_WARM_WORK,
        owner: guess.owner,
        repo: guess.repo,
        sha: "HEAD"
      })

      const found = placesFor(holding(theirs) ?? emptyLedger(theirs), work.name)
      const first = found[0]
      if (first === undefined) continue

      return {
        owner: guess.owner,
        repo: guess.repo,
        ref: "HEAD",
        path: first.path,
        line: first.writing.line,
        name: work.name,
        signature: first.writing.signature
      }
    }

    /*
     * And last, the registry — where the reader has said it may be asked.
     *
     * The tiers above cost nothing and reach a package this repository holds,
     * and one whose name says which repository it is. What neither reaches is a
     * package nobody named after its owner: `react` is not `yourorg/react`, and
     * no guess made from the name will ever say `facebook/react`.
     *
     * A registry knows, because a package says where it was written when it is
     * published — and says which folder of that repository it sits in, so
     * `scheduler` leads to `packages/scheduler` rather than to the root of
     * `react`. The cost is a request carrying the name of a package this
     * repository depends on, which is why it is the reader's to turn on and is
     * off until they do. `docs/spec/following.md` has the rest of that.
     */
    if (work.registry === true) {
      const said = yield* Effect.tryPromise({
        try: () => fetch(asking(packageOf(work.specifier))),
        catch: (cause) => cause
      }).pipe(
        Effect.flatMap((answer) =>
          answer.ok
            ? Effect.tryPromise({ try: () => answer.text(), catch: (cause) => cause })
            : Effect.fail(`HTTP ${answer.status} from the registry`)
        ),
        Effect.catch(() => Effect.succeed(null))
      )

      const published = said === null ? null : publishedAt(said)
      if (published !== null) {
        const theirs = keyOf(published.repo, "HEAD")
        yield* warm({
          kind: LEDGER_WARM_WORK,
          owner: published.repo.owner,
          repo: published.repo.repo,
          sha: "HEAD"
        })

        /*
         * Inside the folder the package named, where it named one.
         *
         * A repository of forty packages holds forty Writings of some names,
         * and the one that matters is the one in this package. Taking the
         * first anywhere would be answering about `react` when the question
         * was about `scheduler`.
         */
        const found = placesFor(holding(theirs) ?? emptyLedger(theirs), work.name)
        const inside = published.directory
        const first =
          inside === undefined
            ? found[0]
            : found.find((one) => one.path.startsWith(`${inside}/`)) ?? found[0]

        if (first !== undefined) {
          return {
            owner: published.repo.owner,
            repo: published.repo.repo,
            ref: "HEAD",
            path: first.path,
            line: first.writing.line,
            name: work.name,
            signature: first.writing.signature
          }
        }
      }
    }

    return { why: "no repository answers to that package" }
  }).pipe(Effect.catch((cause) => Effect.succeed({ why: String(cause) })))

/** The package a specifier names, with any path inside it taken off. */
const packageOf = (specifier: string): string => {
  const parts = specifier.split("/")
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier)
}

const emptyLedger = (at: string): Kept =>
  kept(at, new Map(), 0, new Map())

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isLedgerWarmWork(message)) return Effect.runPromise(warm(message))
  if (isLedgerBeyondWork(message)) return Effect.runPromise(beyond(message))
  if (isLedgerNamesWork(message)) return Effect.runPromise(Effect.sync(() => named(message)))
  if (isLedgerAcrossWork(message)) return Effect.runPromise(Effect.sync(() => across(message)))
  return undefined
})
