import { Option } from "effect"
import type { PullRequestState } from "../domain/PullRequest"
import { keyOf, type PullRequestRef } from "../domain/PullRequestRef"

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
 * In memory rather than in the store, which is the whole of the policy. This
 * exists to cover the seconds between a write and GitHub catching up with it,
 * and a document that has been closed and reopened is long past those seconds —
 * by then GitHub is the better source and this would only be a way to remember
 * something wrong. See `forget` in `cache.ts` for the durable half, which drops
 * what was kept rather than replacing it.
 */
const LAG = 60_000

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

/** Empties it, for a test that must not read what another test wrote. */
export const forgetLanded = (): void => {
  landed.clear()
}
