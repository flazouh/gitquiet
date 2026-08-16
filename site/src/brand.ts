/*
 * What only the page needs. The gradient, the ink and the mark are in `src/ui/bed.ts`,
 * because the app's first screen draws them too, and the page imports them from there
 * rather than through this file: a name that arrives by two roads is a name somebody
 * changes on one of them.
 */

import { BED_SHADER } from "@/ui/bed"

/** The same bed, mixed harder, for a store listing that is looked at rather than read. */
export const STORE_BED_SHADER = {
  ...BED_SHADER,
  positions: 72,
  mixing: 0.16,
  waveX: 0.55,
  waveY: 0.45,
  grainMixer: 0.34
}

export const RULE = "rgba(27, 23, 37, 0.12)"

export const SHOT_SHADOW = "0 32px 80px -28px rgba(27, 23, 37, 0.28)"

export const SCREEN_EDGE = "rgba(27, 23, 37, 0.14)"

export const SCREEN_SHADOW = [
  "0 1px 2px rgba(27, 23, 37, 0.05)",
  "0 18px 44px -22px rgba(27, 23, 37, 0.2)"
].join(", ")

export const HERO_SHADOW = "0 48px 120px -36px rgba(27, 23, 37, 0.38)"
