export const PAPER = "#fbf9f7"

export const INK = "#1b1725"
export const MUTED = "#5f596d"

export const RULE = "rgba(27, 23, 37, 0.12)"

export const BED = ["#ff9ad1", "#ffc69d", "#ece0ff", "#a9c2ff", "#b79bff"] as const

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

export const STORE_BED_SHADER = {
  ...BED_SHADER,
  positions: 72,
  mixing: 0.16,
  waveX: 0.55,
  waveY: 0.45,
  grainMixer: 0.34
}

export const BED_MOTION = {
  colors: [...BED],
  speed: 0.16,
  distortion: 0.72,
  swirl: 0.48,
  grainMixer: BED_SHADER.grainMixer,
  grainOverlay: BED_SHADER.grainOverlay
}

export const MARK = "#8b5cf6"

export const SHOT_SHADOW = "0 32px 80px -28px rgba(27, 23, 37, 0.28)"

export const SCREEN_EDGE = "rgba(27, 23, 37, 0.14)"

export const SCREEN_SHADOW = [
  "0 1px 2px rgba(27, 23, 37, 0.05)",
  "0 18px 44px -22px rgba(27, 23, 37, 0.2)"
].join(", ")

export const HERO_SHADOW = "0 48px 120px -36px rgba(27, 23, 37, 0.38)"
