import { Effect } from "effect"
import mermaid from "mermaid"

/**
 * The colours a figure borrows from the interface it is drawn inside.
 *
 * The names the rest of this interface already spends, and no others. Two
 * earlier versions had a palette of their own: paperforge pastels tinted with
 * the pack's ink, which produced colours paperforge does not have, and then the
 * pastels themselves on white paper, which produced a figure that belongs to a
 * different product than the panel around it. A diagram in a pull request is a
 * block like the code block above it, so it is painted out of the same tokens.
 * See `domain/theme.ts` for where they come from.
 */
export type Palette = {
  readonly canvas: string
  readonly surface: string
  readonly ink: string
  readonly muted: string
  readonly line: string
  readonly accent: string
  readonly accentMuted: string
  readonly pass: string
  readonly passMuted: string
  readonly done: string
  readonly doneMuted: string
  readonly busy: string
  readonly attentionMuted: string
  readonly fail: string
  readonly failMuted: string
}

/** Gitquiet light, for a figure drawn where nothing has said what the pack is. */
const FALLBACK: Palette = {
  canvas: "#fafafa",
  surface: "#ffffff",
  ink: "#171717",
  muted: "#737373",
  line: "#1717171f",
  accent: "#0969da",
  accentMuted: "#0969da26",
  pass: "#1a7f37",
  passMuted: "#1f883d26",
  done: "#8250df",
  doneMuted: "#8250df26",
  busy: "#9a6700",
  attentionMuted: "#9a670026",
  fail: "#d1242f",
  failMuted: "#cf222e26"
}

/** How much ink a block's paper carries, the number `.markdown pre` uses. */
const PAPER_TINT = 0.05

/**
 * The room between a label and the edge of its box, in pixels.
 *
 * `0.75rem`, which is what `.markdown pre` and every card in this interface put
 * between their edge and what is inside them.
 */
const NODE_PADDING = 12

type Rgba = readonly [number, number, number, number]

const parseHex = (colour: string): Rgba | undefined => {
  const raw = colour.trim()
  if (!raw.startsWith("#")) return undefined
  const hex = raw.slice(1)
  const wide =
    hex.length === 3 || hex.length === 4 ? [...hex].map((digit) => digit + digit).join("") : hex
  if (wide.length !== 6 && wide.length !== 8) return undefined
  const at = (index: number) => Number.parseInt(wide.slice(index, index + 2), 16)
  if (Number.isNaN(at(0)) || Number.isNaN(at(2)) || Number.isNaN(at(4))) return undefined
  return [at(0), at(2), at(4), wide.length === 8 ? at(6) / 255 : 1]
}

const toHex = (channel: number): string => channel.toString(16).padStart(2, "0")

const written = (rgb: readonly [number, number, number]): string =>
  `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`

/**
 * A colour as it really looks, once what is behind it has been counted in.
 *
 * Our washes are the solid colour at an alpha — `--color-accent-muted` is
 * `#0969da26`, which is what a badge on a card wears — and mermaid does
 * arithmetic of its own on every variable it is handed. Given eight digits it
 * reads the last two as part of the number and draws a colour nobody chose, so
 * the flattening happens here instead, against the paper underneath.
 */
const over = (colour: string, behind: string, alpha?: number): string => {
  const front = parseHex(colour)
  if (front === undefined) return colour
  const opacity = alpha ?? front[3]
  const back = parseHex(behind)
  if (opacity === 1 || back === undefined) return written([front[0], front[1], front[2]])
  const channel = (index: 0 | 1 | 2) =>
    Math.round(front[index] * opacity + back[index] * (1 - opacity))
  return written([channel(0), channel(1), channel(2)])
}

/**
 * Mermaid's palette, written in this interface's own colours.
 *
 * Mermaid asks for a fill and a border for each of the kinds of thing it draws,
 * and this interface already has those pairs: accent for the ordinary node,
 * pass and done for the two it varies to, busy for a note and fail for an
 * error. Each fill is the muted token — the same wash a badge or a highlighted
 * row wears — over the block's own paper, so a figure is read as part of the
 * panel rather than as a picture pasted into it.
 */
