import { Effect, Option } from "effect"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import type { ReactNode } from "react"
import type { Changes, WatchedKeyValue } from "../../../src/ports/KeyValue"
import type { Store } from "../../../src/ports/Settings"
import { settingsStore } from "../../../src/settings/store"
import { ArtProvider } from "../../../src/ui/art"
import { RegistryProvider } from "../../../src/ui/atoms"
import { HUGEICONS } from "../../../src/ui/hugeicons"
import { PortraitsProvider } from "../../../src/ui/portraits"
import { RendererProvider } from "../../../src/ui/renderer"
import { SettingsProvider } from "../../../src/ui/settings"
import { Theme } from "../../../src/ui/Theme"
import { Toasts } from "../../../src/ui/Toasts"
import { PaintedMarkdown } from "../../../src/ui/PaintedMarkdown"
import { loadDiffEngine } from "./diffEngine"
import { loadMarkdownHighlighter } from "./markdownHighlighter"
import { loadMarkdownMermaid } from "./markdownMermaid"
import { inThisWindow } from "./somewhere"

const highlight = (code: string, language: string, theme: string) =>
  loadMarkdownHighlighter.pipe(Effect.flatMap((draw) => draw(code, language, theme)))

const mermaid = (code: string) =>
  loadMarkdownMermaid.pipe(Effect.flatMap((draw) => draw(code)))

/**
 * What a window can answer, where the extension's `shell/supplied.tsx` answers
 * for a page on github.com.
 *
 * That file says it is the one another platform rewrites, and this is the
 * rewrite. Every screen above asks for the same things and none of them learns
 * which of the two it got.
 */

/**
 * The reader's choices, in the window's own storage.
 *
 * `settingsStore` is already the platform-agnostic half — it takes somewhere to
 * put things by name and does the deciding itself — so there is nothing to
 * reimplement here beyond the somewhere. `localStorage` is the right somewhere
 * for exactly the reasons it is the wrong one for a token: it is readable by
 * anything that can run script in this webview, and a choice about how to draw a
 * diff does not care.
 *
 * Not synced, which is a real loss against the extension's `storage.sync`: a
 * reader who chose side-by-side diffs on the laptop meant it here too. Putting
 * these behind the main process and a file is the honest fix, and is a change of
 * its own rather than something to sketch badly now.
 */
const asKeyValue = (): WatchedKeyValue => {
  const listeners = new Set<(changes: Changes) => void>()
  const where = inThisWindow()

  return {
    get: (keys: string | Array<string>) => {
      const found: Record<string, unknown> = {}

      for (const key of typeof keys === "string" ? [keys] : keys) {
        const held = where?.getItem(key) ?? null
        if (held === null) continue
        try {
          found[key] = JSON.parse(held) as unknown
        } catch {
          // Written by an older version of this app, or by hand. The store above
          // answers an unreadable value with the defaults, which is what should
          // happen to a value nobody can parse.
        }
      }

      return Promise.resolve(found)
    },
    set: (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        where?.setItem(key, JSON.stringify(value))
      }
      // Told to itself, because there is no second tab to hear it from. The
      // extension gets this from the browser; here the only writer is us, and a
      // dialog that changes a setting and a list that draws with it are two
      // trees that still have to agree.
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

let held: Store | undefined

/** One store for the window, for the same reason the extension keeps one per page. */
export const settings = (): Store => (held ??= settingsStore(asKeyValue()))

let holding: AtomRegistry.AtomRegistry | undefined

/**
 * Where every read in this window is kept, and there is only one of it.
 *
 * The window becomes the card rather than opening one, so the list is unmounted
 * while a pull request is being read and mounted again on the way back. One
 * registry across both is what makes going back instant instead of four seconds
 * of GitHub being asked for a list it already answered.
 */
const registry = (): AtomRegistry.AtomRegistry => (holding ??= AtomRegistry.make())

/**
 * Nobody, for now.
 *
 * The hovercard reads are a screen this window does not have yet, and every
 * field of a portrait is already optional — so a face here draws the login and
 * the avatar and stops, which is what a failed read draws too. Wired explicitly
 * rather than left to the context's own fallback so that the day it is real,
 * there is one line to change and it is this one.
 */
const nobody = {
  look: () => Effect.succeed(Option.none()),
  count: () => Effect.succeed(Option.none())
}

/**
 * The providers this window can honestly fill, which is now all of them but one.
 *
 * The renderer is here because the card is: a diff engine handed over before
 * there was a screen to ask for it would have been a loader that cannot load, and
 * now it is an import that can. Only the portraits are still nobody.
 */
export const Supplied = ({ children }: { readonly children: ReactNode }) => (
  <RegistryProvider registry={registry()}>
    <SettingsProvider store={settings()}>
      <Theme scope="document">
        {/* Ours, for a reader who never opened the settings: there is no row of
            GitHub's own glyphs above this window for theirs to match, so the
            recognition that argues for Octicons on their page argues for nothing
            here. The table is the shared one either way — this hands down which
            of the two is the default, not a set of its own. */}
        <ArtProvider here={HUGEICONS}>
        <PortraitsProvider reads={nobody}>
          <RendererProvider load={loadDiffEngine}>
            <PaintedMarkdown highlight={highlight} mermaid={mermaid}>
            {/* One for the window, above every screen in it: a refusal outlives
                the menu that caused it, and often the screen as well. Wrapping
                rather than sitting beside, so the screens that wrap themselves in
                this again do not each get a Toaster of their own. */}
            <Toasts>{children}</Toasts>
            </PaintedMarkdown>
          </RendererProvider>
        </PortraitsProvider>
        </ArtProvider>
      </Theme>
    </SettingsProvider>
  </RegistryProvider>
)
