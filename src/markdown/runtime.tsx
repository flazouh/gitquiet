import { Effect } from "effect"
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { afterIdle } from "../app/idle"
import { highlightCode, type Highlight } from "./loadHighlight"
import { drawMermaid, type DrawMermaid } from "./loadMermaid"

/**
 * A diagram is drawn in a quiet moment; a colour is drawn at once.
 *
 * Measured on a press between two pull requests: one mermaid fence of 296
 * characters held the main thread for 794ms, on a page React had drawn and
 * committed at 220ms, so the reader sat in front of a frozen page for three
 * quarters of a second waiting for a picture they had not scrolled to. Every
 * coloured fence on the same page cost between 8ms and 71ms, which is why they
 * are not in this.
 *
 * Said here rather than in the fence, because it is a fact about the renderer
 * and not about the component that asks for one, and rather than in a shell,
 * because each platform supplies its own mermaid and only one of them would
 * remember.
 */
const held =
  (draw: DrawMermaid): DrawMermaid =>
  (code) =>
    afterIdle(Effect.suspend(() => draw(code)))

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
  mermaid: held(drawMermaid),
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
}) => {
  /*
   * Held as long as the renderer it wraps, because a fence waits on whatever
   * function it was given: a new one each render is a fence that starts its wait
   * again every render and never draws.
   */
  const waiting = useMemo(() => held(mermaid), [mermaid])

  return (
    <MarkdownDraw.Provider value={{ highlight, mermaid: waiting, syntaxTheme }}>
      {children}
    </MarkdownDraw.Provider>
  )
}

export const useMarkdownDraw = (): {
  readonly highlight: Highlight
  readonly mermaid: DrawMermaid
  readonly syntaxTheme: string
} => useContext(MarkdownDraw)
