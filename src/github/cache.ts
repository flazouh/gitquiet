import { Effect, Option } from "effect"
import type { Stat } from "../domain/commitList"
import { keyOf, type PullRequestRef } from "../domain/PullRequestRef"
import type { Branches } from "../domain/sittings"
import type { CheckRollup, Opinion, Size, Sizes, Standings } from "../domain/workingSet"
import type { ForgetfulKeyValue } from "../ports/KeyValue"
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
 * What is kept is GitHub's own payloads, not the snapshot decoded from them. A
 * snapshot is full of `Option`s and would need a codec of its own — a second
 * way of reading a pull request, free to drift from the first. Payloads are
 * already JSON, so they go in as they arrived and come back out through
 * `toSnapshot`. It also means a page written by an older build cannot describe
 * a pull request in a shape this one misreads: the decoder refuses it, and a
 * refusal is simply a miss.
 */
type Entry = {
  readonly at: number
  readonly payloads: RawPayloads
}

const KEY = "pr:"
const INDEX = "pr:index"

/**
 * How many pull requests are kept.
 *
 * Each is GitHub's payloads for one page, around a hundred kilobytes.
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
const area = (): ForgetfulKeyValue | undefined =>
  typeof browser === "undefined" ? undefined : browser.storage?.local

/**
 * Storage failures are misses, never errors.
 *
 * It can be unavailable, over quota, or disabled by policy, and not one of
 * those is worth refusing to show a pull request over: the network is still
 * there, and a miss costs only the wait this exists to avoid.
 */
const orNothing = <T>(work: () => PromiseLike<T>, fallback: T): Effect.Effect<T> =>
  Effect.tryPromise(work).pipe(Effect.catch(() => Effect.succeed(fallback)))

export const recall = Effect.fn("snapshots.recall")(function* (reference: PullRequestRef) {
  const store = area()
  if (store === undefined) return Option.none<RawPayloads>()

  const key = keyFor(reference)
  const held = yield* orNothing(() => store.get(key), {})
  const entry: unknown = held[key]

  return isEntry(entry) ? Option.some(entry.payloads) : Option.none<RawPayloads>()
})

/**
 * Notes that a key was just written, and drops whatever that pushed off the end.
 *
 * Keys by recency, newest first, so the one that goes is the one least recently
 * read. Reading something again counts as recent, which is what keeps the pull
 * request someone is living in from being evicted by the forty they glanced at.
 */
const keepRecent = Effect.fn("snapshots.keepRecent")(function* (
  store: ForgetfulKeyValue,
  index: string,
  key: string,
  cap: number
) {
  const held = yield* orNothing(() => store.get(index), {})
  const ordered = [key, ...asKeys(held[index]).filter((kept) => kept !== key)]
  const evicted = ordered.slice(cap)

  yield* orNothing(() => store.set({ [index]: ordered.slice(0, cap) }), undefined)
  if (evicted.length > 0) yield* orNothing(() => store.remove(evicted), undefined)
})

export const remember = Effect.fn("snapshots.remember")(function* (
  reference: PullRequestRef,
  payloads: RawPayloads
) {
  const store = area()
  if (store === undefined) return

  const key = keyFor(reference)
  yield* orNothing(() => store.set({ [key]: { at: Date.now(), payloads } satisfies Entry }), undefined)
  yield* keepRecent(store, INDEX, key, KEPT)
})

/**
 * The other half of the store: a list route's answer, kept under the route itself.
 *
 * The two lists this interface draws — the Working Set and a repository's own page
 * — are read as GitHub's own routes returning GitHub's own JSON, so the route is
 * already the name of the thing. Keeping them by route means the six shelves
 * overwrite themselves and every page of every repository list is its own entry,
 * without anything here having to know what either of them means.
 *
 * Separate from the pull requests above and not sharing their index, because they
 * are evicted at wildly different rates: a list is a couple of kilobytes read on
 * every visit, and mixing them in would spend a quarter of the forty pull requests
 * a reader is actually working through.
 */
const ROUTE = "route:"
const ROUTE_INDEX = "route:index"

/**
 * How many browsed routes are kept.
 *
 * Pages of repository lists, pages of commits, and a branch and author picker
 * per repository: twenty-four is several repositories at several pages each,
 * which is more than anybody has open.
 */
const ROUTES_KEPT = 24

