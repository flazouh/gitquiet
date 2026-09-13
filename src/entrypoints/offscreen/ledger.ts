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
import { byPath, manifestOf, stillToRead, whollyKnown, type Named } from "@/ledger/keeping"
import { everyPlace, kept, keyOf, worthReading, type Kept } from "@/ledger/ledger"
import { heldIn, holdIn, holdingOf } from "@/ledger/holding"
import { idbStore, noStore, type Store } from "@/ledger/store"
import { usesAcross, type Asked } from "@/ledger/uses"
import type { Exact } from "@/ledger/exact"
import { parsed, ready, reader, type Shelf } from "@/ledger/parse"
import { findingFile } from "@/domain/findingFile"
import {
  isLedgerAcrossWork,
  isLedgerNamesWork,
  isLedgerWarmWork,
  isLedgerWork,
  LEDGER_ANSWER,
  type LedgerAnswer,
  type LedgerAcross,
  type LedgerAcrossWork,
  type LedgerNamesWork,
  type LedgerPlaces,
  type LedgerWarmth,
  type LedgerWarmWork,
  type LedgerWork
} from "@/ledger/protocol"
import { toldBy, usesIn, writingAt, writingNamed, writingsIn, type Told } from "@/ledger/writings"

const shelf = (): Shelf => {
  const getURL = browser.runtime.getURL as (path: string) => string
  return {
    runtime: getURL("/ledger/web-tree-sitter.wasm"),
    grammar: (file) => getURL(`/ledger/${file}`)
  }
}

const answer = (work: LedgerWork): Effect.Effect<LedgerAnswer> =>
  parsed(shelf(), work.path, work.text, (root): LedgerAnswer => {
    const question = work.question
    if (question.of === "writingAt") {
      const answer = writingAt(root, work.text, question.at)
      if (answer === null) return { kind: LEDGER_ANSWER, writing: null }
      return answer.at === "here"
        ? { kind: LEDGER_ANSWER, writing: answer.writing }
        : { kind: LEDGER_ANSWER, writing: null, borrowed: answer.borrowed }
    }
    if (question.of === "writingNamed") {
      return { kind: LEDGER_ANSWER, writing: writingNamed(root, work.text, question.name) }
    }
    if (question.of === "usesIn") {
      return { kind: LEDGER_ANSWER, uses: usesIn(root, work.text, question.writing) }
    }
    return { kind: LEDGER_ANSWER, writings: writingsIn(root, work.text) }
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

    const { exactly, readable } = yield* exactEngine()
    const library = yield* standardLibrary()

    const wanted = new Map<string, string>()
    for (const [path, text] of files) if (readable(path)) wanted.set(`/${path}`, text)

    exactness = { at, exact: exactly(wanted, library) }
  }).pipe(
    Effect.catch(() => Effect.void),
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
    Effect.catch(() => Effect.void)
  )

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
    const outline = yield* reader(where, (root, text) => toldBy(root, text))

    const manifest = yield* store.manifest(at).pipe(Effect.catch(() => Effect.succeed(null)))

    if (manifest !== null) {
      const known = yield* store
        .told(manifest.files.map(([, sha]) => sha))
        .pipe(Effect.catch(() => Effect.succeed(new Map<string, Told>())))

      if (whollyKnown(manifest, known)) {
        const files = byPath(manifest, known)
        hold(kept(at, files, 0))
        // The exact tier needs the files themselves, which a manifest does not
        // carry. Answering off disk is the fast path and stays the fast path;
        // a reader who asked for exactness pays one archive for it.
        if (work.exact === true) yield* Effect.forkDetach(exactFrom(work, at))
        yield* store
          .keepManifest({ ...manifest, seen: Date.now() })
          .pipe(Effect.catch(() => Effect.void))
        return { ready: true, read: files.size, skipped: 0, kept: true } satisfies LedgerWarmth
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

    hold(kept(at, files, whole.size - files.size))

    // After the answer, never before it. The tier below is already answering,
    // and this is a second of work that makes those answers better.
    if (work.exact === true) yield* Effect.forkDetach(beExact(at, whole))

    yield* store.keepTold(fresh).pipe(Effect.catch(() => Effect.void))
    yield* store
      .keepManifest(manifestOf(at, held, Date.now()))
      .pipe(Effect.catch(() => Effect.void))
    yield* store.forgetBeyond(ON_DISK).pipe(Effect.catch(() => Effect.succeed(0)))

    return {
      ready: true,
      read: files.size,
      skipped: whole.size - files.size,
      parsed: fresh.size
    } satisfies LedgerWarmth
  }).pipe(
    Effect.catch((cause) => Effect.succeed({ ready: false, why: String(cause) } satisfies LedgerWarmth))
  )

const warm = (work: LedgerWarmWork): Effect.Effect<LedgerWarmth> =>
  Effect.gen(function* () {
    const at = keyOf({ owner: work.owner, repo: work.repo }, work.sha)

    const found = holding(at)
    if (found !== undefined) {
      return { ready: true, read: found.read, skipped: found.skipped, kept: true }
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
  return {
    uses: usesAcross(ledger.files, asked, new Set(ledger.files.keys()), work.most ?? 200),
    ready: true
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isLedgerWarmWork(message)) return Effect.runPromise(warm(message))
  if (isLedgerNamesWork(message)) return Effect.runPromise(Effect.sync(() => named(message)))
  if (isLedgerAcrossWork(message)) return Effect.runPromise(Effect.sync(() => across(message)))
  return undefined
})
