/**
 * Appearance × Pack → the CSS variables shared screens spend.
 *
 * Components never name a pack. They ask for `bg-canvas` / `text-ink`; this
 * file is the only place those names get real colours. Both shells call
 * `tokensOf` and paint the result onto their root.
 *
 * Gitquiet literals are taken from `desktop/src/view/style.css` so the default
 * pack is the desktop window, not an approximation of it.
 */

import type { ThemeSettings } from "./Settings"

export type Scheme = "light" | "dark"

/**
 * What the reader answered, and what a pack actually is.
 *
 * The two are not the same set, because one of the answers is not a pack: `match`
 * says the question belongs to the place this interface is drawn in. Keeping the
 * distinction in the types is what stops `match` reaching the table below, where
 * it has no colours and every screen paints undefined.
 */
export type PackChoice = ThemeSettings["pack"]
export type Pack = Exclude<PackChoice, "match">
export type Appearance = ThemeSettings["appearance"]

export type ThemeTokens = {
  readonly "--color-canvas": string
  readonly "--color-inset": string
  readonly "--color-surface": string
  readonly "--color-raised": string
  readonly "--color-hover": string
  readonly "--color-active": string
  readonly "--color-ink": string
  readonly "--color-ink-muted": string
  readonly "--color-ink-accent": string
  readonly "--color-ink-on-emphasis": string
  readonly "--color-pass": string
  readonly "--color-fail": string
  readonly "--color-busy": string
  readonly "--color-done": string
  readonly "--color-accent-emphasis": string
  readonly "--color-pass-emphasis": string
  readonly "--color-fail-emphasis": string
  readonly "--color-done-emphasis": string
  readonly "--color-pass-muted": string
  readonly "--color-fail-muted": string
  readonly "--color-accent-muted": string
  readonly "--color-attention-muted": string
  readonly "--color-done-muted": string
  readonly "--color-line": string
  readonly "--color-line-muted": string
  readonly "--color-line-accent": string
  /** Primer-shaped aliases `motion.css` and a few folds still read by name. */
  readonly "--fgColor-default": string
  readonly "--fgColor-muted": string
  readonly "--fgColor-success": string
  readonly "--fgColor-danger": string
  readonly "--bgColor-default": string
  readonly "--bgColor-muted": string
  readonly "--bgColor-inset": string
  readonly "--font-sans": string
}

const INTER = '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'

type Face = {
  readonly canvas: string
  readonly inset: string
  readonly surface: string
  readonly raised: string
  readonly hover: string
  readonly active: string
  readonly ink: string
  readonly muted: string
  readonly accent: string
  readonly onEmphasis: string
  readonly pass: string
  readonly fail: string
  readonly busy: string
  readonly done: string
  readonly accentFill: string
  readonly passFill: string
  readonly failFill: string
  readonly doneFill: string
  readonly passMuted: string
  readonly failMuted: string
  readonly accentMuted: string
  readonly attentionMuted: string
  readonly doneMuted: string
  readonly line: string
  readonly lineMuted: string
}

const face = (one: Face): ThemeTokens => ({
  "--color-canvas": one.canvas,
  "--color-inset": one.inset,
  "--color-surface": one.surface,
  "--color-raised": one.raised,
  "--color-hover": one.hover,
  "--color-active": one.active,
  "--color-ink": one.ink,
  "--color-ink-muted": one.muted,
  "--color-ink-accent": one.accent,
  "--color-ink-on-emphasis": one.onEmphasis,
  "--color-pass": one.pass,
  "--color-fail": one.fail,
  "--color-busy": one.busy,
  "--color-done": one.done,
  "--color-accent-emphasis": one.accentFill,
  "--color-pass-emphasis": one.passFill,
  "--color-fail-emphasis": one.failFill,
  "--color-done-emphasis": one.doneFill,
  "--color-pass-muted": one.passMuted,
  "--color-fail-muted": one.failMuted,
  "--color-accent-muted": one.accentMuted,
  "--color-attention-muted": one.attentionMuted,
  "--color-done-muted": one.doneMuted,
  "--color-line": one.line,
  "--color-line-muted": one.lineMuted,
  "--color-line-accent": one.accent,
  "--fgColor-default": one.ink,
  "--fgColor-muted": one.muted,
  "--fgColor-success": one.pass,
  "--fgColor-danger": one.fail,
  "--bgColor-default": one.canvas,
  "--bgColor-muted": one.surface,
  "--bgColor-inset": one.inset,
  "--font-sans": INTER
})

