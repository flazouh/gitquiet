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
 */
const MarkdownDraw = createContext<{
  readonly highlight: Highlight
  readonly mermaid: DrawMermaid
}>({
  highlight: highlightCode,
  mermaid: drawMermaid
})

export const MarkdownDrawProvider = ({
  highlight,
  mermaid,
  children
}: {
  readonly highlight: Highlight
  readonly mermaid: DrawMermaid
  readonly children: ReactNode
}) => (
  <MarkdownDraw.Provider value={{ highlight, mermaid }}>{children}</MarkdownDraw.Provider>
)

export const useMarkdownDraw = (): {
  readonly highlight: Highlight
  readonly mermaid: DrawMermaid
} => useContext(MarkdownDraw)
