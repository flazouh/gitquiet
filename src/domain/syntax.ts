/**
 * Which Shiki theme paints the code, given the syntax knob and the pack.
 *
 * Surfaces (canvas, gutter, green, red) follow the pack through CSS variables.
 * Keywords and strings do not: Shiki bakes those into the DOM, so each pack
 * needs a named theme. Packs with no Shiki counterpart wear GitHub's.
 */

import type { Pack } from "./theme"

export type SyntaxChoice = "match" | "one-dark" | "github"

export type SyntaxPair = {
  readonly dark: string
  readonly light: string
}

export const GITHUB_SYNTAX: SyntaxPair = {
  dark: "github-dark-default",
  light: "github-light-default"
}

export const ONE_DARK_SYNTAX: SyntaxPair = {
  dark: "one-dark-pro",
  light: "pierre-light"
}

const OF = {
  gitquiet: GITHUB_SYNTAX,
  anthropic: GITHUB_SYNTAX,
  cursor: { dark: "one-dark-pro", light: "one-light" },
  github: GITHUB_SYNTAX,
  catppuccin: { dark: "catppuccin-mocha", light: "catppuccin-latte" },
  nord: { dark: "nord", light: "github-light-default" },
  "one-dark": { dark: "one-dark-pro", light: "one-light" },
  dracula: { dark: "dracula", light: "dracula-soft" },
  solarized: { dark: "solarized-dark", light: "solarized-light" },
  gruvbox: { dark: "gruvbox-dark-medium", light: "gruvbox-light-medium" },
  "tokyo-night": { dark: "tokyo-night", light: "github-light-default" },
  "rose-pine": { dark: "rose-pine", light: "rose-pine-dawn" },
  monokai: { dark: "monokai", light: "github-light-default" },
  ayu: { dark: "ayu-dark", light: "ayu-light" },
  everforest: { dark: "everforest-dark", light: "everforest-light" },
  kanagawa: { dark: "kanagawa-wave", light: "kanagawa-lotus" },
  "night-owl": { dark: "night-owl", light: "night-owl-light" },
  material: { dark: "material-theme", light: "material-theme-lighter" },
  palenight: { dark: "material-theme-palenight", light: "material-theme-lighter" },
  horizon: { dark: "horizon", light: "horizon-bright" },
  vesper: { dark: "vesper", light: "github-light-default" },
  cobalt: GITHUB_SYNTAX,
  synthwave: { dark: "synthwave-84", light: "github-light-default" },
  oxocarbon: GITHUB_SYNTAX,
  flexoki: GITHUB_SYNTAX,
  zinc: GITHUB_SYNTAX
} as const satisfies Record<Pack, SyntaxPair>

export const syntaxOf = (choice: SyntaxChoice, pack: Pack): SyntaxPair => {
  if (choice === "github") return GITHUB_SYNTAX
  if (choice === "one-dark") return ONE_DARK_SYNTAX
  return OF[pack]
}