/** Desktop Fluid Functionalism — the product default. */
const GITQUIET: Record<Scheme, Face> = {
  light: {
    canvas: "#FAFAFA",
    inset: "#FAFAFA",
    surface: "#FFFFFF",
    raised: "#FFFFFF",
    hover: "#0000000a",
    active: "#00000012",
    ink: "#171717",
    muted: "#737373",
    accent: "#0969da",
    onEmphasis: "#ffffff",
    pass: "#1a7f37",
    fail: "#d1242f",
    busy: "#9a6700",
    done: "#8250df",
    accentFill: "#0969da",
    passFill: "#1f883d",
    failFill: "#cf222e",
    doneFill: "#8250df",
    passMuted: "#1f883d26",
    failMuted: "#cf222e26",
    accentMuted: "#0969da26",
    attentionMuted: "#9a670026",
    doneMuted: "#8250df26",
    line: "#1717171f",
    lineMuted: "#17171712"
  },
  dark: {
    canvas: "#171717",
    inset: "#171717",
    surface: "#252525",
    raised: "#2C2C2C",
    hover: "#ffffff0f",
    active: "#ffffff1a",
    ink: "#f5f5f5",
    muted: "#a3a3a3",
    accent: "#6b97ff",
    onEmphasis: "#ffffff",
    pass: "#3fb950",
    fail: "#f87171",
    busy: "#d29922",
    done: "#a371f7",
    accentFill: "#1f6feb",
    passFill: "#238636",
    failFill: "#da3633",
    doneFill: "#8957e5",
    passMuted: "#3fb95026",
    failMuted: "#f8517126",
    accentMuted: "#388bfd26",
    attentionMuted: "#d2992226",
    doneMuted: "#a371f726",
    line: "#f5f5f51f",
    lineMuted: "#f5f5f512"
  }
}

/** Warm paper / charcoal, in the Claude family of hues. */
const ANTHROPIC: Record<Scheme, Face> = {
  light: {
    canvas: "#f7f3ee",
    inset: "#f0ebe3",
    surface: "#fffdf9",
    raised: "#ffffff",
    hover: "#1a15230a",
    active: "#1a152314",
    ink: "#1a1523",
    muted: "#6b6459",
    accent: "#c96442",
    onEmphasis: "#ffffff",
    pass: "#3d6b4f",
    fail: "#b33a3a",
    busy: "#9a6700",
    done: "#7c5cbf",
    accentFill: "#c96442",
    passFill: "#3d6b4f",
    failFill: "#b33a3a",
    doneFill: "#7c5cbf",
    passMuted: "#3d6b4f26",
    failMuted: "#b33a3a26",
    accentMuted: "#c9644226",
    attentionMuted: "#9a670026",
    doneMuted: "#7c5cbf26",
    line: "#1a15231f",
    lineMuted: "#1a152312"
  },
  dark: {
    canvas: "#1a1814",
    inset: "#14120f",
    surface: "#24201a",
    raised: "#2e2922",
    hover: "#f0ebe30f",
    active: "#f0ebe31a",
    ink: "#f0ebe3",
    muted: "#a39e93",
    accent: "#e8a087",
    onEmphasis: "#1a1814",
    pass: "#7dcea0",
    fail: "#e07a7a",
    busy: "#d4a017",
    done: "#b39ddb",
    accentFill: "#c96442",
    passFill: "#3d6b4f",
    failFill: "#b33a3a",
    doneFill: "#7c5cbf",
    passMuted: "#7dcea026",
    failMuted: "#e07a7a26",
    accentMuted: "#e8a08726",
    attentionMuted: "#d4a01726",
    doneMuted: "#b39ddb26",
    line: "#f0ebe31f",
    lineMuted: "#f0ebe312"
  }
}

/**
 * Cursor Dark Anysphere / Cursor Light — from the theme JSON shipped in
 * Cursor.app (`extensions/theme-cursor/themes/`).
 */
