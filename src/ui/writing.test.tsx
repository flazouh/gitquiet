import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect } from "effect"
import { useState } from "react"
import { Writing } from "./Writing"

afterEach(cleanup)

const suggest = () =>
  Effect.succeed({
    people: [
      { login: "flazouh", name: "Alex" },
      { login: "flowline-bot", name: "Flowline" }
    ],
    numbered: []
  })

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
      suggest={suggest}
    />
  )
}

/*
 * The chrome around the words: the toolbar the keyboard walks, and what the field says
 * about the offer under the caret. Neither is decoration — the first is what Tab costs a
 * keyboard reader on the way to the send button, the second is the difference between a
 * list a screen reader announces and a silence with arrows in it.
 */
describe("the toolbar", () => {
  test("is one stop, walked with arrows rather than tabbed through", async () => {
    render(<Box />)

    const bold = screen.getByRole("button", { name: "Bold" })
    const italic = screen.getByRole("button", { name: "Italic" })
    expect(bold.tabIndex).toBe(0)
    expect(italic.tabIndex).toBe(-1)

    bold.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(italic)

    // Where the reader left is where Tab comes back in.
    expect(italic.tabIndex).toBe(0)
    expect(bold.tabIndex).toBe(-1)
  })
})

describe("saying the offer out loud", () => {
  test("the field names the option that is up, and follows the arrows", async () => {
    render(<Box />)
    const field = screen.getByRole("textbox")
    await userEvent.type(field, "@")

    const offered = await screen.findAllByRole("option")
    expect(field.getAttribute("aria-expanded")).toBe("true")
    expect(field.getAttribute("aria-activedescendant")).toBe(offered[0]!.id)

    await userEvent.keyboard("{ArrowDown}")
    expect(field.getAttribute("aria-activedescendant")).toBe(offered[1]!.id)
  })

  test("a field nobody is in offers nothing", async () => {
    render(<Box />)
    const field = screen.getByRole("textbox")
    await userEvent.type(field, "@")
    await screen.findAllByRole("option")

    await userEvent.tab()

    expect(screen.queryByRole("option")).toBeNull()
    expect(field.getAttribute("aria-expanded")).toBe("false")
  })
})
