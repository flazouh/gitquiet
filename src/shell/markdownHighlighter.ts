import { Effect } from "effect"
import { highlightThrough } from "../markdown/highlighterClient"
import type { Highlight } from "../markdown/loadHighlight"

/**
 * Sends highlighting to the extension worker, away from GitHub's render thread.
 */
const highlight: Highlight = highlightThrough({
  sendMessage: (message) => browser.runtime.sendMessage(message)
})

export const loadMarkdownHighlighter: Effect.Effect<Highlight> = Effect.succeed(highlight)
