import { describe, expect, spyOn, test } from "bun:test"
import { Effect } from "effect"
import mermaid from "mermaid"
import { draw, paperforgeLayout, paperforgeTheme } from "./mermaid"

describe("drawing a mermaid fence", () => {
  test("fills nodes with the paperforge pastels themselves", () => {
    const theme = paperforgeTheme()

    expect(theme.primaryColor).toBe("#b4d2f0")
    expect(theme.secondaryColor).toBe("#b4e6c8")
    expect(theme.tertiaryColor).toBe("#ffebb4")
    expect(theme.clusterBkg).toBe("#d2bef0")
  })

  test("draws every border at black!40 and every arrow at black!60", () => {
    const theme = paperforgeTheme()

    expect(theme.nodeBorder).toBe("#999999")
    expect(theme.primaryBorderColor).toBe("#999999")
    expect(theme.clusterBorder).toBe("#999999")
    expect(theme.lineColor).toBe("#666666")
    expect(theme.signalColor).toBe("#666666")
  })

  test("prints on paper, in both packs, because the pastels are paper colours", () => {
    const theme = paperforgeTheme()

    expect(theme.background).toBe("#ffffff")
    expect(theme.edgeLabelBackground).toBe("#ffffff")
  })

  test("labels the diagram in the interface's own font, at its own size", () => {
    const theme = paperforgeTheme()

    expect(theme.fontFamily).toBe("var(--font-sans)")
    expect(theme.fontSize).toBe("13px")
  })

  test("writes labels in black, because the fills are paper pastels", () => {
    const theme = paperforgeTheme()

    expect(theme.primaryTextColor).toBe("#000000")
    expect(theme.textColor).toBe("#000000")
    expect(theme.noteTextColor).toBe("#000000")
  })

  test("gives a box the room a template gives it, and no more", () => {
    const layout = paperforgeLayout()

    // `inner sep=5pt`, against mermaid's fifteen.
    expect(layout.flowchart.padding).toBe(6)
    // `minimum height=0.6cm`, against mermaid's fixed 150 by 65.
    expect(layout.sequence.height).toBe(26)
    expect(layout.sequence.width).toBe(100)
    expect(layout.sequence.mirrorActors).toBe(false)
  })

  test("draws at its own size, so the figure scrolls instead of shrinking", () => {
    const layout = paperforgeLayout()

    expect(layout.flowchart.useMaxWidth).toBe(false)
    expect(layout.sequence.useMaxWidth).toBe(false)
  })

  test("returns nothing for a diagram that does not parse", async () => {
    expect(await Effect.runPromise(draw("this is not mermaid"))).toBeNull()
  })

  test("lays one diagram out once when a screen draws it again", async () => {
    const render = spyOn(mermaid, "render")
    const source = "graph TD\nCacheA-->CacheB"

    await Effect.runPromise(draw(source))
    await Effect.runPromise(draw(source))

    expect(render).toHaveBeenCalledTimes(1)
    render.mockRestore()
  })
})
