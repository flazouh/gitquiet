/**
 * One request in the air per address, however many parts of the extension are
 * asking for it.
 *
 * This is what makes reading ahead worth anything. The pointer resting on a row
 * starts a read of that pull request; the press two hundred milliseconds later asks
 * for the same six routes, and without this it asked GitHub for them a second time
 * and the reader waited out the whole of the second read having already paid for
 * most of the first. Joined instead, the press is waiting on requests that have been
 * in flight since before it happened.
 *
 * Kept on the world rather than in this module, which is the unusual part and the
 * whole point. The extension is several bundles — the content script that reads
 * ahead, and a screen fetched when a page is opened — and a bundle has its own copy
 * of every module it imports. Two maps here would have meant the reading-ahead
 * folding its own requests, the screen folding its own, and the two never meeting,
 * which is exactly what happened: resting on a row and then pressing it asked GitHub
 * for everything twice, in the same document, the answer to the first read arriving
 * while the second was still being waited for.
 *
 * Only requests in the air. The entry goes the moment one settles, so nothing here
 * is a cache and nothing here can hand back an answer from a minute ago — the store
 * is where that decision is made, deliberately and with an age on it.
 *
 * A promise is what crosses between bundles, because it is the only thing that can:
 * two copies of Effect do not share a runtime, and a fiber of one is not something
 * the other can wait on. Nothing but JSON travels along it for the same reason — a
 * decoded pull request is full of `Option`s made by one bundle's Effect, and handing
 * those to another copy is a question nobody should have to have an answer to.
 */

import { Effect } from "effect"

const FLIGHTS = "__gitquietFlights"

type World = { [FLIGHTS]?: Map<string, PromiseLike<unknown>> }

const flights = (): Map<string, PromiseLike<unknown>> => {
  const world = globalThis as World
  const already = world[FLIGHTS]
  if (already !== undefined) return already

  const fresh = new Map<string, PromiseLike<unknown>>()
  world[FLIGHTS] = fresh
  return fresh
}

/**
 * Asks for an address, unless it is already being asked for — in which case waits
 * for that.
 *
 * `ask` must not fail, because a failure would reach every joiner as a rejection
 * and rejections do not carry the reason across a bundle boundary intact. Say what
 * went wrong in the value instead; the caller here does.
 *
 * The asking runs to the end even if whoever started it walks away, which for a read
 * ahead is the entire idea: the point of it is that the answer is there when the
 * press comes. Interrupting the reader's own wait still works, and leaves the request
 * for whoever else is waiting on it.
 */
export const askingOnce = <Value>(url: string, ask: Effect.Effect<Value>): Effect.Effect<Value> =>
  Effect.suspend(() => {
    const inFlight = flights()

    const already = inFlight.get(url) as PromiseLike<Value> | undefined
    if (already !== undefined) return Effect.promise(() => already)

    const started = Effect.runPromise(
      Effect.ensuring(
        ask,
        Effect.sync(() => {
          inFlight.delete(url)
        })
      )
    )
    inFlight.set(url, started)

    return Effect.promise(() => started)
  })

/**
 * Empties the map, for a test that is about to intercept `fetch` differently.
 *
 * The one thing here that a browser never needs. A read forks the work that fills in
 * sizes and stacks, so the promise a caller waits on can settle while requests it
 * started are still in the air — which is exactly the design, and across a test
 * boundary it means the next test's identical address joins the last test's request
 * and is answered by an intercept that has since been replaced. That went unnoticed
 * while every intercepted answer was immediate; a route asked again after a wait
 * holds the entry long enough to be found, and a test asserting that a size could not
 * be read got the size the test before it had been served.
 *
 * Nothing is cancelled. The requests go on and settle into a map nobody is reading,
 * which is what the reading-ahead does in a browser every time a reader walks away.
 */
export const forgetFlights = (): void => {
  ;(globalThis as World)[FLIGHTS] = undefined
}
