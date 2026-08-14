import { Effect } from "effect"
import type { Highlight } from "../../../src/markdown/loadHighlight"

let loaded: Highlight | undefined

/**
 * Fetches the highlighter, once, beside the window rather than built into it.
 *
 * Same reason as `loadDiffEngine`: Electrobun inlines every import it can
 * resolve, and this file must not be one of them.
 */
export const loadMarkdownHighlighter: Effect.Effect<Highlight> = Effect.suspend(() => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: () => {
      const beside = new URL("markdown-highlighter.js", window.location.href).href
      return import(/* @vite-ignore */ beside)
    },
    catch: () => "highlighter-unavailable" as const
  }).pipe(
    Effect.map((module) => (module as { highlight: Highlight }).highlight),
    Effect.tap((highlight) =>
      Effect.sync(() => {
        loaded = highlight
      })
    ),
    Effect.orElseSucceed(() => () => Effect.succeed(null))
  )
})
