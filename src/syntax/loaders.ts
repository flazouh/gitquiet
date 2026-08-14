/**
 * Shiki themes, loaded by name the first time a pack asks for one.
 *
 * The diff engine and the markdown highlighter both register from this map.
 * Names match `syntaxOf`. `pierre-light` is Pierre's own and is not here.
 */

export const LOADERS = {
  "github-dark-default": () => import("@shikijs/themes/github-dark-default"),
  "github-light-default": () => import("@shikijs/themes/github-light-default"),
  "one-dark-pro": () => import("@shikijs/themes/one-dark-pro"),
  "one-light": () => import("@shikijs/themes/one-light"),
  "catppuccin-mocha": () => import("@shikijs/themes/catppuccin-mocha"),
  "catppuccin-latte": () => import("@shikijs/themes/catppuccin-latte"),
  nord: () => import("@shikijs/themes/nord"),
  dracula: () => import("@shikijs/themes/dracula"),
  "dracula-soft": () => import("@shikijs/themes/dracula-soft"),
  "solarized-dark": () => import("@shikijs/themes/solarized-dark"),
  "solarized-light": () => import("@shikijs/themes/solarized-light"),
  "gruvbox-dark-medium": () => import("@shikijs/themes/gruvbox-dark-medium"),
  "gruvbox-light-medium": () => import("@shikijs/themes/gruvbox-light-medium"),
  "tokyo-night": () => import("@shikijs/themes/tokyo-night"),
  "rose-pine": () => import("@shikijs/themes/rose-pine"),
  "rose-pine-dawn": () => import("@shikijs/themes/rose-pine-dawn"),
  monokai: () => import("@shikijs/themes/monokai"),
  "ayu-dark": () => import("@shikijs/themes/ayu-dark"),
  "ayu-light": () => import("@shikijs/themes/ayu-light"),
  "everforest-dark": () => import("@shikijs/themes/everforest-dark"),
  "everforest-light": () => import("@shikijs/themes/everforest-light"),
  "kanagawa-wave": () => import("@shikijs/themes/kanagawa-wave"),
  "kanagawa-lotus": () => import("@shikijs/themes/kanagawa-lotus"),
  "night-owl": () => import("@shikijs/themes/night-owl"),
  "night-owl-light": () => import("@shikijs/themes/night-owl-light"),
  "material-theme": () => import("@shikijs/themes/material-theme"),
  "material-theme-lighter": () => import("@shikijs/themes/material-theme-lighter"),
  "material-theme-palenight": () => import("@shikijs/themes/material-theme-palenight"),
  horizon: () => import("@shikijs/themes/horizon"),
  "horizon-bright": () => import("@shikijs/themes/horizon-bright"),
  vesper: () => import("@shikijs/themes/vesper"),
  "synthwave-84": () => import("@shikijs/themes/synthwave-84")
} as const
