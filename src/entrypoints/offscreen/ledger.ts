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
import { everyPlace, kept, keyOf, type Kept } from "@/ledger/ledger"
import { parsed, ready, reader, type Shelf } from "@/ledger/parse"
import { findingFile } from "@/domain/findingFile"
import {
  isLedgerNamesWork,
  isLedgerWarmWork,
  isLedgerWork,
  LEDGER_ANSWER,
  type LedgerAnswer,
  type LedgerNamesWork,
  type LedgerPlaces,
  type LedgerWarmth,
  type LedgerWarmWork,
  type LedgerWork
} from "@/ledger/protocol"
import { usesIn, writingAt, writingNamed, writingsIn } from "@/ledger/writings"

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
 * The Ledger, once per commit, for as long as this document lives.
 *
 * In memory and not on disk. A kept index belongs in IndexedDB — it is what
 * would make the second visit to a repository free — and that is not built:
 * this is the thing it would be built out of, and it is worth having working
 * before it is worth having saved. The document outlives every page a reader
 * opens, so a review spent moving between files pays for the read once.
 *
 * One commit at a time. A reader looking at two repositories at once is rarer
 * than a reader whose browser is holding two repositories' worth of names.
 */
let ledger: Kept | null = null

/** What is being read now, so two asks do not read a repository twice. */
let warming: { readonly at: string; readonly work: Effect.Effect<LedgerWarmth> } | null = null

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

const warm = (work: LedgerWarmWork): Effect.Effect<LedgerWarmth> =>
  Effect.gen(function* () {
    const at = keyOf({ owner: work.owner, repo: work.repo }, work.sha)
    if (ledger?.at === at) {
      return { ready: true, read: ledger.read, skipped: ledger.skipped }
    }
    // Already on its way. The second asker waits on the first's read rather
    // than starting a second one, which on a large repository is ten megabytes
    // fetched twice.
    if (warming?.at === at) return yield* warming.work

    const reading = Effect.gen(function* () {
      const where = shelf()
      yield* ready(where)
      const outline = yield* reader(where, (root, text) => writingsIn(root, text))

      const bytes = yield* archive(work.owner, work.repo, work.sha)
      const files = filesIn(bytes)

      const built = kept(at, files, (path, text) => outline(path, text) ?? [])
      ledger = built
      return { ready: true, read: built.read, skipped: built.skipped } satisfies LedgerWarmth
    }).pipe(
      Effect.catch((cause) => Effect.succeed({ ready: false, why: String(cause) } satisfies LedgerWarmth)),
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
  const at = keyOf({ owner: work.owner, repo: work.repo }, work.sha)
  if (ledger === null || ledger.at !== at) return { places: [], ready: false }

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

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isLedgerWarmWork(message)) return Effect.runPromise(warm(message))
  if (isLedgerNamesWork(message)) return Effect.runPromise(Effect.sync(() => named(message)))
  return undefined
})
