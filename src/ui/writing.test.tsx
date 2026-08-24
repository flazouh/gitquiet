import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect } from "effect"
import { useState } from "react"
import type { Suggesting } from "../domain/suggesting"
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
const Box = ({
  offering = suggest
}: {
  readonly offering?: () => Effect.Effect<Suggesting, unknown>
}) => {
  const [text, setText] = useState("")
  return (
    <Writing
      text={text}
      onText={setText}
      placeholder="Answer this"
      onEscape={() => {}}
      onSend={() => {}}
      suggest={offering}
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

  /*
   * The read the box makes when it opens can land during a bad moment — a rate limit, a
   * dropped connection. Caching that failure meant a box that offered nobody for as long
   * as it stood, silently; asking again when the sign is typed is what GitHub's own box
   * does, and it is the difference Alex saw between two boxes on one page.
   */
  test("asks again when the first read failed and an at sign wants it", async () => {
    let asks = 0
    const flaky = () => {
      asks += 1
      return asks === 1 ? Effect.fail("a bad moment") : suggest()
    }
    render(<Box offering={flaky} />)

    await userEvent.type(screen.getByRole("textbox"), "@")

    expect(await screen.findAllByRole("option")).toHaveLength(2)
    expect(asks).toBe(2)
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
