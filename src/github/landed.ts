import { Effect, Fiber, Option } from "effect"
import type { PullRequestState } from "../domain/PullRequest"
import { keyOf, type PullRequestRef } from "../domain/PullRequestRef"
import { recallLanded } from "./cache"

/**
 * What this extension's own writes have just made true, held for as long as
 * GitHub takes to agree.
 *
 * GitHub's page data is eventually consistent. For a second or two after a merge
 * their own `changes` route still answers open, so a read taken in that window
 * comes back describing a pull request the reader has already landed — and every
 * surface reading through the gateway draws it. The card goes from Merged to
 * Open in front of somebody who merged it.
 *
 * A write is the one moment this codebase knows a state for certain: GitHub
 * answered 200 to a request that says what it did. So the write writes it down
 * here and the reads wear it until GitHub says the same thing.
 *
 * In memory to be read, and in the store to survive a document. Reading has to be
 * a map lookup: every shelf and every row is decoded through here, and a decode
 * that awaited storage would be a decode that could not be a function. So the map
 * is the answer, and the store is only how the map is refilled — seeded once
 * before the first listing decodes, written after every write.
 *
 * Keeping it at all outside one document is the part that changed. It used to be
 * memory alone, on the reasoning that this covers the seconds between a write and
 * GitHub catching up and a reopened document is long past them. Two of those
 * seconds are the Working Set's own read, which is their search, and their search
 * index is behind by minutes rather than seconds: close a pull request, open
 * GitHub in a new tab, and their list has it under Needs You with nothing here to
 * say otherwise. See `forget` in `cache.ts` for the other durable half, which
 * drops what was kept rather than correcting it.
 */
const LAG = 5 * 60_000

const landed = new Map<string, { readonly state: PullRequestState; readonly at: number }>()

/**
 * Notes what a write made true.
 *
 * Only the five verbs that end in a state say anything here. Joining a queue and
 * catching a branch up change facts nobody on this side can name — a place in a
 * line, a new head commit — so they write nothing and the read stands alone.
 */
export const recordLanded = (reference: PullRequestRef, state: PullRequestState): void => {
  landed.set(keyOf(reference), { state, at: Date.now() })
}

/**
 * What our own write said this pull request is, while that is still worth more
 * than a read.
 *
 * Expired entries are dropped as they are found rather than swept: the map holds
 * one small record per pull request written to in the last minute, and a sitting
 * does not produce enough of those to be worth a timer.
 */
export const landedState = (reference: PullRequestRef): Option.Option<PullRequestState> => {
  const key = keyOf(reference)
  const held = landed.get(key)
  if (held === undefined) return Option.none()

  if (Date.now() - held.at > LAG) {
    landed.delete(key)
    return Option.none()
  }

  return Option.some(held.state)
}

/**
 * Anything carrying a state and a reference, which is both things a read of ours
 * hands back: a whole pull request, and a row in a list.
 */
type Standing = {
  readonly reference: PullRequestRef
  readonly state: PullRequestState
}

/**
 * The same, worn by whatever was read.
 *
 * One function for the card and the lists, because it was the card alone for a
 * while and that was the gap: a merge landed, Home was opened from memory, and
 * the pull request sat under Needs You until the live read replaced it two
 * seconds later. Every shelf is decoded through here now, live or remembered, so
 * a row cannot say open about a pull request this extension merged.
 *
 * Handed back unchanged where there is nothing to say, so the common case costs
 * one map lookup and allocates nothing.
 */
export const asLanded = <Read extends Standing>(read: Read): Read =>
  Option.match(landedState(read.reference), {
    onNone: () => read,
    onSome: (state) => (state === read.state ? read : { ...read, state })
  })

/**
 * What is worth writing down, which is what has not expired.
 *
 * Handed out rather than written from here, because this file knows the policy
 * and `cache.ts` knows the store — and a decode path that imported the browser's
 * storage to answer a map lookup would be the wrong shape however small it was.
 */
export const landedNow = (): Record<string, { readonly state: PullRequestState; readonly at: number }> => {
  const now = Date.now()
  const held: Record<string, { readonly state: PullRequestState; readonly at: number }> = {}

  for (const [key, entry] of landed) {
    if (now - entry.at <= LAG) held[key] = entry
    else landed.delete(key)
  }

  return held
}

/**
 * Puts back what an earlier document wrote, without overruling this one.
 *
 * Anything already here was written by a press in this document and is newer by
 * construction, so it wins. Anything expired is dropped rather than seeded, which
 * is what makes a store that outlives the browser safe to read from.
 *
 * Shaped rather than trusted: what comes back is whatever was in storage, written
 * by a build that may not be this one.
 */
export const seedLanded = (held: Record<string, unknown>): void => {
  const now = Date.now()

  for (const [key, entry] of Object.entries(held)) {
    if (landed.has(key)) continue
    if (typeof entry !== "object" || entry === null) continue

    const { state, at } = entry as { state?: unknown; at?: unknown }
    if (typeof at !== "number" || now - at > LAG) continue
    if (state !== "open" && state !== "draft" && state !== "closed" && state !== "merged") continue

    landed.set(key, { state, at })
  }
}

/**
 * What an earlier document wrote, put back before anything is read through here.
 *
 * Once per document and shared, which is why the fiber is kept rather than the
 * effect: the six shelves decode at the same moment, and each of them joining the
 * same read is the difference between one crossing of the storage boundary and
 * six — and, more to the point, between all six being seeded and only the first
 * one being sure of it.
 *
 * Nothing here fails in a way worth reporting. A store that is unavailable leaves
 * the map exactly where it started, which is what every read already copes with.
 */
let seeding: Fiber.Fiber<void, never> | undefined

export const seeded: Effect.Effect<void> = Effect.suspend(() => {
  seeding ??= Effect.runFork(
    recallLanded().pipe(
      Effect.map(seedLanded),
      Effect.catch(() => Effect.void)
    )
  )

  return Fiber.join(seeding)
})

/** Empties it, for a test that must not read what another test wrote. */
export const forgetLanded = (): void => {
  landed.clear()
  // The seed with it, or the second test in a file would join the first one's
  // fiber and be told about a store that has since been stood up differently.
  seeding = undefined
}
