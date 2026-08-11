/**
 * Page zoom for the webview (browser-style Cmd+/−/0).
 *
 * Electrobun exposes `BrowserWindow.setPageZoom` on WebKit. The step size and
 * bounds live here so the key handler and the main-process RPC agree without
 * either one inventing its own ladder.
 */

export type PageZoomHow = "in" | "out" | "reset"

const MIN = 0.5
const MAX = 3
const STEP = 0.1

/**
 * A zoom brought onto the ladder, whatever arrived.
 *
 * Needed once zoom is kept on disk between runs: the file is editable, a build
 * that changed these bounds leaves values outside them behind, and a webview
 * handed `NaN` draws nothing at all. One rung is not enough to be worth a step
 * function, so this rounds to the same tenth `nextPageZoom` works in.
 */
export const clampPageZoom = (zoom: unknown): number => {
  if (typeof zoom !== "number" || !Number.isFinite(zoom)) return 1
  return Math.min(MAX, Math.max(MIN, Math.round(zoom * 10) / 10))
}

export const nextPageZoom = (current: number, how: PageZoomHow): number => {
  if (how === "reset") return 1
  const stepped = how === "in" ? current + STEP : current - STEP
  const rounded = Math.round(stepped * 10) / 10
  return Math.min(MAX, Math.max(MIN, rounded))
}

/** Which zoom action a keypress asks for, or nothing. */
export const pageZoomFromPress = (press: {
  readonly key: string
  readonly meta?: boolean
  readonly ctrl?: boolean
  readonly alt?: boolean
}): PageZoomHow | null => {
  if (press.meta !== true && press.ctrl !== true) return null
  if (press.alt === true) return null

  switch (press.key) {
    case "=":
    case "+":
    case "Add":
    case "NumpadAdd":
      return "in"
    case "-":
    case "_":
    case "Subtract":
    case "NumpadSubtract":
      return "out"
    case "0":
    case "Digit0":
    case "Numpad0":
      return "reset"
    default:
      return null
  }
}
