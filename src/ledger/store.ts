/**
 * The Ledger, kept, so a repository is read once rather than once a visit.
 *
 * Two stores, and the split is the whole idea:
 *
 *   - **told**, keyed by a file's blob sha. What one file says, under git's own
 *     name for its contents. A file that did not change between two commits has
 *     one of these for both, so a push costs the files it touched and no others,
 *     and two branches of a repository share everything they have in common.
 *   - **commits**, keyed by repository and commit. Which blob sha each path had.
 *     Small — a path and forty characters per file — and it is what turns a
 *     commit into a set of keys for the store above.
 *
 * Nothing in here parses anything or knows what a Writing is. It keeps what it
 * is given and hands it back, and the policy about *when* to read a repository
 * lives beside the parsing in the offscreen document.
 */

import { Effect } from "effect"
import type { Told } from "./writings"

const NAME = "gitquiet-ledger"
const VERSION = 1
const TOLD = "told"
const COMMITS = "commits"

/** Which paths a commit held, and what each one's contents were called. */
export type Manifest = {
  readonly at: string
  /** Path to blob sha, as `git ls-tree` would say it. */
  readonly files: ReadonlyArray<readonly [string, string]>
  /** When it was last read, for deciding what to let go of. */
  readonly seen: number
  /**
   * The Go modules its `go.mod` files declare, module to folder.
   *
   * Kept here because a `go.mod` is not a file anything parses, so a Ledger that
   * comes back off disk would otherwise not know them. Absent on a manifest kept
   * before this was, and that commit is answered with the guess for as long as
   * it is kept: the manifest is renewed as it is, not read again.
   */
  readonly goModules?: ReadonlyArray<readonly [string, string]>
  /** What its `composer.json` files map each PHP namespace prefix to, for the same reason. */
  readonly phpPrefixes?: ReadonlyArray<readonly [string, ReadonlyArray<string>]>
}

/** What a store can be asked. Named so the offscreen document can be handed a fake one. */
export type Store = {
  readonly manifest: (at: string) => Effect.Effect<Manifest | null, unknown>
  readonly keepManifest: (manifest: Manifest) => Effect.Effect<void, unknown>
  /** What these blob shas were found to say, as many as are known. */
  readonly told: (shas: ReadonlyArray<string>) => Effect.Effect<ReadonlyMap<string, Told>, unknown>
  readonly keepTold: (told: ReadonlyMap<string, Told>) => Effect.Effect<void, unknown>
  /** Lets go of the least recently read repositories, keeping `most` of them. */
  readonly forgetBeyond: (most: number) => Effect.Effect<number, unknown>
}

const opened = (): Effect.Effect<IDBDatabase, unknown> =>
  Effect.callback<IDBDatabase, unknown>((resume) => {
    const asked = indexedDB.open(NAME, VERSION)

    asked.onupgradeneeded = () => {
      const database = asked.result
      if (!database.objectStoreNames.contains(TOLD)) database.createObjectStore(TOLD)
      if (!database.objectStoreNames.contains(COMMITS)) database.createObjectStore(COMMITS)
    }
    asked.onsuccess = () => resume(Effect.succeed(asked.result))
    asked.onerror = () => resume(Effect.fail(asked.error))
    // A second tab upgrading the same database blocks this one. Nothing here
    // waits for ever on that: the Ledger falls back to reading the repository,
    // which is slower and is not broken.
    asked.onblocked = () => resume(Effect.fail("the ledger database is in use elsewhere"))
  })

/** The database, opened once for the life of the document. */
let database: Effect.Effect<IDBDatabase, unknown> | undefined

const held = (): Effect.Effect<IDBDatabase, unknown> => {
  database ??= opened().pipe(Effect.cached, Effect.runSync)
  return database
}

const done = <A>(request: IDBRequest<A>): Effect.Effect<A, unknown> =>
  Effect.callback<A, unknown>((resume) => {
    request.onsuccess = () => resume(Effect.succeed(request.result))
    request.onerror = () => resume(Effect.fail(request.error))
  })

const inStore = <A>(
  store: string,
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => Effect.Effect<A, unknown>
): Effect.Effect<A, unknown> =>
  held().pipe(
    Effect.flatMap((database) =>
      Effect.suspend(() => use(database.transaction(store, mode).objectStore(store)))
    )
  )

/**
 * The store, as IndexedDB.
 *
 * Every read and write is its own transaction. A transaction that stays open
 * across an `await` in IndexedDB is a transaction that has already closed
 * itself, which is the one rule of this API that catches everybody.
 */
export const idbStore: Store = {
  manifest: (at) =>
    inStore(COMMITS, "readonly", (store) =>
      done<Manifest | undefined>(store.get(at)).pipe(Effect.map((found) => found ?? null))
    ),

  keepManifest: (manifest) =>
    inStore(COMMITS, "readwrite", (store) =>
      done(store.put(manifest, manifest.at)).pipe(Effect.asVoid)
    ),

  told: (shas) =>
    inStore(TOLD, "readonly", (store) =>
      Effect.forEach(shas, (sha) => done<Told | undefined>(store.get(sha)).pipe(
        Effect.map((found) => [sha, found] as const)
      ), { concurrency: "unbounded" }).pipe(
        Effect.map((pairs) => {
          const found = new Map<string, Told>()
          for (const [sha, one] of pairs) if (one !== undefined) found.set(sha, one)
          return found
        })
      )
    ),

  keepTold: (told) =>
    inStore(TOLD, "readwrite", (store) =>
      Effect.forEach(told, ([sha, one]) => done(store.put(one, sha)), {
        concurrency: "unbounded",
        discard: true
      })
    ),

  /**
   * Lets go of the repositories read longest ago.
   *
   * The manifests decide, because they are what names a repository; what they
   * name in the file store is left alone. That is deliberate rather than lazy:
   * two repositories that hold the same file — a fork, a vendored copy, the
   * same dependency — share its reading, and a sweep that deleted one
   * repository's files would take the other's with it. The file store is bounded
   * by how many different files a reader has ever opened, which grows slowly,
   * and `unlimitedStorage` is already held.
   */
  forgetBeyond: (most) =>
    inStore(COMMITS, "readwrite", (store) =>
      done<Array<unknown>>(store.getAll()).pipe(
        Effect.flatMap((found) => {
          const all = found as ReadonlyArray<Manifest>
          const oldest = [...all].sort((one, two) => two.seen - one.seen).slice(most)
          return Effect.forEach(oldest, (one) => done(store.delete(one.at)), {
            discard: true
          }).pipe(Effect.as(oldest.length))
        })
      )
    )
}

/**
 * A store that keeps nothing, for a browser without IndexedDB and for tests.
 *
 * Not a failure: a Ledger that cannot be kept is a Ledger that is read again
 * next time, which is the behaviour this feature had before any of this and is
 * slower rather than broken.
 */
export const noStore: Store = {
  manifest: () => Effect.succeed(null),
  keepManifest: () => Effect.void,
  told: () => Effect.succeed(new Map()),
  keepTold: () => Effect.void,
  forgetBeyond: () => Effect.succeed(0)
}
