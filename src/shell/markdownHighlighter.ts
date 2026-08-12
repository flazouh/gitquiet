import { Effect } from "effect"
import type { Highlight } from "../markdown/loadHighlight"

/** Where the manifest publishes it. */
const CHUNK = "/markdown-highlighter.js"

let loaded: Highlight | undefined

/**
 * Fetches the highlighter, once, the way an extension has to.
 *
 * Same shape as `loadDiffEngine`: the import is by extension URL, because a
 * content script's relative imports resolve against github.com.
 */
export const loadMarkdownHighlighter: Effect.Effect<Highlight> = Effect.suspend(() => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: () => import(/* @vite-ignore */ browser.runtime.getURL(CHUNK)),
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
