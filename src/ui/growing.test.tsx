import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { Writing } from "./Writing"

afterEach(cleanup)

/** The box as any screen holds it: its words in state, everything else quiet. */
const Box = () => {
  const [text, setText] = useState("")
  return (
    <Writing
      text={text}
      onText={setText}
      placeholder="Answer this"
      onEscape={() => {}}
      onSend={() => {}}
    />
  )
}

describe("growing with what is written", () => {
  // The counter's shadow over the prototype, taken off again whichever way the test ends.
  afterEach(() => {
    // biome-ignore lint/performance/noDelete: restoring the prototype is the point
    delete (HTMLTextAreaElement.prototype as { scrollHeight?: unknown }).scrollHeight
  })

  /*
   * The box used to find its height by measuring itself: height to `auto`, read
   * `scrollHeight` back, write the pixels in. Each read is a forced synchronous layout
   * of the whole document, twice a keystroke, and on a pull request with a long
   * conversation that is the box being laggy to type in. The height comes from CSS now,
   * so a keystroke is a keystroke.
   */
  test("typing measures nothing, which is what kept the box from being laggy", async () => {
    let reads = 0
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        reads += 1
        return 0
      }
    })

    render(<Box />)
    await userEvent.type(screen.getByRole("textbox"), "a paragraph, one key at a time")

    expect(reads).toBe(0)
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).style.height).toBe("")
  })

  /*
   * What sizes the box is a mirror standing behind it with the same words in the same
   * metrics. The words have to actually be there: a mirror that fell out of step is a box
   * back to clipping its last line.
   */
  test("what is typed stands behind the box, so the box is as tall as it", async () => {
    render(<Box />)
    await userEvent.type(screen.getByRole("textbox"), "two lines\nof answer")

    const field = screen.getByRole("textbox") as HTMLTextAreaElement
    expect(field.value).toBe("two lines\nof answer")

    // The trailing space is load-bearing: it is what gives a line just opened with
    // Enter its height before anything is typed on it.
    const mirror = [...document.querySelectorAll("div")].find(
      (one) => one.childElementCount === 0 && one.textContent === "two lines\nof answer "
    )
    expect(mirror).toBeDefined()
  })
})
