import { Effect } from "effect"
import type { DrawMermaid } from "../markdown/loadMermaid"

/** Where the manifest publishes it. */
const CHUNK = "/markdown-mermaid.js"

let loaded: DrawMermaid | undefined

/**
 * Fetches the mermaid renderer, once, the way an extension has to.
 *
 * Same shape as `loadMarkdownHighlighter`: the import is by extension URL,
 * because a content script's relative imports resolve against github.com.
 */
export const loadMarkdownMermaid: Effect.Effect<DrawMermaid> = Effect.suspend(() => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: () => import(/* @vite-ignore */ browser.runtime.getURL(CHUNK)),
    catch: () => "mermaid-unavailable" as const
  }).pipe(
    Effect.map((module) => (module as { draw: DrawMermaid }).draw),
    Effect.tap((draw) =>
      Effect.sync(() => {
        loaded = draw
      })
    ),
    Effect.orElseSucceed(() => () => Effect.succeed(null))
  )
})