const CURSOR: Record<Scheme, Face> = {
  light: {
    canvas: "#FCFCFC",
    inset: "#F3F3F3",
    surface: "#F3F3F3",
    raised: "#FFFFFF",
    hover: "#14141414",
    active: "#1414141F",
    ink: "#141414",
    muted: "#5C5C5C",
    accent: "#0064B0",
    onEmphasis: "#FCFCFC",
    pass: "#007041",
    fail: "#BE1744",
    busy: "#A46700",
    done: "#7565CC",
    accentFill: "#2778C1",
    passFill: "#00854C",
    failFill: "#CE405B",
    doneFill: "#7565CC",
    passMuted: "#00704126",
    failMuted: "#BE174426",
    accentMuted: "#0064B026",
    attentionMuted: "#A4670026",
    doneMuted: "#7565CC26",
    line: "#1414141F",
    lineMuted: "#14141414"
  },
  dark: {
    // Content #181818, chrome #141414 — Cursor's chrome is darker than the editor.
    canvas: "#181818",
    inset: "#141414",
    surface: "#141414",
    raised: "#222222",
    hover: "#F0F0F011",
    active: "#F0F0F01E",
    ink: "#F0F0F0",
    muted: "#A0A0A0",
    accent: "#81A1C1",
    onEmphasis: "#191C22",
    pass: "#3FA266",
    fail: "#E34671",
    busy: "#F1B467",
    done: "#B48EAD",
    accentFill: "#81A1C1",
    passFill: "#3FA266",
    failFill: "#E34671",
    doneFill: "#B48EAD",
    passMuted: "#3FA26626",
    failMuted: "#E3467126",
    accentMuted: "#81A1C126",
    attentionMuted: "#F1B46726",
    doneMuted: "#B48EAD26",
    line: "#F0F0F01F",
    lineMuted: "#F0F0F013"
  }
}

/** Static Primer-like — recalls github.com without reading the page. */
const GITHUB: Record<Scheme, Face> = {
  light: {
    canvas: "#ffffff",
    inset: "#f6f8fa",
    surface: "#f6f8fa",
    raised: "#ffffff",
    hover: "#818b981a",
    active: "#818b9826",
    ink: "#1f2328",
    muted: "#59636e",
    accent: "#0969da",
    onEmphasis: "#ffffff",
    pass: "#1a7f37",
    fail: "#d1242f",
    busy: "#9a6700",
    done: "#8250df",
    accentFill: "#0969da",
    passFill: "#1f883d",
    failFill: "#cf222e",
    doneFill: "#8250df",
    passMuted: "#1f883d26",
    failMuted: "#cf222e26",
    accentMuted: "#0969da26",
    attentionMuted: "#9a670026",
    doneMuted: "#8250df26",
    line: "#d1d9e0",
    lineMuted: "#d8dee4"
  },
  dark: {
    canvas: "#0d1117",
    inset: "#010409",
    surface: "#161b22",
    raised: "#21262d",
    hover: "#b1bac41f",
    active: "#b1bac433",
    ink: "#e6edf3",
    muted: "#9198a1",
    accent: "#4493f8",
    onEmphasis: "#ffffff",
    pass: "#3fb950",
    fail: "#f85149",
    busy: "#d29922",
    done: "#ab7df8",
    accentFill: "#1f6feb",
    passFill: "#238636",
    failFill: "#da3633",
    doneFill: "#8957e5",
    passMuted: "#3fb95026",
    failMuted: "#f8514926",
    accentMuted: "#388bfd26",
    attentionMuted: "#d2992226",
    doneMuted: "#ab7df826",
    line: "#3d444d",
    lineMuted: "#21262d"
  }
}

/** Catppuccin Latte / Mocha. */
const CATPPUCCIN: Record<Scheme, Face> = {
  light: {
    canvas: "#eff1f5",
    inset: "#e6e9ef",
    surface: "#ffffff",
    raised: "#ffffff",
    hover: "#4c4f6914",
    active: "#4c4f6926",
    ink: "#4c4f69",
    muted: "#6c6f85",
    accent: "#1e66f5",
    onEmphasis: "#eff1f5",
    pass: "#40a02b",
    fail: "#d20f39",
    busy: "#df8e1d",
    done: "#8839ef",
    accentFill: "#1e66f5",
    passFill: "#40a02b",
    failFill: "#d20f39",
    doneFill: "#8839ef",
    passMuted: "#40a02b26",
    failMuted: "#d20f3926",
    accentMuted: "#1e66f526",
    attentionMuted: "#df8e1d26",
    doneMuted: "#8839ef26",
    line: "#ccd0da",
    lineMuted: "#dce0e8"
  },
  dark: {
    canvas: "#1e1e2e",
    inset: "#181825",
    surface: "#313244",
    raised: "#45475a",
    hover: "#cdd6f414",
    active: "#cdd6f426",
    ink: "#cdd6f4",
    muted: "#a6adc8",
    accent: "#89b4fa",
    onEmphasis: "#1e1e2e",
    pass: "#a6e3a1",
    fail: "#f38ba8",
    busy: "#f9e2af",
    done: "#cba6f7",
    accentFill: "#89b4fa",
    passFill: "#a6e3a1",
    failFill: "#f38ba8",
    doneFill: "#cba6f7",
    passMuted: "#a6e3a126",
    failMuted: "#f38ba826",
    accentMuted: "#89b4fa26",
    attentionMuted: "#f9e2af26",
    doneMuted: "#cba6f726",
    line: "#45475a",
    lineMuted: "#313244"
  }
}

