import { useCallback, useEffect, useState } from "react"
import { SCHEME_KEY as KEY } from "../../../src/ui/applyTheme"
import { inThisWindow } from "./somewhere"

/**
 * Early-paint cache for light/dark, and the hook tests still drive.
 *
 * The durable choice is `settings.theme.appearance`. `Theme` writes this same
 * key whenever that choice changes, and `index.html` reads it before React so
 * the window does not flash the wrong scheme. `useScheme` remains for the
 * characterisation tests and for any caller that only needs the class toggle.
 */

export type Scheme = "system" | "light" | "dark"

const SCHEMES: ReadonlyArray<Scheme> = ["system", "light", "dark"]

const asked = (): MediaQueryList => window.matchMedia("(prefers-color-scheme: dark)")

/** What was chosen last, and `system` for a reader who has never said. */
export const chosenScheme = (): Scheme => {
  const held = inThisWindow()?.getItem(KEY)
  return SCHEMES.find((one) => one === held) ?? "system"
}

const isDark = (scheme: Scheme): boolean =>
  scheme === "system" ? asked().matches : scheme === "dark"

/**
 * The palette hangs off one class on the document, which is what this sets.
 *
 * On `<html>` rather than on the app's root, because the menus portal out to the
 * body and a palette that stopped at the root would leave every dropdown in the
 * other scheme.
 */
export const paintScheme = (scheme: Scheme): void => {
  document.documentElement.classList.toggle("dark", isDark(scheme))
}

/**
 * The choice, held where React can draw it and written where the next launch can
 * read it before anything is drawn at all.
 *
 * The listener is only attached while the choice is `system`: it used to live in
 * `index.html` unconditionally, which meant a reader who asked for light and then
 * put their desktop into dark had the window overrule them.
 */
export const useScheme = (): {
  readonly scheme: Scheme
  readonly choose: (next: Scheme) => void
} => {
  const [scheme, setScheme] = useState<Scheme>(chosenScheme)

  useEffect(() => {
    paintScheme(scheme)
    if (scheme !== "system") return

    const media = asked()
    const follow = () => paintScheme("system")
    media.addEventListener("change", follow)
    return () => media.removeEventListener("change", follow)
  }, [scheme])

  const choose = useCallback((next: Scheme) => {
    setScheme(next)
    // The window changes colour either way; storage that refuses only means it
    // forgets by the next launch, which `inThisWindow` already swallows.
    inThisWindow()?.setItem(KEY, next)
  }, [])

  return { scheme, choose }
}