/**
 * The other index, for the routes that are a page rather than somewhere a reader went.
 *
 * Eleven routes make up Home: the six shelves, the three kinds of involved issue, the
 * repository list the Rail draws and the activity feed. Every one has to be on hand for
 * the page to open from memory at all, since a Working Set missing a shelf is not shown.
 *
 * They shared the index above until they were measured against it. The routes up there
 * grow without limit — four more per repository a reader opens — so an afternoon of
 * reading pushed the shelves out one at a time, and the next visit to Home opened blank
 * and sat there for the two seconds the live read takes. These eleven rewrite themselves
 * instead of accumulating, so kept apart they cost a fixed eleven slots forever and
 * nothing a reader does can evict them.
 */
const STANDING_INDEX = "standing:index"

/**
 * How many of those are kept: the eleven, and room for a second reader's activity
 * feed and a shelf this codebase has not added yet.
 */
const STANDING_KEPT = 16

/**
 * Which of the two a route is written under.
 *
 * Said by the caller rather than worked out from the route, because the route is a URL
 * and matching page names against URL shapes is exactly the kind of rule that goes
 * quietly wrong when GitHub renames one.
 */
export type Keeping = "standing" | "browsed"

type Answer = { readonly at: number; readonly payload: unknown }

const isAnswer = (value: unknown): value is Answer => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { at?: unknown; payload?: unknown } = value
  return typeof candidate.at === "number" && candidate.payload !== undefined
}

export const recallRoute = Effect.fn("snapshots.recallRoute")(function* (route: string) {
  const store = area()
  if (store === undefined) return Option.none<unknown>()

  const key = `${ROUTE}${route}`
  const held = yield* orNothing(() => store.get(key), {})
  const entry: unknown = held[key]

  return isAnswer(entry) ? Option.some(entry.payload) : Option.none<unknown>()
})

export const rememberRoute = Effect.fn("snapshots.rememberRoute")(function* (
  route: string,
  payload: unknown,
  keeping: Keeping = "browsed"
) {
  const store = area()
  if (store === undefined) return

  const key = `${ROUTE}${route}`
  yield* orNothing(() => store.set({ [key]: { at: Date.now(), payload } satisfies Answer }), undefined)

  const standing = keeping === "standing"
  yield* keepRecent(
    store,
    standing ? STANDING_INDEX : ROUTE_INDEX,
    key,
    standing ? STANDING_KEPT : ROUTES_KEPT
  )
})

/**
 * The third part of the store: the two things a row shows that no list route says.
 *
 * A list route answers with rows, and a row drawn from one alone is a title and an
 * author. What a stack is — which row sits on which — comes from a merge box per
 * pull request, and how big the change is comes from a diffstat per pull request:
 * two dozen small reads that take a few seconds to come back. Kept here, a list
 * opened again is drawn whole from the first frame, stacks and sizes included,
 * and the live read only has to confirm it.
 *
 * Decoded rather than raw, which the two parts above deliberately are not. The
 * reason they keep GitHub's payloads is to avoid a second way of reading a pull
 * request that could drift from the first; there is no such risk in two branch
 * names and two integers, and the alternative — keeping the merge boxes they came
 * out of — is fifty kilobytes a row to recover eighty bytes of it.
 *
 * Written under a key each rather than one entry per pull request, because the two
 * reads land seconds apart: a single entry would mean read, merge and write from
 * two fibers at once, and the loser of that race would drop what the winner had
 * just kept.
 */
const BRANCHES = "stack:"
const SIZE = "size:"
/**
 * The third of them, and the one that is not about drawing the row at all.
 *
 * This was deliberately left out, on the grounds that a check rollup is the fact
 * most certain to have moved and a stale one is drawn exactly like a fresh one.
 * That reasoning only weighed what the rollup looks like. It is also read:
 * `courtOf` calls a green pull request nobody is required to review Your Move,
 * and the same row with no rollup Waiting.
 *
 * So the list opened from memory sorted one way, and the live read re-sorted it
 * two seconds later with rows crossing between headings. Which is the worse of
 * the two: a minute-old rollup sits under a toast that says the list is being
 * checked, where a row that moves after the reader has started reading gives
 * them no warning at all.
 *
 * By GitHub's numeric id, not by reference, because that is the only key their
 * deferred route answers by and the only key this is ever looked up with.
 */
const STANDING = "stand:"
const ROW_INDEX = "row:index"

/**
 * How many of these facts are kept.
 *
 * Two per pull request, at under a hundred bytes each: four hundred is two hundred
 * pull requests, which is every list a reader has open several times over, and
 * still smaller than one of the forty pull requests kept above.
 */
const ROWS_KEPT = 400

type Held<Value> = { readonly at: number; readonly value: Value }

const isHeld = (value: unknown): value is Held<unknown> => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { at?: unknown; value?: unknown } = value
  return typeof candidate.at === "number" && candidate.value !== undefined
}

