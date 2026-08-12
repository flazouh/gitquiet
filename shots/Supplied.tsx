import { Effect, Option } from "effect"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import type { ReactNode } from "react"
import type { Changes, WatchedKeyValue } from "@/ports/KeyValue"
import type { Store } from "@/ports/Settings"
import { setHighlightLoader, type Highlight } from "@/markdown/loadHighlight"
import { setMermaidLoader, type DrawMermaid } from "@/markdown/loadMermaid"
import { type DiffEngine, DiffEngineUnavailable } from "@/ports/Renderer"
import { settingsStore } from "@/settings/store"
import { ArtProvider } from "@/ui/art"
import { RegistryProvider } from "@/ui/atoms"
import { lendCustomElements } from "@/ui/customElements"
import { HUGEICONS } from "@/ui/hugeicons"
import { PortraitsProvider } from "@/ui/portraits"
import { RendererProvider } from "@/ui/renderer"
import { SettingsProvider } from "@/ui/settings"
import { Theme } from "@/ui/Theme"
import { Toasts } from "@/ui/Toasts"
import { WithinProvider } from "@/ui/within"

/**
 * What the stage can answer, where `shell/supplied.tsx` answers for a page on
 * github.com and `desktop/src/view/supplied.tsx` answers for a window.
 *
 * The third rewrite of the same seam, and the shortest, because a photograph needs
 * less than either: nothing is written, nothing is synced, and no read outlives the
 * capture. Every screen above still asks for the same things and still cannot tell
 * which of the three it got.
 */

/**
 * Settings held for this document and no longer.
 *
 * A capture must not depend on what the last capture chose, so this is a plain map
 * rather than `localStorage`. Each view names the settings it wants to be
 * photographed under, and the map starts from those.
 */
const inMemory = (chosen: Record<string, unknown>): WatchedKeyValue => {
  const held = new Map<string, unknown>(Object.entries(chosen))
  const listeners = new Set<(changes: Changes) => void>()

  return {
    get: (keys: string | Array<string>) => {
      const found: Record<string, unknown> = {}
      for (const key of typeof keys === "string" ? [keys] : keys) {
        if (held.has(key)) found[key] = held.get(key)
      }
      return Promise.resolve(found)
    },
    set: (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) held.set(key, value)
      const changes: Changes = Object.fromEntries(
        Object.entries(items).map(([key, value]) => [key, { newValue: value }])
      )
      for (const listener of listeners) listener(changes)
      return Promise.resolve()
    },
    onChanged: {
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => {
        listeners.delete(listener)
      }
    }
  }
}

let loaded: DiffEngine | undefined
let highlighterLoaded: Highlight | undefined
let mermaidLoaded: DrawMermaid | undefined

setHighlightLoader(() => {
  if (highlighterLoaded !== undefined) return Effect.succeed(highlighterLoaded)
  const beside = new URL("markdown-highlighter.js", window.location.href).href
  return Effect.tryPromise({
    try: () => import(/* @vite-ignore */ beside),
    catch: () => "highlighter-unavailable" as const
  }).pipe(
    Effect.map((module) => (module as { highlight: Highlight }).highlight),
    Effect.tap((highlight) =>
      Effect.sync(() => {
        highlighterLoaded = highlight
      })
    ),
    Effect.orElseSucceed(() => () => Effect.succeed(null))
  )
})

setMermaidLoader(() => {
  if (mermaidLoaded !== undefined) return Effect.succeed(mermaidLoaded)
  const beside = new URL("markdown-mermaid.js", window.location.href).href
  return Effect.tryPromise({
    try: () => import(/* @vite-ignore */ beside),
    catch: () => "mermaid-unavailable" as const
  }).pipe(
    Effect.map((module) => (module as { draw: DrawMermaid }).draw),
    Effect.tap((draw) =>
      Effect.sync(() => {
        mermaidLoaded = draw
      })
    ),
    Effect.orElseSucceed(() => () => Effect.succeed(null))
  )
})

/**
 * The real diff renderer, fetched the way the extension fetches it.
 *
 * Not stubbed. The diff is the one screen where the thing being sold is the
 * rendering itself — syntax colours, word-level marks, the tree beside it — so a
 * photograph of a placeholder would be a photograph of a different product.
 *
 * The URL is assembled rather than written as a literal, for the reason the desktop
 * loader gives: a literal is something the bundler resolves at build time, and
 * resolving it pulls Shiki's grammars into the file the stage parses first.
 */
const loadDiffEngine = Effect.suspend(() => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: async () => {
      lendCustomElements()
      const beside = new URL("diff-engine.js", window.location.href).href
      return (await import(/* @vite-ignore */ beside)) as DiffEngine
    },
    catch: (cause) => new DiffEngineUnavailable({ cause })
  }).pipe(
    Effect.tap((engine) =>
      Effect.sync(() => {
        loaded = engine
      })
    )
  )
})

/**
 * Nobody, exactly as the desktop window has nobody.
 *
 * A hovercard with a real face and no contributions reads as a person who has done
 * nothing, and no view photographed here is hovering over one.
 */
const nobody = {
  look: () => Effect.succeed(Option.none()),
  count: () => Effect.succeed(Option.none())
}

export const Supplied = ({
  chosen = {},
  element,
  children
}: {
  /** Settings this view is photographed under, by their stored names. */
  readonly chosen?: Record<string, unknown>
  /**
   * Where the theme paints, for a caller that is not the whole document.
   *
   * The stage owns its page, so it leaves this alone and the tokens go onto `<html>`.
   * The landing page does not: it is a light page in its own palette with the
   * extension's screens mounted live inside it, and tokens on `<html>` there would
   * repaint the page around them. Given an element, the theme paints that element and
   * the screen inside it, and nothing above.
   */
  readonly element?: HTMLElement | undefined
  readonly children: ReactNode
}) => {
  const store: Store = settingsStore(inMemory(chosen))

  return (
    /*
     * `WithinProvider` for the same reason the theme takes an element: given one, the
     * screen keeps its chrome inside it. The bar is what needs telling. It is portalled
     * rather than rendered in place, and left to itself it goes to the top of the
     * window, which on a page with twelve screens down a column is eleven bars in the
     * wrong place and one across the headline.
     */
    <WithinProvider value={element}>
    <RegistryProvider registry={AtomRegistry.make()}>
      <SettingsProvider store={store}>
        <Theme scope={element === undefined ? "document" : "root"} element={element}>
          <ArtProvider here={HUGEICONS}>
            <PortraitsProvider reads={nobody}>
              <RendererProvider load={loadDiffEngine}>
                <Toasts>{children}</Toasts>
              </RendererProvider>
            </PortraitsProvider>
          </ArtProvider>
        </Theme>
      </SettingsProvider>
    </RegistryProvider>
    </WithinProvider>
  )
}
