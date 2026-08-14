/**
 * The one thing GitHub will not tell this extension outright: which query it is
 * willing to answer.
 *
 * Every other read in this gateway is a URL that says what it wants. An issue is
 * not: their issue pages are served by `/_graphql`, which answers a *persisted*
 * query — a name, and a hash of the query text that GitHub holds and this code
 * does not. Send the name alone and the route answers 422 `required key
 * 'query' missing`; send the name with a hash from yesterday's deploy and it
 * answers 404 `unknownQuery`. Both were measured against their live route.
 *
 * The hash is not a secret and there is nothing to reverse. GitHub's own page
 * asks with it several times a second, and the browser records every request it
 * makes: `performance.getEntriesByType("resource")` hands back the whole URL,
 * and the URL carries the body in its query string. So the hash is read off
 * GitHub's own traffic rather than guessed, extracted from their bundle, or
 * pinned to a constant that a deploy would break by the afternoon.
 *
 * Deliberately not a scrape of their JavaScript. The hashes really are in there
 * — chunk `20413-*.js` on the deploy this was written against — but finding them
 * means fetching some hundreds of files and searching each, once per deploy, for
 * something the page is about to say out loud anyway.
 */

import { type Duration, Effect, Option, UndefinedOr } from "effect"

/** Their route, which is the whole of what makes an entry worth reading. */
const ROUTE = "/_graphql"

/** Their body read as JSON, or nothing where it is not JSON at all. */
const read = UndefinedOr.liftThrowable(JSON.parse)

/**
 * As much of `performance` as this needs, which is one method.
 *
 * Narrowed so the harvest can be tested with a list of names rather than with a
 * browser: what is being read here is a string, and every browser detail around
 * it is somebody else's.
 */
export type Timings = {
  readonly getEntriesByType: (kind: string) => ReadonlyArray<{ readonly name: string }>
}

/** As much of a document as this needs, which is one lookup. */
export type Page = {
  readonly querySelector: (selector: string) => { readonly getAttribute: (name: string) => string | null } | null
}

/**
 * The name and hash out of one recorded request, or nothing.
 *
 * Nothing covers three separate cases and deliberately does not tell them apart:
 * an entry for some other route, a body that will not parse, and a body that
 * parses into something without the two fields. All three mean the same to the
 * caller, which is that this entry taught it nothing.
 */
const readOne = (name: string): Option.Option<readonly [string, string]> => {
  const address = URL.parse(name)
  if (address === null || address.pathname !== ROUTE) return Option.none()

  const body = address.searchParams.get("body")
  if (body === null) return Option.none()

  const parsed: unknown = read(body)
  if (typeof parsed !== "object" || parsed === null) return Option.none()

  const { persistedQueryName, query }: { persistedQueryName?: unknown; query?: unknown } = parsed
  if (typeof persistedQueryName !== "string" || typeof query !== "string") return Option.none()

  return Option.some([persistedQueryName, query] as const)
}

/**
 * Every persisted query this page has asked for, by name.
 *
 * In the order they happened, so the last answer wins. That is the case worth
 * having: GitHub deploying while a tab is open changes every hash at once, and
 * the one recorded before the deploy is refused from then on.
 */
export const askedFor = (timings: Timings): ReadonlyMap<string, string> => {
  const found = new Map<string, string>()

  for (const entry of timings.getEntriesByType("resource")) {
    const read = readOne(entry.name)
    if (Option.isSome(read)) found.set(read.value[0], read.value[1])
  }

  return found
}

/** The hash for one query, where this page has been seen asking for it. */
export const hashIn = (timings: Timings, name: string): Option.Option<string> =>
  Option.fromNullishOr(askedFor(timings).get(name))

/**
 * Being told about requests as they are made, rather than asked for afterwards.
 *
 * `PerformanceObserver` in the browser, narrowed to the two things this uses:
 * hand over the names as they happen, and hand back the way to stop. Narrowed
 * for the reason {@link Timings} is, which is that a list of strings is a thing
 * a test can produce and an observer is not.
 */
export type Watch = (onSeen: (names: ReadonlyArray<string>) => void) => () => void

/**
 * The hash for one query, waited for where the page has not asked by it yet.
 *
 * This is the difference between an issue that draws and one that hands itself
 * back to GitHub. A screen starts at `document_start`; GitHub's own app asks
 * its route some hundreds of milliseconds later, and {@link hashIn} read at the
 * top of that gap is honestly empty. Measured on `react/react` #35000: the read
 * failed every time until this was here, and the three queries were all in the
 * timings by the time anybody looked afterwards.
 *
 * Gives up rather than hanging. Nothing promises GitHub asks at all — their app
 * may have been served from a cache, or may not be the app on this page any
 * more — and a read that never ends is a page that stays blank until the
 * screen's own failsafe takes it down twenty seconds later.
 */
export const whenAsked = (
  timings: Timings,
  watch: Watch,
  name: string,
  within: Duration.Input
): Effect.Effect<Option.Option<string>> =>
  Effect.suspend(() => {
    // Asked before anything is set up, because on every navigation after the
    // first the page asked long ago and there is nothing to wait for.
    const had = hashIn(timings, name)
    if (Option.isSome(had)) return Effect.succeed(had)

    return Effect.callback<string>((resume) => {
      const stop = watch((seen) => {
        for (const one of seen) {
          const read = readOne(one)
          // Their page asks three queries and two of them are not this one, so
          // an entry that is not the wanted name is not an answer of any kind.
          if (Option.isNone(read) || read.value[0] !== name) continue
          resume(Effect.succeed(read.value[1]))
          return
        }
      })

      return Effect.sync(() => stop())
    }).pipe(Effect.timeoutOption(within))
  })

