import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { DIFF_KNOBS, TREE_KNOBS } from "../settings/Settings"
import { sampleOf } from "./SettingsPreview"

afterEach(cleanup)

const every = [...DIFF_KNOBS, ...TREE_KNOBS]

describe("the little mockups in the bubble", () => {
  it("draws one for every choice of every knob", () => {
    for (const knob of every) {
      for (const choice of knob.choices) {
        expect([knob.key, choice.value, sampleOf(knob.key, choice.value) !== null]).toEqual([
          knob.key,
          choice.value,
          true
        ])
      }
    }
  })

  it("renders each one without throwing", () => {
    for (const knob of every) {
      for (const choice of knob.choices) {
        const { unmount } = render(<>{sampleOf(knob.key, choice.value)}</>)
        unmount()
      }
    }
  })

  it("shows something different for each choice", () => {
    // A mockup that looks the same whichever choice it is illustrating is worse
    // than none: it says the setting does nothing.
    for (const knob of every) {
      const drawn = knob.choices.map((choice) => {
        const view = render(<>{sampleOf(knob.key, choice.value)}</>)
        const html = view.container.innerHTML
        view.unmount()
        return html
      })
      expect([knob.key, new Set(drawn).size]).toEqual([knob.key, knob.choices.length])
    }
  })

  it("says nothing about a knob it has no picture for", () => {
    expect(sampleOf("invented", "on")).toBeNull()
  })
})
