import { describe, expect, it } from "bun:test"
import { DEFAULTS, DIFF_KNOBS, PAGE_KNOBS, readSettings, TREE_KNOBS } from "./Settings"

describe("the settings schema", () => {
  it("gives every knob a default that is one of its own choices", () => {
    for (const knob of [...PAGE_KNOBS, ...DIFF_KNOBS, ...TREE_KNOBS]) {
      const offered = knob.choices.map((choice) => choice.value)
      expect(offered).toContain(knob.fallback)
    }
  })

  it("names every knob once", () => {
    const keys = [
      ...PAGE_KNOBS.map((one) => one.key),
      ...DIFF_KNOBS.map((one) => one.key),
      ...TREE_KNOBS.map((one) => one.key)
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("explains every knob, at more length than its label", () => {
    for (const knob of [...PAGE_KNOBS, ...DIFF_KNOBS, ...TREE_KNOBS]) {
      expect(knob.note.length).toBeGreaterThan(80)
      expect(knob.note.trim().endsWith(".")).toBe(true)
    }
  })

  it("names every choice somewhere in the knob's explanation", () => {
    // Not a spelling check: a note that never mentions what the options are is
    // a note that describes the setting instead of helping anyone choose.
    for (const knob of [...DIFF_KNOBS, ...TREE_KNOBS]) {
      const said = knob.note.toLowerCase()
      const named = knob.choices.filter((choice) => said.includes(choice.label.toLowerCase()))
      const onOff = knob.choices.every((choice) => choice.value === "on" || choice.value === "off")
      expect(onOff ? 1 : named.length).toBeGreaterThan(0)
    }
  })

  it("keeps most of the menu out of the advanced section", () => {
    const curated = [...DIFF_KNOBS, ...TREE_KNOBS].filter((one) => !one.advanced)
    expect(curated.length).toBeGreaterThan(10)
  })
})

describe("reading what was stored", () => {
  it("falls back to the defaults when there is nothing", () => {
    expect(readSettings(undefined)).toEqual(DEFAULTS)
    expect(readSettings(null)).toEqual(DEFAULTS)
    expect(readSettings("nonsense")).toEqual(DEFAULTS)
  })

  it("keeps a stored choice that is still offered", () => {
    const read = readSettings({ diff: { layout: "split" }, tree: { density: "relaxed" } })

    expect(read.diff.layout).toBe("split")
    expect(read.tree.density).toBe("relaxed")
  })

  it("drops a value the schema no longer offers", () => {
    const read = readSettings({ diff: { layout: "three-way", textSize: 12 } })

    expect(read.diff.layout).toBe("unified")
    expect(read.diff.textSize).toBe("small")
  })

  it("fills in a knob that did not exist when the settings were written", () => {
    const read = readSettings({ diff: { layout: "split" } })
    expect(read.tree.icons).toBe("material")
  })
})

describe("choosing whose pull request page to read", () => {
  it("starts on ours, which is the reason the extension is installed", () => {
    expect(DEFAULTS.page.view).toBe("ours")
  })

  it("keeps a reader who has asked for GitHub's page on it", () => {
    expect(readSettings({ page: { view: "github" } }).page.view).toBe("github")
  })

  it("comes back to ours rather than to a page nobody offers", () => {
    expect(readSettings({ page: { view: "classic" } }).page.view).toBe("ours")
  })
})
