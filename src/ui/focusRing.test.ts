import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { THEME_KNOBS } from "../domain/Settings"
import { type Pack, type Scheme, type ThemeTokens, tokensOf } from "../domain/theme"

/**
 * The one mark a reader who never touches the pointer has, measured rather than
 * looked at.
 *
 * It was drawn in the accent, inside the control, and seven of the hand-written
 * packs and every generated one paint their accent and their filled accent the
 * same hex — so on most packs the ring on `Make the stack`, on the merge button
 * and on `Mark ready for review` was the colour of the fill it lay on, which is
 * no ring at all. A screenshot proves one pack; these two rules hold for every
 * pack this interface ships, which is why they are here rather than in a probe.
 */

const sheetAt = (path: string) => readFileSync(path, "utf8")

/** The declarations of the rule that draws the ring, by the sheet it is written in. */
const ringRule = (path: string): string => {
  const sheet = sheetAt(path)
  const at = sheet.indexOf("#gitquiet-root :focus-visible {")
  return at === -1 ? "" : sheet.slice(at, sheet.indexOf("}", at))
}

const offsetOf = (rule: string): number =>
  Number.parseFloat(/outline-offset:\s*(-?[\d.]+)px/.exec(rule)?.[1] ?? "NaN")

/** The token the ring is painted in, which is what makes it follow the pack. */
const colourOf = (rule: string): string =>
  /outline:[^;]*var\((--[\w-]+)\)/.exec(rule)?.[1] ?? ""

const packs = (
  THEME_KNOBS.find((knob) => knob.key === "pack")?.choices ?? []
)
  .map((choice) => choice.value)
  .filter((value): value is Pack => value !== "match")

/** WCAG's relative luminance, which is the whole of what a contrast ratio is made of. */
const luminance = (hex: string): number => {
  const digits = hex.replace("#", "")
  const channel = (at: number): number => {
    const part = Number.parseInt(digits.slice(at, at + 2), 16) / 255
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

const contrast = (one: string, two: string): number => {
  const first = luminance(one)
  const second = luminance(two)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** Every fill a control of ours can stand on, which is what the ring is drawn over. */
const GROUNDS = [
  "--color-canvas",
  "--color-inset",
  "--color-surface",
  "--color-raised"
] as const satisfies ReadonlyArray<keyof ThemeTokens>

/** WCAG's floor for something that is not text, and a ring is not text. */
const ENOUGH = 3

const everyFace = function* (): Generator<readonly [Pack, Scheme, ThemeTokens]> {
  for (const pack of packs) {
    for (const scheme of ["light", "dark"] as const) yield [pack, scheme, tokensOf(pack, scheme)]
  }
}

describe.each([
  ["on GitHub's page", "src/ui/primer.css"],
  ["in a window of our own", "desktop/src/view/style.css"]
])("the ring the keyboard leaves %s", (_where, path) => {
  test("is drawn outside the control, where its own fill cannot reach it", () => {
    // A negative offset pulls the ring inside the border box and paints it on
    // whatever the control is filled with. On the filled accent controls — the
    // strip's press, the merge button, `Mark ready for review` — that fill is the
    // accent, and so was the ring.
    expect(offsetOf(ringRule(path))).toBeGreaterThan(0)
  })

  test("carries against every surface a control stands on, in every pack", () => {
    const token = colourOf(ringRule(path))
    expect(token).not.toBe("")

    for (const [pack, scheme, tokens] of everyFace()) {
      const ring = tokens[token as keyof ThemeTokens]
      expect(ring, `${token} is not a pack token`).toBeDefined()

      for (const ground of GROUNDS) {
        // A pack whose own words do not clear the floor on a surface cannot be
        // asked to clear it with a ring. Material's light face is the one: its
        // ink is a grey at 2.5 against its canvas, and that is the pack's answer
        // about itself rather than anything this rule can put right.
        if (contrast(tokens["--color-ink"], tokens[ground]) < ENOUGH) continue

        expect(
          contrast(ring, tokens[ground]),
          `${pack} ${scheme}: ${token} on ${ground}`
        ).toBeGreaterThanOrEqual(ENOUGH)
      }
    }
  })
})
