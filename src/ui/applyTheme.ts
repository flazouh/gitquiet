/**
 * Paint a pack onto a root element.
 *
 * Tokens are set as inline custom properties so they win over both Primer's
 * page variables (extension) and the desktop surface ladder, without rewriting
 * either stylesheet. `scheme` also toggles `.dark` for anything still keyed off
 * that class (desktop chrome).
 *
 * The early-paint key is shared with `desktop/.../index.html` and `scheme.ts`:
 * appearance is written here whenever settings change so the next launch does
 * not flash the wrong scheme before React boots.
 */

import { UndefinedOr } from "effect"
import { THEME_KNOBS } from "../domain/Settings"
import {
  resolveAppearance,
  tokensOf,
  type Appearance,
  type Pack,
  type Scheme,
  type ThemeTokens
} from "../domain/theme"
import { PACK, SCHEME } from "./keeping"

/**
 * Same spelling `index.html` and `scheme.ts` read before the first paint.
 *
 * Re-exported rather than moved, because this is the name every caller already
 * imports; the spelling itself now lives with the rest of them in `keeping.ts`.
 */
export const SCHEME_KEY = SCHEME

/** Its other half. Neither alone is enough to colour a frame. */
export const PACK_KEY = PACK

const DESKTOP_ALIASES = (tokens: ThemeTokens): Record<string, string> => ({
  "--background": tokens["--color-canvas"],
  "--surface-1": tokens["--color-canvas"],
  "--surface-3": tokens["--color-surface"],
  "--surface-4": tokens["--color-raised"],
  "--surface-5": tokens["--color-raised"],
  "--card": tokens["--color-surface"],
  "--popover": tokens["--color-raised"],
  "--foreground": tokens["--color-ink"],
  "--card-foreground": tokens["--color-ink"],
  "--popover-foreground": tokens["--color-ink"],
  "--muted-foreground": tokens["--color-ink-muted"],
  "--border": tokens["--color-line"],
  "--hover": tokens["--color-hover"],
  "--active": tokens["--color-active"],
  // Electrobun's WebKit drops every nested `@supports` after the first inside
  // `:root`, so Tailwind's `color-mix` fallback for these never applies and the
  // wells paint as solid `--foreground`. Set them from the pack instead.
  "--control": tokens["--color-hover"],
  "--control-hover": tokens["--color-active"],
  "--ink-accent": tokens["--color-ink-accent"],
  "--pass": tokens["--color-pass"],
  "--fail": tokens["--color-fail"],
  "--busy": tokens["--color-busy"],
  "--done": tokens["--color-done"]
})

/**
 * Writing that cannot throw.
 *
 * A private window, a profile with storage turned off and a spent quota all
 * reach here, and all three mean the same thing: the choice still paints this
 * session, and it is only forgotten by the next launch. The same lift
 * `remembered.ts` uses, for the same reason.
 */
const keep = UndefinedOr.liftThrowable((key: string, value: string) => {
  localStorage.setItem(key, value)
})

export const rememberAppearance = (appearance: Appearance): void => {
  keep(SCHEME_KEY, appearance)
}

export const rememberPack = (pack: Pack): void => {
  keep(PACK_KEY, pack)
}

/** Reading that cannot throw, for the same three reasons `keep` cannot. */
const recall = UndefinedOr.liftThrowable((key: string) => localStorage.getItem(key))

const APPEARANCES = THEME_KNOBS[0].choices.map((choice) => choice.value)
/**
 * The packs, without the answer that is not one.
 *
 * `match` is a choice on the knob and never a thing that was painted: `Theme`
 * resolves it against where it is drawn before anything is remembered. Filtered
 * anyway, because this reads a name off disk that some older build wrote, and the
 * one value that must not come back through here is the one with no colours.
 */
const PACK_NAMES = THEME_KNOBS[1].choices
  .map((choice) => choice.value)
  .filter((value) => value !== "match")

const isAppearance = (value: unknown): value is Appearance =>
  APPEARANCES.some((one) => one === value)

const isPack = (value: unknown): value is Pack => PACK_NAMES.some((one) => one === value)

/**
 * The choices from last time, read without waiting for anything.
 *
 * Settings live in `browser.storage.sync`, which answers a promise, and painting
 * cannot start until it does. That gap is a frame, and a frame of the stylesheet's
 * defaults is a frame of the light pack — which on GitHub's dark page is a white
 * flash of our own interface. So the two names that decide the colours are also
 * written where they can be read on the same tick, and this is the reading.
 *
 * `undefined` for a reader who has not been here before: they have nothing
 * remembered, the stylesheet's defaults are all there is, and guessing would be
 * a second wrong colour rather than a first right one.
 */
export const rememberedTheme = (): { appearance: Appearance; pack: Pack } | undefined => {
  const appearance = recall(SCHEME_KEY)
  const pack = recall(PACK_KEY)
  if (!isAppearance(appearance) || !isPack(pack)) return undefined
  return { appearance, pack }
}

export const paintTokens = (root: HTMLElement, tokens: ThemeTokens, scheme: Scheme): void => {
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value)
  }
  for (const [name, value] of Object.entries(DESKTOP_ALIASES(tokens))) {
    root.style.setProperty(name, value)
  }
  root.classList.toggle("dark", scheme === "dark")
  root.style.colorScheme = scheme
}

/**
 * The one name the page itself is allowed to know.
 *
 * `quiet.css` paints GitHub's floor with this, and it is a single value rather
 * than the token set for the reason `Theme.tsx` gives: their chrome reads
 * Primer's names, so writing ours onto `<html>` would restyle their page. This
 * name is nobody's but ours, so the only thing it can reach is the rules we
 * wrote for it.
 */
export const FLOOR = "--gitquiet-floor"

/**
 * Our canvas, under their page.
 *
 * The floor used to stay GitHub's, and the argument was that a slab of our dark
 * under their header reads as a panel bolted over the site. Our own bar took
 * that header's place — `gates.bar.css` hides `header.GlobalNav` the moment
 * `#gitquiet-bar` exists — so there is no longer a seam between their chrome and
 * our column, and the last thing on the page that was not ours was the colour
 * behind it.
 *
 * On `<html>` rather than on `body`, because the two paint the same canvas and
 * a variable on the document root is one the Home wrappers can read as well:
 * their feed nests two more painted layers inside `body`.
 */
export const paintFloor = (page: Document, tokens: ThemeTokens): void => {
  page.documentElement.style.setProperty(FLOOR, tokens["--color-canvas"])
}

/**
 * `remember` is the difference between the reader's answer and our guess at it.
 *
 * The early paint in `Theme` runs before the store has answered, so what it
 * paints is last time's colours or the defaults. Writing that back would put a
 * guess where `desktop/src/view/index.html` looks for a choice.
 */
export const paintTheme = (
  root: HTMLElement,
  appearance: Appearance,
  pack: Pack,
  prefersDark: boolean,
  remember = true
): Scheme => {
  const scheme = resolveAppearance(appearance, prefersDark)
  paintTokens(root, tokensOf(pack, scheme), scheme)
  if (remember) {
    rememberAppearance(appearance)
    rememberPack(pack)
  }
  return scheme
}

export const prefersDarkScheme = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