export const ourTheme = (palette: Palette) => {
  const paper = over(palette.ink, palette.canvas, PAPER_TINT)
  const wash = (colour: string) => over(colour, paper)
  const ink = over(palette.ink, paper)
  return {
  /*
   * The one thing not taken from the article, which sets its figures in the body
   * serif at \scriptsize. Read at 14px inside a sans interface, that looks like a
   * figure pasted in from somewhere else.
   *
   * Stated here rather than in `markdown.css` because mermaid writes its own
   * stylesheet into the SVG and scopes it by the diagram's id, which no class
   * selector of ours can outweigh. The variable resolves against the root, so a
   * pack that changes the interface font changes the labels with it.
   */
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    primaryColor: wash(palette.accentMuted),
    secondaryColor: wash(palette.passMuted),
    tertiaryColor: wash(palette.doneMuted),
    primaryTextColor: ink,
    secondaryTextColor: ink,
    tertiaryTextColor: ink,
    primaryBorderColor: palette.accent,
    secondaryBorderColor: palette.pass,
    tertiaryBorderColor: palette.done,
    lineColor: palette.muted,
    textColor: ink,
    mainBkg: wash(palette.accentMuted),
    nodeBorder: palette.accent,
    background: paper,
    clusterBkg: wash(palette.line),
    clusterBorder: over(palette.line, paper),
    titleColor: ink,
    /* The paper itself, as casing under a label a line runs behind. */
    edgeLabelBackground: paper,
    noteBkgColor: wash(palette.attentionMuted),
    noteTextColor: ink,
    noteBorderColor: palette.busy,
    errorBkgColor: wash(palette.failMuted),
    errorTextColor: ink,
    actorBkg: wash(palette.accentMuted),
    actorBorder: palette.accent,
    actorTextColor: ink,
    actorLineColor: palette.muted,
    signalColor: palette.muted,
    signalTextColor: ink,
    labelBoxBkgColor: wash(palette.passMuted),
    labelBoxBorderColor: palette.pass,
    labelTextColor: ink
  }
}

/**
 * Where the tokens are, which is our own root and not the document.
 *
 * The extension must not paint GitHub's `<html>`, so `Theme` puts the pack on
 * `#gitquiet-root` — see `ui/mount.ts` for the name. The document element is
 * what the desktop window and the capture stage paint instead, which makes it
 * the right second place to look and the wrong first one: read there on a
 * GitHub page and every figure comes out in the light pack while the panel
 * around it is dark.
 */
const painted = (): Element => document.getElementById("gitquiet-root") ?? document.documentElement

const paletteOf = (): Palette => {
  const style = getComputedStyle(painted())
  const named = (token: string, fallback: string): string => {
    const raw = style.getPropertyValue(token).trim()
    return parseHex(raw) === undefined ? fallback : raw
  }
  return {
    canvas: named("--color-canvas", FALLBACK.canvas),
    surface: named("--color-surface", FALLBACK.surface),
    ink: named("--color-ink", FALLBACK.ink),
    muted: named("--color-ink-muted", FALLBACK.muted),
    line: named("--color-line", FALLBACK.line),
    accent: named("--color-ink-accent", FALLBACK.accent),
    accentMuted: named("--color-accent-muted", FALLBACK.accentMuted),
    pass: named("--color-pass", FALLBACK.pass),
    passMuted: named("--color-pass-muted", FALLBACK.passMuted),
    done: named("--color-done", FALLBACK.done),
    doneMuted: named("--color-done-muted", FALLBACK.doneMuted),
    busy: named("--color-busy", FALLBACK.busy),
    attentionMuted: named("--color-attention-muted", FALLBACK.attentionMuted),
    fail: named("--color-fail", FALLBACK.fail),
    failMuted: named("--color-fail-muted", FALLBACK.failMuted)
  }
}

let nextId = 0

export const draw = (code: string): Effect.Effect<string | null> =>
  Effect.tryPromise({
    try: () => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: ourTheme(paletteOf()),
        /*
         * Drawn at its own size rather than squeezed into the panel. Mermaid's
         * default fits the diagram to whatever it is put in, and this interface
         * puts it in a column of twenty-six rems: a flowchart of four nodes came
         * out at a third of its size, with labels no reader could read. The
         * figure around it scrolls sideways instead — see `markdown.css`.
         *
         * `padding` is the room between a label and the edge of its box. Left
         * alone, mermaid gives a node thirty pixels of it on each side, which is
         * two and a half times what the widest thing in this interface spends
         * and made every box read as a button nobody can press.
         */
        flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: false, padding: NODE_PADDING }
      })
      nextId += 1
      return mermaid.render(`mermaid-${nextId}`, code)
    },
    catch: () => "mermaid-failed" as const
  }).pipe(
    Effect.map((drawn) => (drawn.svg === "" ? null : drawn.svg)),
    Effect.orElseSucceed(() => null)
  )
