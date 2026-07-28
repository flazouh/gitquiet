import { describe, expect, it } from "bun:test"
import { diffChoices, treeChoices } from "./apply"
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
    expect(tree({ width: "narrow" }).width).toBe("w-52")
    expect(tree({ width: "medium" }).width).toBe("w-64")
    expect(tree({ width: "wide" }).width).toBe("w-80")
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
