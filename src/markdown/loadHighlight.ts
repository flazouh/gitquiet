import { Effect } from "effect"

/**
 * How a labelled fence gets its colours, if this platform can colour them.
 *
 * The highlighter is a separate file: Shiki plus six grammars, fetched the
 * first time a labelled fence is drawn. A content script cannot import that
 * file by path. The shell sets the loader; tests set it to the same function
 * the chunk exports. Until then every fence stays plain text, which is
 * legible.
 */
export type Highlight = (
  code: string,
  language: string,
  theme: "light" | "dark"
) => Effect.Effect<string | null>

const none: Highlight = () => Effect.succeed(null)

let loader: () => Effect.Effect<Highlight> = () => Effect.succeed(none)

export const setHighlightLoader = (next: () => Effect.Effect<Highlight>): void => {
  loader = next
}

export const resetHighlightLoader = (): void => {
  loader = () => Effect.succeed(none)
}

export const highlightCode: Highlight = (code, language, theme) =>
  loader().pipe(Effect.flatMap((highlight) => highlight(code, language, theme)))
