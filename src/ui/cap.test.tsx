import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Cap } from "./Cap"

afterEach(cleanup)

const caps = () => [...document.querySelectorAll("kbd")]

describe("a key, drawn as one", () => {
  test("says no border rather than merely omitting one", () => {
    /*
     * Omitting a border is not the same as not having one. On a pull request page
     * Primer dresses the `kbd` element itself — a fill, a one pixel border, a six
     * pixel corner and an inset shadow along the bottom — so a cap that only said
     * what it wanted inherited the rest, and a `kbd` holding a `kbd` inherited it
     * twice. That was the box around the box on GitHub's page while the same
     * component looked right in the app's own window.
     */
    render(<Cap chord="c" />)

    for (const cap of caps()) {
      expect(cap.className).toContain("border-0")
      expect(cap.className).toContain("shadow-none")
      expect(cap.className).not.toContain("border-line")
    }
  })

  test("states the padding as well, which is the property that gave it away", () => {
    /*
     * Their rule is `padding: 3px 5px`, and a cap that only said `px-1` kept their
     * three pixels on the top and bottom: an eighteen pixel key rendering
     * twenty-four tall, which is why it looked like a different component on the
     * page than in the window. Every side is stated now.
     */
    render(<Cap chord="c" />)

    const cap = screen.getByText("c")

    expect(cap.className).toContain("px-1")
    expect(cap.className).toContain("pt-0")
    expect(cap.className).toContain("pb-px")
    expect(cap.className).toContain("h-4.5")
  })

  test("leaves the chord itself undressed, so a sequence is not a cap of caps", () => {
    render(<Cap chord="g d" />)

    const [chord] = caps()
    if (chord === undefined) throw new Error("expected the chord")
    // The fill and the padding are stated as nothing, which is what keeps a host
    // stylesheet from drawing a third key around the two real ones.
    expect(chord.className).toContain("bg-transparent")
    expect(chord.className).toContain("p-0")
  })

  test("is a fill and a corner instead, from the tokens every pack answers", () => {
    render(<Cap chord="c" />)

    const cap = screen.getByText("c")

    // The tint the packs already use for a control, so this follows a reader into
    // dark, dimmed and high contrast without naming a colour.
    expect(cap.className).toContain("bg-hover")
    // Four pixels flat: `rounded-sm` is three on GitHub's page and six in the
    // window, and a key that changes shape between the two shells is two keys.
    expect(cap.className).toContain("rounded-[4px]")
  })

  test("says Esc, which is what the key on the board says", () => {
    render(<Cap chord="Escape" />)

    expect(screen.getByText("Esc")).toBeDefined()
  })

  test("draws a sequence as the two presses it is", () => {
    // `g d` is two keys typed one after the other, and one cap saying "g d" reads
    // as a key with a space on it. Two caps read as what the reader has to do.
    render(<Cap chord="g d" />)

    expect(caps().map((cap) => cap.textContent)).toEqual(["gd", "g", "d"])
    expect(screen.getByText("g")).toBeDefined()
    expect(screen.getByText("d")).toBeDefined()
  })

  test("groups the keys of one press, and spaces the presses apart", () => {
    /*
     * The two things a chord can mean, told apart by the gap alone. `⌘K` is one
     * reach of one hand and used to be a single cap with a glyph and a letter
     * crammed onto it; `g d` is a key and then a key. Tight means together, loose
     * means then, which is the whole grammar this component has.
     */
    const held = render(<Cap chord="⌘K" />)
    const chord = held.container.querySelector("kbd")
    if (chord === null) throw new Error("expected the chord")

    // The group sits inside the chord and holds a cap per key.
    const group = chord.querySelector("kbd")
    if (group === null) throw new Error("expected the group")
    expect(group.querySelectorAll("kbd")).toHaveLength(2)
    expect(group.className).toContain("gap-0.5")
    expect(chord.className).toContain("gap-1.5")
    // The modifier is drawn rather than typed, so the letter beside it keeps the
    // weight of the ink around it.
    expect(screen.getByText("K")).toBeDefined()
    expect(held.container.querySelector("svg")).not.toBeNull()

    held.unmount()

    // A press of one key is that key: no group, because there is nothing to group.
    const one = render(<Cap chord="j" />)
    const alone = one.container.querySelector("kbd")
    if (alone === null) throw new Error("expected the chord")
    expect(alone.querySelectorAll("kbd")).toHaveLength(1)
  })

  test("knows the modifiers by the symbols printed on them", () => {
    // A chord that gains a shift should not need this component reopened.
    render(<Cap chord="⇧⌥p" />)

    expect(screen.getByText("⇧")).toBeDefined()
    expect(screen.getByText("⌥")).toBeDefined()
    expect(screen.getByText("p")).toBeDefined()
  })

  test("holds the same shape whether the key is one letter or three", () => {
    // A row of caps down a help sheet is a column of shapes before it is words,
    // and a 12-pixel `m` beside a 30-pixel `Esc` reads as two kinds of thing.
    render(<Cap chord="m" />)
    const letter = screen.getByText("m").className

    expect(letter).toContain("min-w-")
    expect(letter).toContain("justify-center")
  })

  test("darkens what is under it when it sits on a filled button", () => {
    // On emphasis a bordered cap would have to draw its own edge in a colour that
    // is not in any pack. A shadow of the fill itself reads as an inset key.
    render(<Cap chord="n" tone="onEmphasis" />)

    expect(screen.getByText("n").className).toContain("bg-black/20")
  })
})