/** Nord Snow Storm / Polar Night. */
const NORD: Record<Scheme, Face> = {
  light: {
    canvas: "#eceff4",
    inset: "#e5e9f0",
    surface: "#ffffff",
    raised: "#ffffff",
    hover: "#2e344014",
    active: "#2e344026",
    ink: "#2e3440",
    muted: "#4c566a",
    accent: "#5e81ac",
    onEmphasis: "#eceff4",
    pass: "#a3be8c",
    fail: "#bf616a",
    busy: "#ebcb8b",
    done: "#b48ead",
    accentFill: "#5e81ac",
    passFill: "#a3be8c",
    failFill: "#bf616a",
    doneFill: "#b48ead",
    passMuted: "#a3be8c40",
    failMuted: "#bf616a40",
    accentMuted: "#5e81ac40",
    attentionMuted: "#ebcb8b40",
    doneMuted: "#b48ead40",
    line: "#d8dee9",
    lineMuted: "#e5e9f0"
  },
  dark: {
    canvas: "#2e3440",
    inset: "#3b4252",
    surface: "#3b4252",
    raised: "#434c5e",
    hover: "#eceff414",
    active: "#eceff426",
    ink: "#eceff4",
    muted: "#d8dee9",
    accent: "#88c0d0",
    onEmphasis: "#2e3440",
    pass: "#a3be8c",
    fail: "#bf616a",
    busy: "#ebcb8b",
    done: "#b48ead",
    accentFill: "#5e81ac",
    passFill: "#a3be8c",
    failFill: "#bf616a",
    doneFill: "#b48ead",
    passMuted: "#a3be8c33",
    failMuted: "#bf616a33",
    accentMuted: "#88c0d033",
    attentionMuted: "#ebcb8b33",
    doneMuted: "#b48ead33",
    line: "#4c566a",
    lineMuted: "#434c5e"
  }
}

/**
 * Compact pack builder for the editor/terminal faces.
 *
 * Status hues stay near GitHub's greens and reds unless a pack is famous for
 * its own (Dracula pink, Solarized yellow, …). Surfaces and accent carry the
 * identity; the reader must never re-learn what red means.
 */
type Core = {
  readonly canvas: string
  readonly surface: string
  readonly raised: string
  readonly ink: string
  readonly muted: string
  readonly accent: string
  readonly pass?: string
  readonly fail?: string
  readonly busy?: string
  readonly done?: string
}

const tint = (hex: string, alpha: string): string => `${hex}${alpha}`

const fromCore = (core: Core, scheme: Scheme): Face => {
  const dark = scheme === "dark"
  const pass = core.pass ?? (dark ? "#3fb950" : "#1a7f37")
  const fail = core.fail ?? (dark ? "#f87171" : "#d1242f")
  const busy = core.busy ?? (dark ? "#d29922" : "#9a6700")
  const done = core.done ?? (dark ? "#a371f7" : "#8250df")
  return {
    canvas: core.canvas,
    inset: core.canvas,
    surface: core.surface,
    raised: core.raised,
    hover: dark ? "#ffffff0f" : "#0000000a",
    active: dark ? "#ffffff1a" : "#00000012",
    ink: core.ink,
    muted: core.muted,
    accent: core.accent,
    onEmphasis: dark ? "#ffffff" : "#ffffff",
    pass,
    fail,
    busy,
    done,
    accentFill: core.accent,
    passFill: pass,
    failFill: fail,
    doneFill: done,
    passMuted: tint(pass, "26"),
    failMuted: tint(fail, "26"),
    accentMuted: tint(core.accent, "26"),
    attentionMuted: tint(busy, "26"),
    doneMuted: tint(done, "26"),
    line: tint(core.ink, "1f"),
    lineMuted: tint(core.ink, "12")
  }
}

