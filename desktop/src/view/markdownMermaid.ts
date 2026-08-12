import { Effect } from "effect"
import type { DrawMermaid } from "../../../src/markdown/loadMermaid"

let loaded: DrawMermaid | undefined

/**
 * Fetches the mermaid renderer, once, beside the window rather than built into it.
 *
 * Same reason as `loadMarkdownHighlighter`: Electrobun inlines every import it
 * can resolve, and this file must not be one of them.
 */
export const loadMarkdownMermaid: Effect.Effect<DrawMermaid> = Effect.suspend(() => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: () => {
      const beside = new URL("markdown-mermaid.js", window.location.href).href
      return import(/* @vite-ignore */ beside)
    },
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
