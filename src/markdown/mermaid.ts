import { Effect } from "effect"
import mermaid from "mermaid"

/**
 * Paperforge pastels, mixed into `--color-ink` so a dark pack tints them
 * toward light ink and a light pack tints them toward dark ink.
 */
const PASTELS = {
  blue: "#B4D2F0",
  green: "#B4E6C8",
  yellow: "#FFEBB4",
  orange: "#FFD2AA",
  purple: "#D2BEF0",
  gray: "#DCDCE1",
  red: "#F5BEBE"
} as const

/** How much of the ink colour is mixed into each pastel fill. */
const TINT = 0.35

const parseHex = (colour: string): readonly [number, number, number] | undefined => {
  const raw = colour.trim()
  if (!raw.startsWith("#")) return undefined
  const hex = raw.slice(1)
  if (hex.length === 3) {
    const red = hex[0]
    const green = hex[1]
    const blue = hex[2]
    if (red === undefined || green === undefined || blue === undefined) return undefined
    return [
      Number.parseInt(red + red, 16),
      Number.parseInt(green + green, 16),
      Number.parseInt(blue + blue, 16)
    ]
  }
  if (hex.length === 6) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16)
    ]
  }
  return undefined
}

const toHex = (channel: number): string => channel.toString(16).padStart(2, "0")

const mix = (pastel: string, ink: string, amount: number): string => {
  const from = parseHex(pastel)
  const toward = parseHex(ink)
  if (from === undefined || toward === undefined) return pastel
  const channel = (index: 0 | 1 | 2) =>
    Math.round(from[index] * (1 - amount) + toward[index] * amount)
  return `#${toHex(channel(0))}${toHex(channel(1))}${toHex(channel(2))}`
}

const inkOf = (): string => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim()
  return parseHex(raw) === undefined ? "#171717" : raw
}

export const paperforgeTheme = (ink: string) => {
  const fill = (pastel: string) => mix(pastel, ink, TINT)
  const edge = (pastel: string) => mix(pastel, ink, 0.5)
  return {
    primaryColor: fill(PASTELS.blue),
    secondaryColor: fill(PASTELS.green),
    tertiaryColor: fill(PASTELS.yellow),
    primaryTextColor: ink,
    secondaryTextColor: ink,
    tertiaryTextColor: ink,
    primaryBorderColor: edge(PASTELS.blue),
    secondaryBorderColor: edge(PASTELS.green),
    tertiaryBorderColor: edge(PASTELS.yellow),
    lineColor: mix(PASTELS.gray, ink, 0.5),
    textColor: ink,
    mainBkg: fill(PASTELS.blue),
    nodeBorder: edge(PASTELS.blue),
    clusterBkg: fill(PASTELS.purple),
    clusterBorder: edge(PASTELS.purple),
    titleColor: ink,
    edgeLabelBackground: fill(PASTELS.gray),
    noteBkgColor: fill(PASTELS.orange),
    noteTextColor: ink,
    noteBorderColor: edge(PASTELS.orange),
    errorBkgColor: fill(PASTELS.red),
    errorTextColor: ink,
    actorBkg: fill(PASTELS.blue),
    actorBorder: edge(PASTELS.blue),
    actorTextColor: ink,
    actorLineColor: mix(PASTELS.gray, ink, 0.5),
    signalColor: ink,
    labelBoxBkgColor: fill(PASTELS.green),
    labelTextColor: ink
  }
}

let nextId = 0

export const draw = (code: string): Effect.Effect<string | null> =>
  Effect.tryPromise({
    try: () => {
      const ink = inkOf()
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: paperforgeTheme(ink),
        flowchart: { htmlLabels: false, curve: "basis" }
      })
      nextId += 1
      return mermaid.render(`mermaid-${nextId}`, code)
    },
    catch: () => "mermaid-failed" as const
  }).pipe(
    Effect.map((drawn) => (drawn.svg === "" ? null : drawn.svg)),
    Effect.orElseSucceed(() => null)
  )
