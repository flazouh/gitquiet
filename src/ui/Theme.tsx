import { useCallback, useEffect, useLayoutEffect, type ReactNode } from "react"
import { ROOT_ID } from "./mount"
import {
  paintFloor,
  paintTheme,
  paintTokens,
  prefersDarkScheme,
  rememberedTheme
} from "./applyTheme"
import { DEFAULTS } from "../domain/Settings"
import type { Appearance, Pack } from "../domain/theme"
import { packOf, tokensOf } from "../domain/theme"
import { OVER_ID, ourOutsides, outsideHost } from "./outside"
import { schemeOnPage } from "./theirScheme"
import { useSettings } from "./useSettings"

/**
 * Where the tokens land.
 *
 * `root` — only `#gitquiet-root`. The extension must not paint `<html>`: that
 * is GitHub's page, and our variables would restyle their chrome.
 *
 * `document` — `<html>`. The desktop window portals menus to `body`, so the
 * palette has to hang off the document for dropdowns to match the screens.
 */
export type ThemeScope = "root" | "document"

const targetOf = (scope: ThemeScope): HTMLElement | null => {
  if (scope === "document") return document.documentElement
  return document.getElementById(ROOT_ID)
}

/**
 * The element to paint, where the caller is holding it.
 *
 * A screen builds its container before the page has anywhere to put it —
 * GitHub renders the conversation region with React, well after a content
 * script runs — so it renders into a detached div and the takeover appends it
 * later. `getElementById` cannot see that div, and the effect below would find
 * nothing and paint nothing: the reader's pack was on disk, applied on every
 * change they made, and gone on the next load. Worse on a navigation, where the
 * lookup does find a root — the outgoing screen's, on its way off the page.
 *
 * So the screen says which element is its own, and the lookup is what is left
 * for a caller that has no container to name: the desktop, which paints the
 * document, and a test rendering the interface into the page.
 */
export const Theme = ({
  scope = "root",
  element,
  here = "gitquiet",
  children
}: {
  readonly scope?: ThemeScope
  readonly element?: HTMLElement | undefined
  /**
   * The pack this place wears where the reader has not asked for one by name.
   *
   * The extension passes GitHub's, because it is drawn inside GitHub's page. Ours
   * is the default here for the two callers that are not standing on their page:
   * the desktop window, and a test rendering a screen with no shell around it.
   */
  readonly here?: Pack
  readonly children?: ReactNode
}) => {
  const { settings, ready } = useSettings()

  const paint = useCallback(
    (appearance: Appearance, pack: Pack, remember: boolean) => {
      const root = element ?? targetOf(scope)
      if (root === null) return

      /*
       * "System", on a page, means the page.
       *
       * A reader on GitHub's dark theme with a light desktop had our interface paint white in the
       * middle of their black page — the same fault as having no theme at all. Their choice is in
       * `data-color-mode`, and where that says `auto` it defers to the machine, so both follow the
       * desktop together. The desktop app has no page to read and keeps asking the machine.
       */
      const dark =
        scope === "document"
          ? prefersDarkScheme()
          : schemeOnPage(document.documentElement, prefersDarkScheme()) === "dark"

      // Made here rather than waited for: the hover cards portal into it, and the first of those
      // is rendered long after this effect ran.
      if (scope !== "document") outsideHost(document, OVER_ID)

      const scheme = paintTheme(root, appearance, pack, dark, remember)
      /*
       * And every element of ours that had to stand outside the root — the bar, the host the
       * hover cards portal into. Tokens are inline custom properties, so nothing inherits across
       * that gap: unpainted, they resolve the stylesheet's light defaults and paint white on a
       * dark page. See `outside.ts`.
       */
      for (const host of ourOutsides(document)) {
        paintTokens(host, tokensOf(pack, scheme), scheme)
      }

      /*
       * And the floor under all of it, which is the page's own.
       *
       * One value, under our own name, so the rule in `quiet.css` has something
       * to read while their chrome keeps reading Primer's. The rule is gated on
       * `data-gitquiet-taken`, so leaving a page we own hands the colour back
       * without this having to be undone.
       */
      if (scope !== "document") paintFloor(document, tokensOf(pack, scheme))
    },
    [scope, element]
  )

  /*
   * The colours from last time, before the browser draws anything.
   *
   * Reading the real choices is asynchronous, and the effect below waits for it. That
   * wait is a frame, and until this ran it was a frame of the stylesheet's light pack:
   * on a dark page, our own interface flashing white, then correcting itself. A layout
   * effect is the last moment before the browser paints, so the remembered pack lands
   * in the same frame the interface first appears in.
   *
   * It paints and stops there. What the store answers is still the answer, and it
   * arrives a moment later through the effect below — the same colours, in the ordinary
   * case, which is why the correction is invisible rather than a second flash.
   *
   * Nothing remembered means nobody has been here yet, and the defaults are what the
   * store is about to answer for them. Painting those is a guess, so it is not written
   * back; it is also dark on a dark page, which is the whole of what went wrong.
   */
  useLayoutEffect(() => {
    if (ready) return
    // Remembered is always a pack: what gets written back is the resolved answer,
    // never `match`. The defaults behind it are the reader's answer, so they are
    // resolved here the same way the effect below resolves them.
    const first = rememberedTheme() ?? { ...DEFAULTS.theme, pack: packOf(DEFAULTS.theme.pack, here) }
    paint(first.appearance, first.pack, false)
  }, [ready, paint, here])

  useEffect(() => {
    if (!ready) return

    const pack = packOf(settings.theme.pack, here)
    paint(settings.theme.appearance, pack, true)

    if (settings.theme.appearance !== "system") return

    const stop: Array<() => void> = []
    const again = () => paint(settings.theme.appearance, pack, true)

    if (typeof matchMedia === "function") {
      const media = matchMedia("(prefers-color-scheme: dark)")
      media.addEventListener("change", again)
      stop.push(() => media.removeEventListener("change", again))
    }

    // They rewrite the attribute in place when the reader changes appearance in their settings,
    // which is a change of theme without a load and so without anything else to notice it.
    if (scope !== "document") {
      const watch = new MutationObserver(again)
      watch.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-color-mode"]
      })
      stop.push(() => watch.disconnect())
    }

    return () => {
      for (const end of stop) end()
    }
  }, [ready, scope, paint, here, settings.theme.appearance, settings.theme.pack])

  return children ?? null
}