/**
 * Whether GitHub served the page this query would be asked on.
 *
 * What decides whether {@link whenAsked} is worth calling at all. Their app asks
 * an issue's query on the issue's own page, some hundreds of milliseconds after
 * it loads, and nowhere else: a reader who presses a row on one of our lists
 * moves the address without loading anything, so nobody is going to ask and the
 * wait is dead time in front of a card that cannot be drawn. Measured on the
 * first issue of a deploy, opened from our own list: 4364ms to draw, of which
 * about 1.7s was this wait and 2643ms was the page it fell back to.
 *
 * The navigation entry is the address the document was served for, and a
 * `pushState` since does not touch it. The path alone, because a search and a
 * fragment are the same page to their router as to this.
 *
 * True where the browser records no navigation at all. Nothing is known then, and
 * the wait it allows costs at most three seconds while skipping it would cost a
 * whole page fetch every time.
 */
export const servedFor = (timings: Timings, path: string): boolean => {
  const [entry] = timings.getEntriesByType("navigation")
  if (entry === undefined) return true

  const at = URL.parse(entry.name)
  return at === null || at.pathname === path
}

/**
 * A mutation's hash, which cannot be harvested the way a query's can.
 *
 * Everything above reads a hash off a request the page has already made, and
 * that works because their reads are GETs carrying the body in the query string.
 * A mutation is a POST. The body is in the body, `performance` records the URL
 * and nothing else, and no amount of watching their traffic will ever say what
 * hash they sent — measured, and it is why {@link askedFor} finds their three
 * queries on an issue page and never `createIssueMutation`.
 *
 * So this one is read out of their JavaScript, which the note at the top of this
 * file rejects for queries and which is the only source left for a mutation.
 * What made it a bad bargain there was the cost: hundreds of files fetched to
 * learn something the page was about to say out loud. Here the page never says
 * it, and the cost turns out to be small — the chunks are in the browser's cache
 * because their own app just loaded them, so this is a cache read rather than a
 * download.
 */

/**
 * Relay writes a persisted operation's hash beside its name, and this is the
 * shape: `params:{id:"<32 hex>",metadata:{},name:"<name>",operationKind:"mutation"}`.
 *
 * Anchored on the name and the kind together, then read backwards for the id.
 * Backwards because the name is the only part worth searching for — a chunk
 * holds dozens of these and they are all the same shape — and within a window
 * rather than at a fixed offset, so a `metadata` that stops being empty is a
 * hash still found rather than a screen that stops working.
 */
const WINDOW = 240

const ID = /id:"([0-9a-f]{32})"/g

export const hashOfMutation = (text: string, name: string): Option.Option<string> => {
  const found = text.indexOf(`name:"${name}",operationKind:"mutation"`)
  if (found === -1) return Option.none()

  const before = text.slice(Math.max(0, found - WINDOW), found)

  // The last one, which is the nearest: the window may open in the middle of the
  // operation before this one, and that one's id is not this one's.
  let nearest: string | undefined
  for (const hit of before.matchAll(ID)) nearest = hit[1]

  return Option.fromNullishOr(nearest)
}

/** One of their chunks, read, or nothing where it would not be read. */
export type Reading = (at: string) => Effect.Effect<Option.Option<string>>

/**
 * How many are read at once, and the reason the whole search is affordable.
 *
 * Measured against `flazouh/stack-probe`'s new-issue form on 5 August 2026: 185
 * scripts on the page, the hash in the 128th of them, 130 read before the search
 * stopped, 7 megabytes, 71 milliseconds. Ten at a time is what makes it 71
 * milliseconds rather than a second and a half — the reads are cache hits, so the
 * cost is almost all the waiting.
 */
const AT_ONCE = 10

/**
 * The hash for one mutation, out of the scripts this page has loaded.
 *
 * Stops at the first chunk that has it, which is why the batches are a loop
 * rather than one `Effect.all`: past the hash there is nothing to look for, and
 * on the measurement above that saved a quarter of the reads.
 *
 * Nothing where no chunk names it. Their bundle is theirs and they reshuffle it
 * weekly, so a shape that has moved has to be an answer rather than a crash —
 * and the caller has somewhere to send the reader either way, which is GitHub's
 * own form.
 */
export const hashOfMutationIn = (
  timings: Timings,
  reading: Reading,
  name: string
): Effect.Effect<Option.Option<string>> =>
  Effect.gen(function* () {
    const scripts = timings
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((at) => at.endsWith(".js"))

    for (let from = 0; from < scripts.length; from += AT_ONCE) {
      const read = yield* Effect.all(scripts.slice(from, from + AT_ONCE).map(reading), {
        concurrency: AT_ONCE
      })

      for (const text of read) {
        if (Option.isNone(text)) continue
        const found = hashOfMutation(text.value, name)
        if (Option.isSome(found)) return found
      }
    }

    return Option.none<string>()
  })

const metaOn = (page: Page, name: string): Option.Option<string> =>
  Option.fromNullishOr(page.querySelector(`meta[name="${name}"]`)?.getAttribute("content"))

/**
 * The nonce their GraphQL route refuses to answer without.
 *
 * Written into the document GitHub served, one per page load, and sent back on
 * every request their own app makes. Measured: the same call is 403 without it
 * and 200 with it, and the client-version header beside it turns out not to be
 * checked at all.
 */
export const nonceOn = (page: Page): Option.Option<string> => metaOn(page, "fetch-nonce")

/**
 * Which deploy this page came from, which is what a remembered hash is filed
 * under.
 *
 * GitHub ships many times a day, and a hash does not outlive the deploy that
 * minted it. Keeping one without this would mean a stale hash asked once per
 * page until something noticed the 404.
 */
export const releaseOn = (page: Page): Option.Option<string> => metaOn(page, "release")
