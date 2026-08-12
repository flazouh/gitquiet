import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { draw, ourTheme, type Palette } from "./mermaid"

/** Gitquiet light, as `domain/theme.ts` writes it. */
const LIGHT: Palette = {
  canvas: "#fafafa",
  surface: "#ffffff",
  ink: "#171717",
  muted: "#737373",
  line: "#1717171f",
  accent: "#0969da",
  accentMuted: "#0969da26",
  pass: "#1a7f37",
  passMuted: "#1f883d26",
  done: "#8250df",
  doneMuted: "#8250df26",
  busy: "#9a6700",
  attentionMuted: "#9a670026",
  fail: "#d1242f",
  failMuted: "#cf222e26"
}

describe("drawing a mermaid fence", () => {
  test("prints the figure on the same paper as a code block", () => {
    const theme = ourTheme(LIGHT)

    // `--color-ink` at 5% over the card, which is what `.markdown pre` paints.
    expect(theme.background).toBe("#efefef")
    expect(theme.edgeLabelBackground).toBe("#efefef")
  })

  test("fills a node with the accent wash a badge on a card wears", () => {
    const theme = ourTheme(LIGHT)

    // `--color-accent-muted` over that paper.
    expect(theme.primaryColor).toBe("#cddbec")
    expect(theme.mainBkg).toBe("#cddbec")
    expect(theme.nodeBorder).toBe("#0969da")
  })

  test("varies a node the way this interface varies a panel", () => {
    const theme = ourTheme(LIGHT)

    expect(theme.secondaryBorderColor).toBe(LIGHT.pass)
    expect(theme.tertiaryBorderColor).toBe(LIGHT.done)
    expect(theme.noteBorderColor).toBe(LIGHT.busy)
    expect(theme.errorBkgColor).not.toBe(theme.mainBkg)
  })

  test("writes every word in the reader's own ink", () => {
    const theme = ourTheme(LIGHT)

    expect(theme.textColor).toBe("#171717")
    expect(theme.primaryTextColor).toBe("#171717")
    expect(theme.noteTextColor).toBe("#171717")
    expect(theme.lineColor).toBe("#737373")
  })

  test("labels the diagram in the interface's own font, at its own size", () => {
    const theme = ourTheme(LIGHT)

    expect(theme.fontFamily).toBe("var(--font-sans)")
    expect(theme.fontSize).toBe("13px")
  })

  test("returns nothing for a diagram that does not parse", async () => {
    expect(await Effect.runPromise(draw("this is not mermaid"))).toBeNull()
  })
})
