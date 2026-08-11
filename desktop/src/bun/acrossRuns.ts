import { Effect } from "effect"
import { homedir } from "node:os"
import { join } from "node:path"
import { clampPageZoom } from "../shared/pageZoom"

/**
 * The few facts about the window that outlive the run they were set in.
 *
 * Zoom is the first of them, and it is here rather than in the webview's own
 * storage for two reasons. It is a property of the window and not of the page —
 * `setPageZoom` lives on the main-process handle — and it has to be known before
 * the first paint: a zoom read in the interface and asked for afterwards is a
 * frame drawn at the wrong size, every launch, for as long as the reader keeps
 * their zoom.
 *
 * Everything in here is a convenience, and the discipline follows from that. A
 * file that will not parse, was written by another build, or holds a number
 * nobody could have pressed answers with the defaults; a write that cannot happen
 * is not mentioned again. The alternative is an app that will not open because of
 * a preference, which is a bad trade for remembering a zoom.
 *
 * The token is not here and never will be. That is the keychain's job, and the
 * reason `keychain.ts` exists rather than a second field on this file.
 */

/**
 * The shape written, so a build that changes it can ignore what the last one
 * left. A version rather than a migration, exactly as `view/kept.ts` does it:
 * what is kept is one number the reader can set again with one keypress.
 */
const SHAPE = 1

export type AcrossRuns = {
  /** Page zoom, in the same tenths `nextPageZoom` steps through. */
  readonly zoom: number
}

export const DEFAULTS: AcrossRuns = { zoom: 1 }

/**
 * Somewhere to keep it, which is a file in the app's own directory and a path in
 * a temporary one under test.
 *
 * A seam rather than a mock: the tests write and read real files, because the
 * cases worth having — half-written JSON, a directory that is not one — are cases
 * a fake storage would have to pretend to have.
 */
export type Where = {
  readonly read: () => Effect.Effect<string | null>
  readonly write: (text: string) => Effect.Effect<void>
}

export const inFile = (path: string): Where => ({
  read: () =>
    Effect.tryPromise(() => Bun.file(path).text()).pipe(Effect.orElseSucceed(() => null)),
  write: (text) =>
    Effect.tryPromise(() => Bun.write(path, text)).pipe(
      Effect.asVoid,
      Effect.catch(() => Effect.void)
    )
})

/**
 * Where that file goes: beside the app's other per-user state, under the
 * identifier it is signed with, so two channels of the same app do not read each
 * other's window.
 *
 * A demo gets its own, because a zoom set for a camera is not a zoom the reader
 * asked their real window for.
 */
export const fileFor = (identifier: string, demo: boolean): string =>
  join(
    homedir(),
    "Library",
    "Application Support",
    identifier,
    demo ? "window-demo.json" : "window.json"
  )

export const readAcrossRuns = (where: Where): Effect.Effect<AcrossRuns> =>
  where.read().pipe(
    Effect.map((held): AcrossRuns => {
      if (held === null) return DEFAULTS

      try {
        const kept = JSON.parse(held) as { readonly shape?: unknown; readonly it?: unknown }
        if (kept.shape !== SHAPE) return DEFAULTS

        const it = kept.it as { readonly zoom?: unknown } | null
        return { zoom: clampPageZoom(it?.zoom) }
      } catch {
        return DEFAULTS
      }
    })
  )

export const keepAcrossRuns = (where: Where, it: AcrossRuns): Effect.Effect<void> =>
  where.write(JSON.stringify({ shape: SHAPE, at: new Date().toISOString(), it }, null, 2))

/**
 * The same write, once per burst, holding whatever was set last.
 *
 * Zoom is pressed in bursts — three taps of Cmd+= is three requests — and writing
 * from each of them raced: the window finished at 1.3 while the file said 1.1,
 * because a write that started earlier landed later. Waiting out the burst makes
 * the last value the one on disk and turns a handful of writes into one.
 *
 * A quarter of a second, which is longer than a burst of keypresses and shorter
 * than the gap before anybody quits.
 */
export const keepingLatest = (where: Where, after = 250): ((it: AcrossRuns) => void) => {
  let waiting: ReturnType<typeof setTimeout> | undefined

  return (it) => {
    if (waiting !== undefined) clearTimeout(waiting)
    waiting = setTimeout(() => {
      waiting = undefined
      void Effect.runPromise(keepAcrossRuns(where, it))
    }, after)
  }
}
