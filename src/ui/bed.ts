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
 * Model (Wafer accents on a Luminar-shaped charcoal field): near-black field with
 * sparse colourful pools; light ink sits on the field. Cool paper + dark ink are for
 * page chrome *outside* the bed — not for type drawn on the mesh.
 */

import type { CSSProperties } from "react"

/** Cool paper page body (outside the bed), and the ink that sits on it. */
export const PAPER = "#F6F7F9"
export const INK = "#15171B"
export const MUTED = "#5C6370"

/** Near-black charcoal the mesh mostly fills with. */
export const FIELD = "#131315"

/** Light ink for type that sits on the charcoal field. */
export const ON_BED_INK = "#F3F4F7"
export const ON_BED_MUTED = "rgba(243, 244, 247, 0.62)"

/** Luminar CTA blue — primary store button on a dark hero. */
export const CTA = "#0A6CFF"

/**
 * Wafer accent pools sampled from the reference UI. Sparse on purpose: the field
 * stays charcoal; these read as light pools, not a rainbow page.
 */
export const ACCENTS = {
  pink: "#E53061",
  magenta: "#E665B3",
  coral: "#ED494A",
  peach: "#E9A86D",
  mint: "#87F0BA"
} as const

/**
 * The same three, as the custom properties `onboarding.css` reads — for surfaces
 * *on the bed* (light ink / dark field). A frosted light tour sheet that hosts the
 * tour must re-declare page `INK` / `PAPER` on itself so tour text stays dark on
 * white; the host root keeps these for nav, lockup, and siblings on the mesh.
 *
 * One cast, here, because React's own type has no room for a custom property.
 */
export const BED_COLOURS = {
  "--bed-ink": ON_BED_INK,
  "--bed-muted": ON_BED_MUTED,
  "--bed-paper": FIELD
} as CSSProperties

/**
 * Page ink / paper redeclared on a light tour sheet so `.tour` contrast holds
 * after the host flips `--bed-*` to on-bed (light-on-dark) tokens.
 */
export const TOUR_SHEET_COLOURS = {
  "--bed-ink": INK,
  "--bed-muted": MUTED,
  "--bed-paper": PAPER
} as CSSProperties

/**
 * Nine MeshGradient slots, charcoal-led like Luminar's FIELD_COLORS: field fills
 * most slots so Wafer accents read as pools of light, not a saturated page.
 */
export const BED = [
  FIELD,
  FIELD,
  ACCENTS.pink,
  FIELD,
  FIELD,
  FIELD,
  ACCENTS.magenta,
  FIELD,
  ACCENTS.mint
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
  grainMixer: 0.2,
  grainOverlay: 0.55
}

/**
 * The bed while it moves, slowly enough that nobody watching it can say what changed.
 *
 * Tuned closer to Luminar's charcoal hero on a dark field: lower swirl/distortion,
 * speed ~0.12. It is a background, and a background that performs is a background
 * nobody can read over.
 */
export const BED_MOTION = {
  colors: [...BED],
  speed: 0.12,
  distortion: 0.3,
  swirl: 0.05,
  grainMixer: BED_SHADER.grainMixer,
  grainOverlay: BED_SHADER.grainOverlay
}

/** The mark's own accent on the site — mint from the Wafer set, not the old violet. */
export const MARK = ACCENTS.mint

/**
 * How the bed is turned and over-scaled where it stands behind a whole screen.
 *
 * The mesh's seams run corner to corner at rest, and both screens that use it this way
 * are wider than they are tall, so at `scale: 1` the middle — where every word is —
 * sat in the flattest part of it. The app's window and the site's welcome page have to
 * agree on these two numbers, because a reader arrives at the second from the first.
 */
export const BED_BEHIND = { rotation: 14, scale: 1.45 } as const

/**
 * The bed as plain CSS, for the moment before the shader has compiled and for a
 * machine where it never will.
 *
 * Charcoal field with sparse Wafer radial pools — same spirit as Luminar's
 * `.hero-charcoal-fallback`. Not the mesh (no warp, no grain), but the same field
 * and accents in the same corners, so the swap when the canvas arrives is a screen
 * settling rather than a screen changing.
 */
export const BED_IN_CSS = [
  `radial-gradient(42% 58% at 8% 22%, ${ACCENTS.pink}b8 0%, transparent 72%)`,
  `radial-gradient(46% 64% at 92% 18%, ${ACCENTS.magenta}c7 0%, transparent 72%)`,
  `radial-gradient(36% 48% at 78% 88%, ${ACCENTS.coral}66 0%, transparent 70%)`,
  `radial-gradient(40% 52% at 18% 86%, ${ACCENTS.mint}59 0%, transparent 68%)`,
  `radial-gradient(50% 40% at 55% 48%, ${ACCENTS.peach}33 0%, transparent 65%)`,
  FIELD
].join(", ")