const pair = (light: Core, dark: Core): Record<Scheme, Face> => ({
  light: fromCore(light, "light"),
  dark: fromCore(dark, "dark")
})

const ONE_DARK = pair(
  {
    canvas: "#fafafa",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#383a42",
    muted: "#696c77",
    accent: "#4078f2"
  },
  {
    canvas: "#282c34",
    surface: "#21252b",
    raised: "#2c313c",
    ink: "#abb2bf",
    muted: "#5c6370",
    accent: "#61afef"
  }
)

const DRACULA = pair(
  {
    canvas: "#f8f8f2",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#44475a",
    muted: "#6272a4",
    accent: "#bd93f9",
    pass: "#50fa7b",
    fail: "#ff5555",
    busy: "#f1fa8c",
    done: "#ff79c6"
  },
  {
    canvas: "#282a36",
    surface: "#21222c",
    raised: "#44475a",
    ink: "#f8f8f2",
    muted: "#6272a4",
    accent: "#bd93f9",
    pass: "#50fa7b",
    fail: "#ff5555",
    busy: "#f1fa8c",
    done: "#ff79c6"
  }
)

const SOLARIZED = pair(
  {
    canvas: "#fdf6e3",
    surface: "#eee8d5",
    raised: "#eee8d5",
    ink: "#657b83",
    muted: "#93a1a1",
    accent: "#268bd2",
    pass: "#859900",
    fail: "#dc322f",
    busy: "#b58900",
    done: "#6c71c4"
  },
  {
    canvas: "#002b36",
    surface: "#073642",
    raised: "#094352",
    ink: "#839496",
    muted: "#586e75",
    accent: "#268bd2",
    pass: "#859900",
    fail: "#dc322f",
    busy: "#b58900",
    done: "#6c71c4"
  }
)

const GRUVBOX = pair(
  {
    canvas: "#fbf1c7",
    surface: "#ebdbb2",
    raised: "#ebdbb2",
    ink: "#3c3836",
    muted: "#7c6f64",
    accent: "#076678",
    pass: "#79740e",
    fail: "#9d0006",
    busy: "#b57614",
    done: "#8f3f71"
  },
  {
    canvas: "#282828",
    surface: "#3c3836",
    raised: "#504945",
    ink: "#ebdbb2",
    muted: "#a89984",
    accent: "#83a598",
    pass: "#b8bb26",
    fail: "#fb4934",
    busy: "#fabd2f",
    done: "#d3869b"
  }
)

const TOKYO_NIGHT = pair(
  {
    canvas: "#e1e2e7",
    surface: "#d5d6db",
    raised: "#cfcfd4",
    ink: "#3760bf",
    muted: "#6172b0",
    accent: "#2e7de9"
  },
  {
    canvas: "#1a1b26",
    surface: "#24283b",
    raised: "#414868",
    ink: "#c0caf5",
    muted: "#565f89",
    accent: "#7aa2f7",
    pass: "#9ece6a",
    fail: "#f7768e",
    busy: "#e0af68",
    done: "#bb9af7"
  }
)

const ROSE_PINE = pair(
  {
    canvas: "#faf4ed",
    surface: "#fffaf3",
    raised: "#f2e9e1",
    ink: "#575279",
    muted: "#9893a5",
    accent: "#907aa9",
    pass: "#286983",
    fail: "#b4637a",
    busy: "#ea9d34",
    done: "#907aa9"
  },
  {
    canvas: "#191724",
    surface: "#1f1d2e",
    raised: "#26233a",
    ink: "#e0def4",
    muted: "#908caa",
    accent: "#c4a7e7",
    pass: "#9ccfd8",
    fail: "#eb6f92",
    busy: "#f6c177",
    done: "#c4a7e7"
  }
)

const MONOKAI = pair(
  {
    canvas: "#f5f5f0",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#272822",
    muted: "#75715e",
    accent: "#66d9ef",
    pass: "#a6e22e",
    fail: "#f92672",
    busy: "#e6db74",
    done: "#ae81ff"
  },
  {
    canvas: "#272822",
    surface: "#3e3d32",
    raised: "#49483e",
    ink: "#f8f8f2",
    muted: "#75715e",
    accent: "#66d9ef",
    pass: "#a6e22e",
    fail: "#f92672",
    busy: "#e6db74",
    done: "#ae81ff"
  }
)

