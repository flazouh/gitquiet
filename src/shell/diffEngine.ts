import { Effect } from "effect"
import { DiffEngineUnavailable, type DiffEngine } from "../ports/Renderer"
import { lendCustomElements } from "../ui/customElements"

/** Where the manifest publishes it. */
const ENGINE = "/diff-engine.js"

let loaded: DiffEngine | undefined

/**
 * Fetches the renderer, once, the way an extension has to.
 *
 * The import is by extension URL rather than by path: a content script's
 * relative imports resolve against github.com, where this file does not exist
 * and would not be allowed to. The result is held so the second file someone
 * opens costs nothing, and a failure is not held, so a flaky first load can be
 * tried again.
 *
 * This lives in the shell because both halves of it are this platform's: an
 * extension URL, and the interface's custom elements handed to a renderer that
 * is not allowed to know the interface exists. Another platform writes its own
 * few lines here — a static import, most likely — and nothing above it moves.
 */
export const loadDiffEngine = Effect.suspend(() => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: () => {
      lendCustomElements()
      // The browser holds the module itself, so a second import of the same URL
      // costs nothing and a failed one is not remembered by anybody.
      return import(/* @vite-ignore */ browser.runtime.getURL(ENGINE))
    },
    catch: (cause) => new DiffEngineUnavailable({ cause })
  }).pipe(
    Effect.map((module) => module as DiffEngine),
    Effect.tap((module) =>
      Effect.sync(() => {
        loaded = module
      })
    )
  )
})
