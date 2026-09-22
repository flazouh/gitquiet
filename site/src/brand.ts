/*
 * Site-only surfaces. Shared ink / mesh lives in `src/ui/bed.ts`.
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

export const FIELD = "#0c0c0c"
export const FIELD_MID = "#131315"
export const TEAL = "#6c7878"
export const TEAL_SOFT = "#9ca8a8"
export const SAND = "#606054"
export const SAND_SOFT = "#848478"

export const RULE = "rgba(156, 168, 168, 0.16)"

export const SCREEN_EDGE = "rgba(156, 168, 168, 0.18)"

export const SCREEN_SHADOW = [
  "0 1px 2px rgba(0, 0, 0, 0.2)",
  "0 18px 44px -22px rgba(0, 0, 0, 0.55)"
].join(", ")

export const HERO_SHADOW = "0 48px 120px -36px rgba(0, 0, 0, 0.65)"