const areBranches = (value: unknown): value is Branches => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { baseBranch?: unknown; headBranch?: unknown } = value
  return typeof candidate.baseBranch === "string" && typeof candidate.headBranch === "string"
}

const isSize = (value: unknown): value is Size => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { added?: unknown; deleted?: unknown } = value
  return typeof candidate.added === "number" && typeof candidate.deleted === "number"
}

/**
 * A standing as it goes into the store, which is not the shape it has in the domain.
 *
 * `Option` is a class, and the storage API clones values structurally: what comes back
 * out of one is a plain object wearing none of its methods, so `Option.isSome` on it
 * answers no whatever is inside. Null and back is the whole conversion, and it is done
 * here rather than anywhere else because here is the only place the two shapes meet.
 */
type KeptStanding = {
  readonly checks: CheckRollup | null
  readonly reviewed: Opinion | null
}

const OPINIONS: ReadonlyArray<Opinion> = ["approved", "changes-requested", "review-required"]
const ROLLUPS: ReadonlyArray<CheckRollup["state"]> = ["passing", "failing", "running"]

const isRollup = (value: unknown): value is CheckRollup => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { state?: unknown; total?: unknown; passed?: unknown } = value
  return (
    ROLLUPS.includes(candidate.state as CheckRollup["state"]) &&
    typeof candidate.total === "number" &&
    typeof candidate.passed === "number"
  )
}

const isStanding = (value: unknown): value is KeptStanding => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { checks?: unknown; reviewed?: unknown } = value
  return (
    (candidate.checks === null || isRollup(candidate.checks)) &&
    (candidate.reviewed === null || OPINIONS.includes(candidate.reviewed as Opinion))
  )
}

const rowKey = (kind: string, reference: PullRequestRef): string => `${kind}${keyOf(reference)}`

const keepRow = Effect.fn("snapshots.keepRow")(function* (
  key: string,
  value: unknown,
  index: string = ROW_INDEX,
  cap: number = ROWS_KEPT
) {
  const store = area()
  if (store === undefined) return

  yield* orNothing(() => store.set({ [key]: { at: Date.now(), value } satisfies Held<unknown> }), undefined)
  yield* keepRecent(store, index, key, cap)
})

export const rememberBranches = (reference: PullRequestRef, branches: Branches) =>
  keepRow(rowKey(BRANCHES, reference), branches)

export const rememberSize = (reference: PullRequestRef, size: Size) =>
  keepRow(rowKey(SIZE, reference), size)

export const rememberStanding = (
  id: number,
  standing: { readonly checks: Option.Option<CheckRollup>; readonly reviewed: Option.Option<Opinion> }
) =>
  keepRow(`${STANDING}${id}`, {
    checks: Option.getOrNull(standing.checks),
    reviewed: Option.getOrNull(standing.reviewed)
  } satisfies KeptStanding)

/**
 * What is kept about these rows: their stacks by name, their sizes and their
 * standings by id.
 */
export type RememberedRows = {
  readonly branches: ReadonlyMap<string, Branches>
  readonly sizes: Sizes
  readonly standings: Standings
}

const nothingKept: RememberedRows = { branches: new Map(), sizes: new Map(), standings: new Map() }

/**
 * Everything kept about a list's rows, in one read of the store.
 *
 * One `get` for all of it rather than two per row: a list is twenty-five rows, and
 * fifty round trips through the extension's storage API is tens of milliseconds
 * spent on the one path whose whole purpose is to answer before the network can.
 */
export const recallRows = Effect.fn("snapshots.recallRows")(function* (
  rows: ReadonlyArray<{ readonly id: number; readonly reference: PullRequestRef }>
) {
  const store = area()
  if (store === undefined || rows.length === 0) return nothingKept

  const held = yield* orNothing(
    () =>
      store.get(
        rows.flatMap((one) => [
          rowKey(BRANCHES, one.reference),
          rowKey(SIZE, one.reference),
          `${STANDING}${one.id}`
        ])
      ),
    {} as Record<string, unknown>
  )

  const branches = new Map<string, Branches>()
  const sizes = new Map<number, Size>()
  const standings = new Map<number, { checks: Option.Option<CheckRollup>; reviewed: Option.Option<Opinion> }>()

  for (const one of rows) {
    const stack: unknown = held[rowKey(BRANCHES, one.reference)]
    if (isHeld(stack) && areBranches(stack.value)) branches.set(keyOf(one.reference), stack.value)

    const size: unknown = held[rowKey(SIZE, one.reference)]
    if (isHeld(size) && isSize(size.value)) sizes.set(one.id, size.value)

    const standing: unknown = held[`${STANDING}${one.id}`]
    if (isHeld(standing) && isStanding(standing.value)) {
      standings.set(one.id, {
        checks: Option.fromNullishOr(standing.value.checks),
        reviewed: Option.fromNullishOr(standing.value.reviewed)
      })
    }
  }

  return { branches, sizes, standings } satisfies RememberedRows
})

