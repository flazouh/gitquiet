import { describe, expect, test } from "bun:test"
import { tabMark } from "./tabMarks"

describe("the glyph a tab of theirs wears", () => {
  test("is named for the meaning, so both icon sets answer the same question", () => {
    expect(tabMark("Code")).toBe("code")
    expect(tabMark("Pull requests")).toBe("pull-request")
    expect(tabMark("Discussions")).toBe("comments")
  })

  test("reads a tab GitHub renamed, which is how Security became Security and quality", () => {
    // The names are theirs and they move: the row is read off their own nav rather than
    // written down here, so a rule keyed to the whole string would drop the glyph on the
    // day they add a word to it.
    expect(tabMark("Security and quality")).toBe("security")
    expect(tabMark("Security")).toBe("security")
  })

  test("marks a tab nobody has met, rather than leaving a hole in the column", () => {
    // Their row grows: a tenth tab arrives in the menu without a line of ours changing,
    // and one row of six starting two glyphs to the left reads as a fault.
    expect(tabMark("Copilot")).toBe("dot")
  })
})
