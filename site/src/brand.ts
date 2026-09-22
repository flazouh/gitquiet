/*
 * What only the page needs. The gradient, the ink and the mark are in `src/ui/bed.ts`,
 * because the app's first screen draws them too, and the page imports them from there
 * rather than through this file: a name that arrives by two roads is a name somebody
 * changes on one of them.
 */

import { BED_SHADER } from "@/ui/bed"

/** The same charcoal bed, mixed harder, for a store listing that is looked at rather than read. */
export const STORE_BED_SHADER = {
  ...BED_SHADER,
  positions: 72,
  mixing: 0.22,
  waveX: 0.55,
  waveY: 0.45,
  grainMixer: 0.28,
  grainOverlay: 0.5
}

export const RULE = "rgba(21, 23, 27, 0.12)"

export const SHOT_SHADOW = "0 32px 80px -28px rgba(19, 19, 21, 0.45)"

export const SCREEN_EDGE = "rgba(21, 23, 27, 0.14)"

export const SCREEN_SHADOW = [
  "0 1px 2px rgba(21, 23, 27, 0.05)",
  "0 18px 44px -22px rgba(21, 23, 27, 0.2)"
].join(", ")

export const HERO_SHADOW = "0 48px 120px -36px rgba(0, 0, 0, 0.55)"
