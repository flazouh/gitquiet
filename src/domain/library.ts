import { Deferred, Effect, Option } from "effect"
import type { FetchedDiff, FileDiff } from "./PullRequest"

/** Whatever actually goes to GitHub. Many paths at a time, because it accepts them. */
export type DiffFetcher = (
  paths: ReadonlyArray<string>
) => Effect.Effect<ReadonlyArray<FetchedDiff>, unknown>

export type DiffLibrary = {
  /** The content for one file, from memory if it is there and from GitHub if not. */
  readonly ask: (path: string) => Effect.Effect<Option.Option<FileDiff>>
  /** Fetch these in the background, skipping any already held or already asked for. */
  readonly warm: (paths: ReadonlyArray<string>) => void
}

export type DiffLimits = {
  /** Paths per request. GitHub embeds five with the page; ten is one round trip. */
  readonly batch?: number
  /** Requests at once, kept low so warming never starves an opened file. */
  readonly inFlight?: number
}

/**
 * Every file's content, fetched once.
 *
 * GitHub sends the first few diffs with the page and holds the rest back, so
 * moving through a large pull request means a request per file, and the reader
 * waits at each one. This is the one place that knows what has been fetched:
 * asking for an open file and warming the ones around it go through the same
 * queue, so the two never race and never duplicate. A path is requested once,
 * whoever asks and however many times.
 *
 * Nothing here knows about React, and nothing here knows about GitHub — the
 * request is handed in — which is what makes the batching and the caching
 * testable by counting calls.
 */
export const diffLibrary = (fetch: DiffFetcher, limits?: DiffLimits): DiffLibrary => {
  const batch = limits?.batch ?? 10
  const inFlight = limits?.inFlight ?? 2

  /** Answers, including the answer "GitHub has nothing for this one". */
  const held = new Map<string, Option.Option<FileDiff>>()
  /** One waiting answer per path in the air, handed to everyone who asks for it. */
  const waiting = new Map<string, Deferred.Deferred<Option.Option<FileDiff>>>()
  /** Wanted, not yet sent. The front of it goes out first. */
  const queued: Array<string> = []

  let running = 0
  let scheduled = false

  const answerFor = (path: string): Deferred.Deferred<Option.Option<FileDiff>> => {
    const already = waiting.get(path)
    if (already !== undefined) return already

    // Made outside a fiber because the asking happens in a React render and the
    // queue below is plain state: this is one waiting answer per path, not a
    // piece of work.
    const made = Deferred.makeUnsafe<Option.Option<FileDiff>>()
    waiting.set(path, made)
    return made
  }

  const finish = (path: string, found: Option.Option<FileDiff>): void => {
    const answer = waiting.get(path)
    if (answer !== undefined) Deferred.doneUnsafe(answer, Effect.succeed(found))
    waiting.delete(path)
  }

  const send = (paths: ReadonlyArray<string>): void => {
    running += 1
    Effect.runFork(
      fetch(paths).pipe(
        Effect.map((found) => {
          for (const entry of found) held.set(entry.path, Option.some(entry.diff))
          // A path the answer skipped is a path GitHub will not diff: binary, or
          // too large. Remembered as such, so opening it again is free.
          for (const path of paths) if (!held.has(path)) held.set(path, Option.none())
          for (const path of paths) finish(path, held.get(path) ?? Option.none())
        }),
        // A failed request says nothing about the file, so nothing is remembered
        // and the next ask goes out again.
        Effect.catch(() =>
          Effect.sync(() => {
            for (const path of paths) finish(path, Option.none())
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            running -= 1
            pump()
          })
        )
      )
    )
  }

  const pump = (): void => {
    while (running < inFlight && queued.length > 0) send(queued.splice(0, batch))
  }

  // A microtask rather than a timer: everything one interaction wants is queued
  // in the same tick, so the opened file and the window around it leave together
  // in as few requests as the batch size allows.
  const schedule = (): void => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      pump()
    })
  }

  const wanted = (path: string): boolean => !held.has(path) && !waiting.has(path)

  return {
    // Suspended, so that the queueing happens when somebody runs the ask rather
    // than when they build it: an effect nobody runs must not move a path to the
    // front of a queue.
    ask: (path) =>
      Effect.suspend(() => {
        const found = held.get(path)
        if (found !== undefined) return Effect.succeed(found)

        const answer = answerFor(path)

        // To the front, since someone is looking at this one: it may have been
        // queued as part of a window that has not gone out yet.
        const at = queued.indexOf(path)
        if (at > 0) queued.splice(at, 1)
        if (at !== 0) queued.unshift(path)

        schedule()
        return Deferred.await(answer)
      }),

    warm: (paths) => {
      for (const path of paths) {
        if (!wanted(path)) continue
        answerFor(path)
        queued.push(path)
      }
      schedule()
    }
  }
}
