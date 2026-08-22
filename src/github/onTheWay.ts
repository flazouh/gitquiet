import { Effect, Option } from "effect"
import { fromPathname, keyOf, type PullRequestRef } from "../domain/PullRequestRef"
import type { GatewayError } from "../ports/GitHubGateway"
import { payloadsFor } from "./asking"
import type { RawPayloads } from "./snapshot"

/**
 * Reading a pull request while the tab is still on its way to it.
 *
 * This is the one thing in the extension that does not wait for GitHub. Every
 * script of ours runs inside their page, so the earliest any of them can ask a
 * question is the moment their HTML answers — measured at 1.2 to 3.6 seconds on a
 * large pull request, before which nothing of ours exists. The service worker is
 * outside that: it is told the address when the tab starts moving, and by the time
 * their page arrives the seven routes have been asked for and often answered.
 *
 * What arrives is kept here rather than in the store. The store holds payloads that
 * have decoded into a pull request, deliberately — see `cache.ts` — and these have
 * not been decoded by anybody yet. They live in the worker for half a minute, which
 * is the gap between a navigation starting and the page asking for them, and a
 * worker that Chrome shuts down in between simply loses them and reads again.
 */

/** The pull request a tab is on its way to, where it is one of ours. */
export const goingTo = (url: string): Option.Option<PullRequestRef> => {
  const address = Option.fromNullishOr(URL.parse(url))
  if (Option.isNone(address)) return Option.none()
  if (address.value.host !== "github.com") return Option.none()

  return fromPathname(address.value.pathname)
}

/**
 * How long payloads read on the way are worth handing to the page that follows.
 *
 * Long enough to cover the wait this exists to remove — their HTML, then our
 * content script, then the screen bundle — and short enough that a reader who
 * presses reload a minute later is asking GitHub rather than being told what it
 * said last time. The page's own store is where anything older than this lives.
 */
export const STILL_GOOD = 30_000

/**
 * How many pull requests are held at once.
 *
 * One reader arrives at one pull request at a time, and each of these is GitHub's
 * seven payloads: about a hundred kilobytes of a small one and three quarters of a
 * megabyte of the largest. Four covers a reader opening a few in tabs at once and
 * costs a few megabytes of a worker that is about to be shut down anyway.
 */
const HOW_MANY = 4

const held = new Map<string, { readonly at: number; readonly payloads: RawPayloads }>()

const keep = (reference: PullRequestRef, payloads: RawPayloads): void => {
  const key = keyOf(reference)
  held.delete(key)
  held.set(key, { at: Date.now(), payloads })

  const oldest = held.keys().next()
  if (held.size > HOW_MANY && !oldest.done) held.delete(oldest.value)
}

const stillHeld = (reference: PullRequestRef): Option.Option<RawPayloads> => {
  const key = keyOf(reference)
  const had = held.get(key)
  if (had === undefined) return Option.none()

  // Dropped rather than passed over, so that what is in here is what is good and
  // an answer nobody may ever ask for again is not pinned until four newer reads
  // push it out.
  if (Date.now() - had.at >= STILL_GOOD) {
    held.delete(key)
    return Option.none()
  }

  return Option.some(had.payloads)
}

/**
 * The seven payloads, read once however many times they are asked for.
 *
 * Both callers are in the service worker: the navigation that starts the read, and
 * the page asking for what that read found. Whichever is second is answered without
 * a second request — from what is held here where the first has finished, and by
 * joining its requests through `askingOnce` where it has not.
 *
 * A read that failed is not held, and the page asking after one is a read of GitHub
 * rather than the failure repeated. That costs a second set of requests during an
 * outage and is the point: the two failures worth holding on to are the ones that do
 * not hold still, and a reader arriving a second after a 503 deserves the ask.
 */
export const payloadsOnTheWay = (
  reference: PullRequestRef
): Effect.Effect<RawPayloads, GatewayError> =>
  Effect.suspend(() => {
    const already = stillHeld(reference)
    if (Option.isSome(already)) return Effect.succeed(already.value)

    return payloadsFor(reference).pipe(
      Effect.tap((payloads) => Effect.sync(() => keep(reference, payloads)))
    )
  })

/** Empties what is held, for a test standing the same pull request up twice. */
export const forgetTheWay = (): void => {
  held.clear()
}
