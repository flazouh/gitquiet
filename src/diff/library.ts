import { Option } from "effect"
import type { FetchedDiff, FileDiff } from "../domain/PullRequest"

/** Whatever actually goes to GitHub. Many paths at a time, because it accepts them. */
export type DiffFetcher = (paths: ReadonlyArray<string>) => Promise<ReadonlyArray<FetchedDiff>>

export type DiffLibrary = {
  /** The content for one file, from memory if it is there and from GitHub if not. */
  readonly ask: (path: string) => Promise<Option.Option<FileDiff>>
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
  /** One promise per path in the air, handed to everyone who asks for it. */
  const waiting = new Map<string, Promise<Option.Option<FileDiff>>>()
  const settlers = new Map<string, (found: Option.Option<FileDiff>) => void>()
  /** Wanted, not yet sent. The front of it goes out first. */
  const queued: Array<string> = []

  let running = 0
  let scheduled = false

  const promiseFor = (path: string): Promise<Option.Option<FileDiff>> => {
    const already = waiting.get(path)
    if (already !== undefined) return already

    const promise = new Promise<Option.Option<FileDiff>>((resolve) =>
      settlers.set(path, resolve)
    )
    waiting.set(path, promise)
    return promise
  }

  const finish = (path: string, found: Option.Option<FileDiff>): void => {
    settlers.get(path)?.(found)
    settlers.delete(path)
    waiting.delete(path)
  }

  const send = (paths: ReadonlyArray<string>): void => {
    running += 1
    void fetch(paths)
      .then(
        (found) => {
          for (const entry of found) held.set(entry.path, Option.some(entry.diff))
          // A path the answer skipped is a path GitHub will not diff: binary, or
          // too large. Remembered as such, so opening it again is free.
          for (const path of paths) if (!held.has(path)) held.set(path, Option.none())
          for (const path of paths) finish(path, held.get(path) ?? Option.none())
        },
        // A failed request says nothing about the file, so nothing is remembered
        // and the next ask goes out again.
        () => {
          for (const path of paths) finish(path, Option.none())
        }
      )
      .finally(() => {
        running -= 1
        pump()
      })
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
    ask: (path) => {
      const found = held.get(path)
      if (found !== undefined) return Promise.resolve(found)

      const promise = promiseFor(path)

      // To the front, since someone is looking at this one: it may have been
      // queued as part of a window that has not gone out yet.
      const at = queued.indexOf(path)
      if (at > 0) queued.splice(at, 1)
      if (at !== 0) queued.unshift(path)

      schedule()
      return promise
    },

    warm: (paths) => {
      for (const path of paths) {
        if (!wanted(path)) continue
        void promiseFor(path)
        queued.push(path)
      }
      schedule()
    }
  }
}
