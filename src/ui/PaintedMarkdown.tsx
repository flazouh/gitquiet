import type { ReactNode } from "react"
import { syntaxOf } from "../domain/syntax"
import { MarkdownDrawProvider } from "../markdown/runtime"
import type { Highlight } from "../markdown/loadHighlight"
import type { DrawMermaid } from "../markdown/loadMermaid"
import { usePaintedTheme } from "./Theme"
import { useSettings } from "./useSettings"

/**
 * Markdown drawing, wearing the pack Theme just painted.
 *
 * The highlighter wants a Shiki theme name, not CSS variables. Theme already
 * resolved the pack and the scheme, so this is the one place those become a
 * name, and every fence under it asks for the same one.
 */
export const PaintedMarkdown = ({
  highlight,
  mermaid,
  children
}: {
  readonly highlight: Highlight
  readonly mermaid: DrawMermaid
  readonly children: ReactNode
}) => {
  const painted = usePaintedTheme()
  const { settings } = useSettings()
  const syntaxTheme = syntaxOf(settings.diff.syntax, painted.pack)[painted.scheme]
  return (
    <MarkdownDrawProvider highlight={highlight} mermaid={mermaid} syntaxTheme={syntaxTheme}>
      {children}
    </MarkdownDrawProvider>
  )
}