/**
 * The fourth part of the store: how big each commit is, by its sha.
 *
 * The one thing in here that never goes stale. A pull request's rows move, a
 * list reorders and a check goes red, so everything above is kept against the
 * next visit and confirmed anyway. A landed commit's diff is the same diff
 * forever — the sha is a hash of it — so a stat read once is a stat that never
 * has to be read again, and the second visit to a branch draws its numbers
 * without asking GitHub for anything.
 *
 * Which is what makes them affordable at all. GitHub sends no size in a commit
 * list and no route gives forty of them at once, so each is a fetch of that
 * commit's diff: expensive once, free after.
 */
const STAT = "stat:"
const STAT_INDEX = "stat:index"

/**
 * How many are kept.
 *
 * Twenty bytes each. A thousand is thirty pages of history, or every commit a
 * reader will scroll past in a month, and altogether smaller than a single one
 * of the pull requests kept at the top of this file.
 */
const STATS_KEPT = 1000

const isStat = (value: unknown): value is Stat => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { files?: unknown; added?: unknown; removed?: unknown } = value
  return (
    typeof candidate.files === "number" &&
    typeof candidate.added === "number" &&
    typeof candidate.removed === "number"
  )
}

/**
 * Kept under an index of their own rather than beside the rows above, because
 * the two evict at opposite rates: a thousand commits scrolled past in a week
 * would push out every pull request a reader is working through.
 */
export const rememberStat = (sha: string, stat: Stat) =>
  keepRow(`${STAT}${sha}`, stat, STAT_INDEX, STATS_KEPT)

/**
 * Every stat already known about a page of commits, in one read of the store.
 *
 * One `get` for the page rather than one per row, for the reason `recallRows`
 * gives: this runs on the frame the list appears, and forty round trips through
 * the extension's storage API is time spent in front of the thing it is for.
 */
export const recallStats = Effect.fn("snapshots.recallStats")(function* (
  shas: ReadonlyArray<string>
) {
  const store = area()
  const found = new Map<string, Stat>()
  if (store === undefined || shas.length === 0) return found as ReadonlyMap<string, Stat>

  const held = yield* orNothing(
    () => store.get(shas.map((sha) => `${STAT}${sha}`)),
    {} as Record<string, unknown>
  )

  for (const sha of shas) {
    const kept: unknown = held[`${STAT}${sha}`]
    if (isHeld(kept) && isStat(kept.value)) found.set(sha, kept.value)
  }

  return found as ReadonlyMap<string, Stat>
})

/**
 * The fifth part of the store: this deploy's hash for a persisted query.
 *
 * `persisted.ts` reads these off GitHub's own traffic, which only works on a page
 * where their app asks the question. Reaching an issue from their issue list is a
 * page where it does not: the hash for the query carrying the issue is never
 * spoken, and the read gives up three seconds later. Kept here, a hash learnt
 * once is on hand for every issue after it, whichever way the reader arrives.
 *
 * Under the release as well as the name, which is the whole reason this is safe
 * to keep at all. GitHub ships many times a day and a hash does not outlive the
 * deploy that minted it: their route answers 404 `unknownQuery` to yesterday's.
 * Filed this way, a hash from an older deploy is simply never found.
 */
const HASH = "hash:"
const HASH_INDEX = "hash:index"

/**
 * How many are kept: a few queries across the last few deploys.
 *
 * Thirty-two bytes each, and the one worth having is always the newest. This is
 * sized to let stale entries fall off on their own rather than to hold anything.
 */
const HASHES_KEPT = 24

const hashKey = (release: string, name: string): string => `${HASH}${release}/${name}`

export const rememberHash = (release: string, name: string, hash: string) =>
  keepRow(hashKey(release, name), hash, HASH_INDEX, HASHES_KEPT)

export const recallHash = Effect.fn("snapshots.recallHash")(function* (
  release: string,
  name: string
) {
  const store = area()
  if (store === undefined) return Option.none<string>()

  const key = hashKey(release, name)
  const held = yield* orNothing(() => store.get(key), {})
  const kept: unknown = held[key]

  return isHeld(kept) && typeof kept.value === "string"
    ? Option.some(kept.value)
    : Option.none<string>()
})
