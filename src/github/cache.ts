import { Effect, Option } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { RawPayloads } from "./snapshot"

/**
 * Where pull requests already read are kept, so opening one again does not mean
 * asking GitHub again.
 *
 * Internal to the gateway rather than a seam of its own. `GitHubGateway` is the
 * only seam in the system, and a second one here would mean every test that
 * wanted a pull request had to know there was a store behind it. Tests stand in
 * for the browser API instead, the way `fake-indexeddb` would.
 *
 * What is kept is GitHub's four payloads, not the snapshot decoded from them. A
 * snapshot is full of `Option`s and would need a codec of its own — a second
 * way of reading a pull request, free to drift from the first. Payloads are
 * already JSON, so they go in as they arrived and come back out through
 * `toSnapshot`. It also means a page written by an older build cannot describe
 * a pull request in a shape this one misreads: the decoder refuses it, and a
 * refusal is simply a miss.
 */
export type Area = {
  readonly get: (keys: string) => Promise<Record<string, unknown>>
  readonly set: (items: Record<string, unknown>) => Promise<void>
  readonly remove: (keys: Array<string>) => Promise<void>
}

type Entry = {
  readonly at: number
  readonly payloads: RawPayloads
}

const KEY = "pr:"
const INDEX = "pr:index"

/**
 * How many pull requests are kept.
 *
 * Each is GitHub's four payloads for one page, around a hundred kilobytes.
 * Forty is a working week of review for anyone, and a few megabytes — which is
 * why the manifest asks for `unlimitedStorage`.
 */
const KEPT = 40

const keyFor = (reference: PullRequestRef): string =>
  `${KEY}${reference.owner}/${reference.repo}/${reference.number}`

const isEntry = (value: unknown): value is Entry => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { at?: unknown; payloads?: unknown } = value
  return typeof candidate.at === "number" && typeof candidate.payloads === "object"
}

const asKeys = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []

/**
 * Local rather than sync: these are megabytes of GitHub's own payloads, they
 * are worthless on another machine, and sync would refuse them anyway.
 *
 * Absent in a test, and absent in a browser that has taken the permission away.
 * Both mean the same thing here, which is that every read is a miss and every
 * write goes nowhere.
 */
const area = (): Area | undefined => (typeof browser === "undefined" ? undefined : browser.storage?.local)

/**
 * Storage failures are misses, never errors.
 *
 * It can be unavailable, over quota, or disabled by policy, and not one of
 * those is worth refusing to show a pull request over: the network is still
 * there, and a miss costs only the wait this exists to avoid.
 */
const orNothing = <T>(work: Promise<T>, fallback: T): Effect.Effect<T> =>
  Effect.promise(() => work.catch(() => fallback))

export const recall = Effect.fn("snapshots.recall")(function* (reference: PullRequestRef) {
  const store = area()
  if (store === undefined) return Option.none<RawPayloads>()

  const key = keyFor(reference)
  const held = yield* orNothing(store.get(key), {})
  const entry: unknown = held[key]

  return isEntry(entry) ? Option.some(entry.payloads) : Option.none<RawPayloads>()
})

export const remember = Effect.fn("snapshots.remember")(function* (
  reference: PullRequestRef,
  payloads: RawPayloads
) {
  const store = area()
  if (store === undefined) return

  const key = keyFor(reference)
  yield* orNothing(store.set({ [key]: { at: Date.now(), payloads } satisfies Entry }), undefined)

  // Keys by recency, newest first, so the one that goes is the one least
  // recently opened. Reading a pull request again counts as recent, which is
  // what keeps the pull request someone is living in from being evicted by the
  // forty they glanced at.
  const held = yield* orNothing(store.get(INDEX), {})
  const ordered = [key, ...asKeys(held[INDEX]).filter((kept) => kept !== key)]
  const evicted = ordered.slice(KEPT)

  yield* orNothing(store.set({ [INDEX]: ordered.slice(0, KEPT) }), undefined)
  if (evicted.length > 0) yield* orNothing(store.remove(evicted), undefined)
})
