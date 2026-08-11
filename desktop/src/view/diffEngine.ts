import { Effect } from "effect"
import { type DiffEngine, DiffEngineUnavailable } from "../../../src/ports/Renderer"
import { lendCustomElements } from "../../../src/ui/customElements"

/**
 * The diff renderer, fetched beside the window rather than built into it.
 *
 * The extension publishes this as a file and fetches it by extension URL, because
 * a content script's relative imports resolve against github.com. This window has
 * no such problem and got a worse one: Electrobun bundles the webview from one
 * entrypoint and inlines every dynamic import, so importing the engine by path put
 * Shiki's four hundred grammars — fourteen megabytes — into the file the window
 * parses before it draws anything. It stopped answering.
 *
 * So the engine is its own build (`scripts/build-diff-engine.ts`), copied in
 * beside `index.html`, and asked for at runtime. The URL is assembled rather than
 * written as a literal on purpose: a literal is something the bundler resolves at
 * build time, and resolving it is exactly what must not happen.
 */

let loaded: DiffEngine | undefined

export const loadDiffEngine = Effect.suspend(() => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: async () => {
      // Handed over before the engine draws anything, because the elements it
      // fills are the interface's and it is not allowed to know the interface
      // exists.
      lendCustomElements()
      const beside = new URL("diff-engine.js", window.location.href).href
      return (await import(/* @vite-ignore */ beside)) as DiffEngine
    },
    catch: (cause) => new DiffEngineUnavailable({ cause })
  }).pipe(
    Effect.tap((engine) =>
      Effect.sync(() => {
        loaded = engine
      })
    )
  )
})
