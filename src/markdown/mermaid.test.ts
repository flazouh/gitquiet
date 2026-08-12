import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { draw, paperforgeTheme } from "./mermaid"

describe("drawing a mermaid fence", () => {
  test("tints paperforge blue with the ink colour", () => {
    const theme = paperforgeTheme("#000000")

    // 35% #000000 into pBlue #B4D2F0 → #75899c
    expect(theme.primaryColor).toBe("#75899c")
    expect(theme.primaryTextColor).toBe("#000000")
  })

  test("returns nothing for a diagram that does not parse", async () => {
    expect(await Effect.runPromise(draw("this is not mermaid"))).toBeNull()
  })
})
