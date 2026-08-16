/**
 * What the read-ahead is thinking, drawn in the corner of a development build.
 *
 * The accumulator is invisible by design: it either read the page before the press or it
 * did not, and both look the same from the outside. Which makes it hard to tell a rule
 * that is working from one that is firing on everything, and impossible to feel what a
 * change to the rates did. So this puts the numbers on the screen while the pointer
 * moves: what is earning, how fast, how far off, and what it fired.
 *
 * Never in a build a reader installs. Every caller sits behind `import.meta.env.DEV`,
 * which Vite replaces with `false` before Rollup runs, so the branch and then this whole
 * module are gone from the bundle. Nothing here runs at import time, which is what lets
 * that last step happen.
 */

import { type Lingering, rateAt, RIPE } from "./lingering"
import type { Point } from "./near"

/** Everything one frame of the loop decided, as the panel needs it. */
export type Hint = {
  readonly travel: Point
  readonly lingering: Lingering
  /** What the pointer is earning towards this frame, where anything is. */
  readonly seen: { readonly key: string; readonly reach: number; readonly forward: number } | null
  readonly read: number
  readonly atMost: number
  /** False where data saver or a slow connection has the read-ahead switched off. */
  readonly sparing: boolean
}

const PANEL = "gitquiet-lingering-hint"

/** How long the last page read stays named under the bars. */
const REMEMBER = 2_000

/** How many bars fit before the panel is more noise than signal. */
const ROWS = 6

const WIDE = 14

let announced: { readonly key: string; readonly at: number } | undefined

const barOf = (earned: number): string => {
  const full = Math.max(Math.min(Math.round((earned / RIPE) * WIDE), WIDE), 0)
  return `${"█".repeat(full)}${"░".repeat(WIDE - full)}`
}

/** Right-aligned, so a column of numbers reads as a column rather than as a ragged edge. */
const wide = (text: string | number, width: number): string => String(text).padStart(width)

const panelIn = (host: Document): HTMLElement => {
  const found = host.getElementById(PANEL)
  if (found !== null) return found

  const panel = host.createElement("div")
  panel.id = PANEL
  panel.style.cssText = [
    "position:fixed",
    "left:12px",
    "bottom:12px",
    "z-index:2147483647",
    "pointer-events:none",
    "white-space:pre",
    "font:11px/1.45 ui-monospace,Menlo,monospace",
    "color:#e6edf3",
    "background:rgba(13,17,23,.92)",
    "border:1px solid #30363d",
    "border-radius:6px",
    "padding:8px 10px",
    "max-width:340px"
  ].join(";")

  host.documentElement.append(panel)
  return panel
}

/**
 * Draws one frame of the panel, and does nothing where nothing has changed.
 *
 * The comparison is on the finished text rather than on the state behind it, because the
 * state changes every frame by a fraction of a pixel and the text does not. A panel
 * rewritten sixty times a second in front of the pointer is the jank this is meant to
 * help find.
 *
 * And it is read off the panel rather than remembered here, so a panel that went away
 * with the page under it is drawn again on the next frame rather than judged unchanged.
 */
export const showLingering = (hint: Hint, host: Document = document): void => {
  const now = Date.now()
  const heading =
    Math.hypot(hint.travel.x, hint.travel.y) < 0.5
      ? "still"
      : `${wide(hint.travel.x.toFixed(0), 4)},${wide(hint.travel.y.toFixed(0), 4)}`

  const ranked = [...hint.lingering].sort(([, one], [, two]) => two - one).slice(0, ROWS)

  const lines = [
    `read-ahead   ${hint.sparing ? "sparing data" : `read ${hint.read}/${hint.atMost}`}`,
    `heading ${heading}`
  ]

  for (const [key, earned] of ranked) {
    const earning = key === hint.seen?.key ? hint.seen : null
    lines.push(
      "",
      `${earning === null ? "  " : "▸ "}${key}`,
      `  ${barOf(earned)} ${wide(earned.toFixed(0), 3)}/${RIPE}`,
      earning === null
        ? "  gone cold"
        : `  ${wide(earning.reach, 2)}px  aim ${earning.forward.toFixed(2)}  ×${rateAt(
            earning.reach,
            earning.forward
          ).toFixed(2)}`
    )
  }

  if (ranked.length === 0) lines.push("", "  nothing near")

  if (announced !== undefined && now - announced.at < REMEMBER) {
    lines.push("", `read ▸ ${announced.key}`)
  }

  const text = lines.join("\n")
  const panel = panelIn(host)
  if (panel.textContent === text) return

  panel.textContent = text
}

/** Names the page a ripe link just sent for, under the bars, for a couple of seconds. */
export const hintRead = (key: string): void => {
  announced = { key, at: Date.now() }
}
