import { describe, expect, it } from "bun:test"
import { diffChoices, treeChoices } from "./choices"
import { DEFAULTS } from "./Settings"

const diff = (over: Partial<typeof DEFAULTS.diff> = {}) => diffChoices({ ...DEFAULTS.diff, ...over })
const tree = (over: Partial<typeof DEFAULTS.tree> = {}) => treeChoices({ ...DEFAULTS.tree, ...over })

describe("turning choices into what the diff takes", () => {
  it("passes the layout and the wrapping straight through", () => {
    expect(diff({ layout: "split", longLines: "wrap" })).toMatchObject({
      layout: "split",
      overflow: "wrap"
    })
  })

  it("reads on and off as the booleans the renderer wants", () => {
    expect(diff({ lineNumbers: "off", fill: "off" })).toMatchObject({
      lineNumbers: false,
      fill: false
    })
  })

  it("asks for the word mode that handles whitespace sensibly", () => {
    expect(diff({ withinLine: "word" }).withinLine).toBe("word-alt")
    expect(diff({ withinLine: "char" }).withinLine).toBe("char")
    expect(diff({ withinLine: "none" }).withinLine).toBe("none")
  })

  it("scales the line height with the text size", () => {
    expect(diff({ textSize: "small" })).toMatchObject({ fontSize: 12, lineHeight: 20 })
    expect(diff({ textSize: "large" })).toMatchObject({ fontSize: 14, lineHeight: 24 })
  })

  it("reads the counted knobs as numbers", () => {
    expect(diff({ context: "25", expansion: "200" })).toMatchObject({
      context: 25,
      expansion: 200
    })
  })
})

describe("turning choices into what the rail takes", () => {
  it("gives every width a class", () => {
    expect(tree({ width: "narrow" }).width).toContain("clamp(13rem")
    expect(tree({ width: "medium" }).width).toContain("clamp(16rem")
    expect(tree({ width: "wide" }).width).toContain("clamp(20rem")
  })

  it("lets each of them grow with the panel they are in", () => {
    // The three widths were fixed pixels, so a tree on a five-thousand-pixel
    // screen was the same two hundred and fifty as on a laptop, with every
    // path in it cut in the middle while a third of the window sat empty.
    // A share of the panel rather than of the window: the rail is beside a
    // diff, and on a pull request there is a conversation taking a column too.
    for (const width of ["narrow", "medium", "wide"] as const) {
      expect(tree({ width }).width).toContain("cqi")
    }
  })

  it("stops each of them growing before the diff is the smaller half", () => {
    expect(tree({ width: "narrow" }).width).toContain("20rem)")
    expect(tree({ width: "medium" }).width).toContain("26rem)")
    expect(tree({ width: "wide" }).width).toContain("34rem)")
  })

  it("reads the marks as booleans", () => {
    expect(tree({ counts: "off", ticks: "off" })).toMatchObject({ counts: false, ticks: false })
  })

  it("passes the tree's own words through", () => {
    expect(tree({ density: "relaxed", folders: "closed" })).toMatchObject({
      density: "relaxed",
      folders: "closed"
    })
  })
})
