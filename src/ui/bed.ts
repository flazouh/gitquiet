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
 */

/** Paper, ink, and the quiet grey between them. The three the page is built out of. */
export const PAPER = "#fbf9f7"
export const INK = "#1b1725"
export const MUTED = "#5f596d"

/**
 * The five stops, in the order the mesh mixes them.
 *
 * Pastel rather than saturated, and that is the whole reason ink sits directly on
 * this instead of on a card over it: every one of the five is light enough that
 * `INK` clears the contrast requirement on top of it, so the words can be on the
 * gradient rather than in a box floating above it.
 */
export const BED = ["#ff9ad1", "#ffc69d", "#ece0ff", "#a9c2ff", "#b79bff"] as const

/** The bed at rest, which is what a reader who asked for less motion is given. */
export const BED_SHADER = {
  colors: [...BED],
  positions: 40,
  waveX: 0.42,
  waveXShift: 0.6,
  waveY: 0.34,
  waveYShift: 0.25,
  mixing: 0.42,

  grainMixer: 0.28,

  grainOverlay: 0.12
}

/** The same bed, mixed harder, for a store listing that is looked at rather than read. */
export const STORE_BED_SHADER = {
  ...BED_SHADER,
  positions: 72,
  mixing: 0.16,
  waveX: 0.55,
  waveY: 0.45,
  grainMixer: 0.34
}

/**
 * The bed while it moves, slowly enough that nobody watching it can say what changed.
 *
 * `speed: 0.16` is the number this was tuned to: fast enough that the screen is alive
 * when a reader looks up from their browser, slow enough that it never asks to be
 * watched. It is a background, and a background that performs is a background nobody
 * can read over.
 */
export const BED_MOTION = {
  colors: [...BED],
  speed: 0.16,
  distortion: 0.72,
  swirl: 0.48,
  grainMixer: BED_SHADER.grainMixer,
  grainOverlay: BED_SHADER.grainOverlay
}

/** The mark's own purple, which is the logo and never a background. */
export const MARK = "#8b5cf6"

/**
 * The bed as plain CSS, for the moment before the shader has compiled and for a
 * machine where it never will.
 *
 * Five soft radial gradients at the five stops, over the last of them. It is not the
 * mesh — the mesh warps and grains, and this does neither — but it is the same five
 * colours in the same corners, so the swap when the canvas arrives is a screen
 * settling rather than a screen changing. Without it, the first frame of the first
 * screen of the app is white.
 */
export const BED_IN_CSS = [
  `radial-gradient(120% 120% at 12% 18%, ${BED[0]} 0%, transparent 58%)`,
  `radial-gradient(110% 110% at 86% 12%, ${BED[1]} 0%, transparent 55%)`,
  `radial-gradient(120% 120% at 78% 82%, ${BED[3]} 0%, transparent 60%)`,
  `radial-gradient(130% 130% at 22% 88%, ${BED[4]} 0%, transparent 62%)`,
  BED[2]
].join(", ")
