import { createContext, useContext, type ReactNode } from "react"
import { highlightCode, type Highlight } from "./loadHighlight"
import { drawMermaid, type DrawMermaid } from "./loadMermaid"

/**
 * How this tree colours fences and draws mermaid, if it can.
 *
 * The highlighter and mermaid live in their own files. The shell fetches those
 * files. The screens that draw markdown are a second bundle, so a module
 * variable set in the shell is a different variable from the one the screens
 * read. This context is how the shell hands the functions across that cut,
 * the same way `RendererProvider` hands the diff engine.
 *
 * `syntaxTheme` is the Shiki theme name for labelled fences. The shell fills it
 * from the painted pack; tests that never wrap this keep GitHub light.
 */
const MarkdownDraw = createContext<{
  readonly highlight: Highlight
  readonly mermaid: DrawMermaid
  readonly syntaxTheme: string
}>({
  highlight: highlightCode,
  mermaid: drawMermaid,
  syntaxTheme: "github-light-default"
})

export const MarkdownDrawProvider = ({
  highlight,
  mermaid,
  syntaxTheme = "github-light-default",
  children
}: {
  readonly highlight: Highlight
  readonly mermaid: DrawMermaid
  readonly syntaxTheme?: string
  readonly children: ReactNode
}) => (
  <MarkdownDraw.Provider value={{ highlight, mermaid, syntaxTheme }}>
    {children}
  </MarkdownDraw.Provider>
)

export const useMarkdownDraw = (): {
  readonly highlight: Highlight
  readonly mermaid: DrawMermaid
  readonly syntaxTheme: string
} => useContext(MarkdownDraw)