const AYU = pair(
  {
    canvas: "#fafafa",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#5c6773",
    muted: "#828c99",
    accent: "#ff9940"
  },
  {
    canvas: "#0f1419",
    surface: "#1a1f29",
    raised: "#232834",
    ink: "#e6e1cf",
    muted: "#5c6773",
    accent: "#ffb454"
  }
)

const EVERFOREST = pair(
  {
    canvas: "#fdf6e3",
    surface: "#f4f0d9",
    raised: "#efebd4",
    ink: "#5c6a72",
    muted: "#829181",
    accent: "#3a94c5",
    pass: "#8da101",
    fail: "#f85552",
    busy: "#dfa000",
    done: "#df69ba"
  },
  {
    canvas: "#2d353b",
    surface: "#343f44",
    raised: "#3d484d",
    ink: "#d3c6aa",
    muted: "#859289",
    accent: "#7fbbb3",
    pass: "#a7c080",
    fail: "#e67e80",
    busy: "#dbbc7f",
    done: "#d699b6"
  }
)

const KANAGAWA = pair(
  {
    canvas: "#f2ecbc",
    surface: "#e7dba0",
    raised: "#e4d794",
    ink: "#545464",
    muted: "#8a8980",
    accent: "#4d699b",
    pass: "#6f894e",
    fail: "#c84053",
    busy: "#77713f",
    done: "#b35b79"
  },
  {
    canvas: "#1f1f28",
    surface: "#2a2a37",
    raised: "#363646",
    ink: "#dcd7ba",
    muted: "#727169",
    accent: "#7e9cd8",
    pass: "#98bb6c",
    fail: "#e82424",
    busy: "#e6c384",
    done: "#d27e99"
  }
)

const NIGHT_OWL = pair(
  {
    canvas: "#fbfbfb",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#403f53",
    muted: "#989fb1",
    accent: "#994cc3"
  },
  {
    canvas: "#011627",
    surface: "#0b2942",
    raised: "#1d3b53",
    ink: "#d6deeb",
    muted: "#5f7e97",
    accent: "#c792ea",
    pass: "#addb67",
    fail: "#ef5350",
    busy: "#ffcb8b",
    done: "#c792ea"
  }
)

const MATERIAL = pair(
  {
    canvas: "#fafafa",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#90a4ae",
    muted: "#b0bec5",
    accent: "#39adb5"
  },
  {
    canvas: "#263238",
    surface: "#2e3c43",
    raised: "#37474f",
    ink: "#eeffff",
    muted: "#546e7a",
    accent: "#80cbc4",
    pass: "#c3e88d",
    fail: "#f07178",
    busy: "#ffcb6b",
    done: "#c792ea"
  }
)

const PALENIGHT = pair(
  {
    canvas: "#fafafa",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#676e95",
    muted: "#8796b0",
    accent: "#7c4dff"
  },
  {
    canvas: "#292d3e",
    surface: "#32374d",
    raised: "#3a3f58",
    ink: "#a6accd",
    muted: "#676e95",
    accent: "#c792ea",
    pass: "#c3e88d",
    fail: "#f07178",
    busy: "#ffcb6b",
    done: "#c792ea"
  }
)

const HORIZON = pair(
  {
    canvas: "#fdf0ed",
    surface: "#fadad1",
    raised: "#f9cbbe",
    ink: "#1c1e26",
    muted: "#948c8a",
    accent: "#e95678"
  },
  {
    canvas: "#1c1e26",
    surface: "#232530",
    raised: "#2e303e",
    ink: "#d5d0ce",
    muted: "#6c6f93",
    accent: "#e95678",
    pass: "#29d398",
    fail: "#e95678",
    busy: "#fab795",
    done: "#b877db"
  }
)

const VESPER = pair(
  {
    canvas: "#f5f5f5",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#101010",
    muted: "#7e7e7e",
    accent: "#ffc799"
  },
  {
    canvas: "#101010",
    surface: "#161616",
    raised: "#1c1c1c",
    ink: "#ffffff",
    muted: "#a0a0a0",
    accent: "#ffc799",
    pass: "#99ffe4",
    fail: "#ff8080",
    busy: "#ffc799",
    done: "#ffc799"
  }
)

