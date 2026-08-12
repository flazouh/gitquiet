import { Effect } from "effect"

/**
 * How a mermaid fence becomes a diagram, if this platform can draw one.
 *
 * Mermaid is a separate file, fetched the first time a mermaid fence is drawn.
 * The shell sets the loader; tests set it to a function that returns SVG.
 * Until then the fence stays plain text, which is still the source.
 */
export type DrawMermaid = (code: string) => Effect.Effect<string | null>

const none: DrawMermaid = () => Effect.succeed(null)

let loader: () => Effect.Effect<DrawMermaid> = () => Effect.succeed(none)

export const setMermaidLoader = (next: () => Effect.Effect<DrawMermaid>): void => {
  loader = next
}

export const resetMermaidLoader = (): void => {
  loader = () => Effect.succeed(none)
}

export const drawMermaid: DrawMermaid = (code) =>
  loader().pipe(Effect.flatMap((draw) => draw(code)))
