import { describe, expect, test } from "bun:test"
import { continued, indented, linked } from "./typing"

/**
 * What a box does with a press that is not a letter.
 *
 * The two edits every editor a reader has used already makes, and neither of which a plain
 * textarea makes: Enter under a list carries the list on, and a pasted address over chosen
 * words becomes a link around them. Both are pure text in and text out, which is why they
 * are here rather than in the component: the fiddly part is the caret, not the keystroke.
 */

describe("carrying a list on, which is what Enter means under one", () => {
  const at = (text: string) => text.indexOf("|")
  const said = (text: string) => text.replace("|", "")

  /** The caret is written as `|`, which is how the tests below stay readable. */
  const enter = (written: string) => continued(said(written), at(written))

  test("gives the next bullet under a bullet", () => {
    expect(enter("- milk|")).toEqual({ put: "\n- ", drop: 0 })
  })

  test("gives the next number under a number, counting on", () => {
    expect(enter("1. first|")).toEqual({ put: "\n2. ", drop: 0 })
  })

  test("counts on from whatever number the line has, not from one", () => {
    expect(enter("7. seventh|")).toEqual({ put: "\n8. ", drop: 0 })
  })

  test("gives an unticked box under a task, ticked or not", () => {
    expect(enter("- [ ] wash up|")).toEqual({ put: "\n- [ ] ", drop: 0 })
    expect(enter("- [x] done that|")).toEqual({ put: "\n- [ ] ", drop: 0 })
  })

  test("keeps the indent, which is what makes a nested list stay nested", () => {
    expect(enter("  - under|")).toEqual({ put: "\n  - ", drop: 0 })
  })

  test("carries a quote on, one line being rarely the whole of one", () => {
    expect(enter("> they said|")).toEqual({ put: "\n> ", drop: 0 })
  })

  /*
   * The way out of a list, and the reason this cannot be "always add a bullet": pressing
   * Enter twice is how everybody leaves one, and a box that answered with a third bullet
   * would have to be fought.
   */
  test("takes the marker away on an empty one, which is how a list is left", () => {
    expect(enter("- milk\n- |")).toEqual({ put: "\n", drop: 2 })
    expect(enter("1. first\n2. |")).toEqual({ put: "\n", drop: 3 })
    expect(enter("- [ ] |")).toEqual({ put: "\n", drop: 6 })
  })

  test("does nothing under an ordinary line, which is most lines", () => {
    expect(enter("just a sentence|")).toBeUndefined()
    expect(enter("|")).toBeUndefined()
  })

  /*
   * A marker mid-line is not a list. "1. " after a word is a sentence with a number in it.
   */
  test("reads the line the caret is on, from its start", () => {
    expect(enter("see item 1. here|")).toBeUndefined()
  })
})

describe("indenting with Tab, which a plain textarea will not do", () => {
  /** The selection is written between `[` and `]`, or as `|` where there is none. */
  const marked = (written: string) => {
    const plain = written.replace(/[[\]|]/g, "")
    const open = written.indexOf("[")
    if (open === -1) {
      const at = written.indexOf("|")
      return { text: plain, from: at, to: at }
    }
    return { text: plain, from: open, to: written.indexOf("]") - 1 }
  }

  const tab = (written: string, outward = false) => {
    const { text, from, to } = marked(written)
    return indented(text, from, to, outward)
  }

  test("puts two spaces in where the caret sits in a line's own indent", () => {
    expect(tab("  |const a = 1")).toEqual({ text: "    const a = 1", from: 4, to: 4 })
  })

  test("puts two spaces in at the very start of a line", () => {
    expect(tab("|const a = 1")).toEqual({ text: "  const a = 1", from: 2, to: 2 })
  })

  /*
   * Tab is how a keyboard reader leaves a box, and a box that never gives it back is a
   * box they are stuck in. So it is only taken where it means indentation: in the
   * whitespace at the head of a line, or across a block of lines. Mid-sentence it goes
   * to the browser, which moves the focus as it always did.
   */
  test("leaves Tab alone in the middle of a line, so the reader can still get out", () => {
    expect(tab("const a = 1|")).toBeUndefined()
    expect(tab("const |a = 1")).toBeUndefined()
  })

  test("indents every line of a selection that spans more than one", () => {
    expect(tab("[one\ntwo\n]three")).toEqual({
      text: "  one\n  two\nthree",
      from: 0,
      to: 12
    })
  })

  test("takes two spaces off every line of a selection, going the other way", () => {
    expect(tab("[    one\n  two\n]three", true)).toEqual({
      text: "  one\ntwo\nthree",
      from: 0,
      to: 10
    })
  })

  test("takes off what indent there is where there are fewer than two spaces", () => {
    expect(tab("[ one\n]", true)).toEqual({ text: "one\n", from: 0, to: 4 })
  })

  test("takes two spaces off before the caret, going the other way", () => {
    expect(tab("    |const a = 1", true)).toEqual({ text: "  const a = 1", from: 2, to: 2 })
  })

  test("has nothing to take off a line with no indent", () => {
    expect(tab("|const a = 1", true)).toBeUndefined()
  })

  test("indents a selection inside one line as a block, rather than replacing it", () => {
    // Every editor replaces the selection with a tab here; a comment box is prose,
    // and the reader who selected a phrase and pressed Tab meant to move the line.
    expect(tab("  [const] a = 1")).toEqual({ text: "    const a = 1", from: 4, to: 9 })
  })
})

describe("pasting an address over words, which is how a link is written", () => {
  test("wraps what was chosen in the address that was pasted", () => {
    expect(linked("read the docs", 9, 13, "https://example.com/docs")).toBe(
      "read the [docs](https://example.com/docs)"
    )
  })

  test("leaves anything that is not an address alone", () => {
    expect(linked("read the docs", 9, 13, "over here")).toBeUndefined()
  })

  /*
   * Nothing chosen means nothing to name the link, so the address itself is what the
   * reader wants and the browser's own paste does it better than this can.
   */
  test("leaves a paste with nothing chosen to the browser", () => {
    expect(linked("read the docs", 13, 13, "https://example.com")).toBeUndefined()
  })

  test("leaves a paste over an address alone, two addresses being no link", () => {
    expect(linked("https://old.example", 0, 19, "https://new.example")).toBeUndefined()
  })
})