const COBALT = pair(
  {
    canvas: "#ffffff",
    surface: "#f0f4f8",
    raised: "#e8eef5",
    ink: "#193549",
    muted: "#627d98",
    accent: "#0088ff"
  },
  {
    canvas: "#193549",
    surface: "#1f4662",
    raised: "#234e6d",
    ink: "#ffffff",
    muted: "#9eabcd",
    accent: "#ffc600",
    pass: "#3ad900",
    fail: "#ff628c",
    busy: "#ffc600",
    done: "#fb94ff"
  }
)

const SYNTHWAVE = pair(
  {
    canvas: "#f9f5ff",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#241b2f",
    muted: "#848bbd",
    accent: "#fe4450"
  },
  {
    canvas: "#2b213a",
    surface: "#34294f",
    raised: "#3d315c",
    ink: "#ffffff",
    muted: "#848bbd",
    accent: "#ff7edb",
    pass: "#72f1b8",
    fail: "#fe4450",
    busy: "#fede5d",
    done: "#ff7edb"
  }
)

const OXOCARBON = pair(
  {
    canvas: "#f2f4f8",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#161616",
    muted: "#525252",
    accent: "#0f62fe"
  },
  {
    canvas: "#161616",
    surface: "#262626",
    raised: "#393939",
    ink: "#f4f4f4",
    muted: "#6f6f6f",
    accent: "#78a9ff",
    pass: "#42be65",
    fail: "#fa4d56",
    busy: "#f1c21b",
    done: "#be95ff"
  }
)

const FLEXOKI = pair(
  {
    canvas: "#fffcf0",
    surface: "#f2f0e5",
    raised: "#e6e4d9",
    ink: "#100f0f",
    muted: "#6f6e69",
    accent: "#205ea6",
    pass: "#66800b",
    fail: "#af3029",
    busy: "#ad8301",
    done: "#5e409d"
  },
  {
    canvas: "#100f0f",
    surface: "#1c1b1a",
    raised: "#282726",
    ink: "#cecdc3",
    muted: "#878580",
    accent: "#4385be",
    pass: "#879a39",
    fail: "#d14d41",
    busy: "#d0a215",
    done: "#8b7ec8"
  }
)

const ZINC = pair(
  {
    canvas: "#fafafa",
    surface: "#ffffff",
    raised: "#ffffff",
    ink: "#18181b",
    muted: "#71717a",
    accent: "#3b82f6"
  },
  {
    canvas: "#18181b",
    surface: "#27272a",
    raised: "#3f3f46",
    ink: "#fafafa",
    muted: "#a1a1aa",
    accent: "#60a5fa"
  }
)

const PACKS: Record<Pack, Record<Scheme, Face>> = {
  gitquiet: GITQUIET,
  anthropic: ANTHROPIC,
  cursor: CURSOR,
  github: GITHUB,
  catppuccin: CATPPUCCIN,
  nord: NORD,
  "one-dark": ONE_DARK,
  dracula: DRACULA,
  solarized: SOLARIZED,
  gruvbox: GRUVBOX,
  "tokyo-night": TOKYO_NIGHT,
  "rose-pine": ROSE_PINE,
  monokai: MONOKAI,
  ayu: AYU,
  everforest: EVERFOREST,
  kanagawa: KANAGAWA,
  "night-owl": NIGHT_OWL,
  material: MATERIAL,
  palenight: PALENIGHT,
  horizon: HORIZON,
  vesper: VESPER,
  cobalt: COBALT,
  synthwave: SYNTHWAVE,
  oxocarbon: OXOCARBON,
  flexoki: FLEXOKI,
  zinc: ZINC
}

export const resolveAppearance = (
  appearance: Appearance,
  prefersDark: boolean
): Scheme => {
  if (appearance === "light") return "light"
  if (appearance === "dark") return "dark"
  return prefersDark ? "dark" : "light"
}

export const tokensOf = (pack: Pack, scheme: Scheme): ThemeTokens =>
  face(PACKS[pack][scheme])

/**
 * What the reader's answer comes to, given where this is drawn.
 *
 * `match` is the default, and on GitHub's page it resolves to their own colours:
 * this interface stands inside their tab, under a header of theirs, and a reader
 * who never opened the settings should not be told by the colour that half the
 * page has been replaced. In a window of ours there is no page to match, so it
 * resolves to ours. Any other answer is a pack and holds in both places.
 */
export const packOf = (chosen: PackChoice, here: Pack): Pack =>
  chosen === "match" ? here : chosen
