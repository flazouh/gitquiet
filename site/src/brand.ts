/*
 * The gradient and the ink now live in `src/ui/bed.ts`, because the desktop app's
 * first screen draws them too. Passed straight through rather than re-typed here, so
 * that this file stays the one place the page imports its brand from.
 */
export {
  BED,
  BED_IN_CSS,
  BED_MOTION,
  BED_SHADER,
  INK,
  MARK,
  MUTED,
  PAPER,
  STORE_BED_SHADER
} from "../../src/ui/bed"

export const RULE = "rgba(27, 23, 37, 0.12)"

export const SHOT_SHADOW = "0 32px 80px -28px rgba(27, 23, 37, 0.28)"

export const SCREEN_EDGE = "rgba(27, 23, 37, 0.14)"

export const SCREEN_SHADOW = [
  "0 1px 2px rgba(27, 23, 37, 0.05)",
  "0 18px 44px -22px rgba(27, 23, 37, 0.2)"
].join(", ")

export const HERO_SHADOW = "0 48px 120px -36px rgba(27, 23, 37, 0.38)"
