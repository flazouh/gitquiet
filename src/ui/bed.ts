/**
 * The gradient this product is recognised by, and the ink that is legible on it.
 *
 * Here rather than in the site, because two builds draw it now: the page somebody
 * downloads the app from, and the first screen the app shows them. Those two are the
 * same minute of the same person's life, so a stop that drifts in one of them is a
 * reader asking whether they opened the right thing.
 *
 * Data and nothing else. The shader library that reads these numbers is a WebGL
 * dependency, and this folder is reachable from the extension's bundle as well —
 * so the numbers are shared and the canvas that draws them is not.
 *
 * Palette: muted Wafer atmosphere (desaturated teal-grey + sandy/olive beige) with
 * near-black glass. Not pastel pink/lavender, not hot magenta mesh pools, not
 * Luminar cobalt.
 */

import type { CSSProperties } from "react"

/** Sampled teal-greys from the Wafer reference. */
export const TEAL = {
  deep: "#6C7878",
  mid: "#9CA8A8",
  soft: "#90A8A8"
} as const

/** Sampled olive/sand from the Wafer reference. */
export const SAND = {
  deep: "#606054",
  mid: "#848478",
  olive: "#6C6C54"
} as const

/** Near-black glass panels that sit on the atmosphere. */
export const GLASS = "#131315"
export const GLASS_DEEP = "#0C0C0C"

/**
 * Soft atmosphere floor for page chrome outside a glass panel.
 * Mid teal-sand so dark ink stays legible without pink paper.
 */
export const PAPER = "#A8B0AE"
export const INK = "#0E0E10"
export const MUTED = "#4A504C"

/** Light ink for type that sits on dark glass. */
export const ON_GLASS = "#F3F4F7"
export const ON_GLASS_MUTED = "rgba(243, 244, 247, 0.62)"

/**
 * The same three, as the custom properties `onboarding.css` reads.
 *
 * Set by whatever a host puts the onboarding inside rather than by the onboarding
 * itself, because a custom property is only visible below where it is declared. The
 * app's window says the private line under the panel in `--bed-muted`, and that line
 * is a sibling of the panel: declared on the tour, it fell through to the interface's
 * own ink, which is near-white in dark mode and invisible on this gradient.
 *
 * One cast, here, because React's own type has no room for a custom property.
 */
export const BED_COLOURS = {
  "--bed-ink": INK,
  "--bed-muted": MUTED,
  "--bed-paper": PAPER
} as CSSProperties

/**
 * Nine MeshGradient slots — only sober teal/sand/charcoal.
 * Sparse enough that the field stays atmospheric, not a party mesh.
 */
export const BED = [
  TEAL.deep,
  TEAL.mid,
  SAND.mid,
  TEAL.soft,
  SAND.olive,
  "#B0B8B0",
  SAND.deep,
  "#787868",
  GLASS
] as const

/** The bed at rest, which is what a reader who asked for less motion is given. */
export const BED_SHADER = {
  colors: [...BED],
  positions: 40,
  waveX: 0.42,
  waveXShift: 0.6,
  waveY: 0.34,
  waveYShift: 0.25,
  mixing: 0.42,
  grainMixer: 0.22,
  grainOverlay: 0.45
}

/**
 * The bed while it moves, slowly enough that nobody watching it can say what changed.
 * Tuned as background, not spectacle — lower swirl/distortion than the old pastel bed.
 */
export const BED_MOTION = {
  colors: [...BED],
  speed: 0.1,
  distortion: 0.28,
  swirl: 0.05,
  grainMixer: BED_SHADER.grainMixer,
  grainOverlay: BED_SHADER.grainOverlay
}

/** Mark accent on light atmosphere — sober dark teal-grey, never violet. */
export const MARK = "#3E4848"

/**
 * How the bed is turned and over-scaled where it stands behind a whole screen.
 *
 * The app's window and the site's welcome page have to agree on these two numbers,
 * because a reader arrives at the second from the first.
 */
export const BED_BEHIND = { rotation: 14, scale: 1.45 } as const

/**
 * The bed as plain CSS, for the moment before the shader has compiled and for a
 * machine where it never will. Soft teal→sand radials, no pink.
 */
export const BED_IN_CSS = [
  `radial-gradient(42% 58% at 12% 22%, ${TEAL.mid} 0%, transparent 72%)`,
  `radial-gradient(46% 64% at 88% 18%, ${TEAL.soft}cc 0%, transparent 72%)`,
  `radial-gradient(40% 52% at 78% 86%, ${SAND.mid}b3 0%, transparent 70%)`,
  `radial-gradient(44% 56% at 18% 84%, ${SAND.olive}99 0%, transparent 68%)`,
  `radial-gradient(50% 40% at 50% 48%, ${TEAL.deep}66 0%, transparent 65%)`,
  PAPER
].join(", ")
