import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { Menu } from "./Menu"

// `screen` reads the whole document, and every test file in a run shares one: a menu left
// standing here is a second menu the next test finds.
afterEach(cleanup)

const ROWS = [{ name: "Your profile", where: "/flazouh" }, { name: "Sign out", where: "/logout" }]

/** A menu with the button that opens it, which is how every menu in this interface is used. */
const Opened = () => {
  const [open, setOpen] = useState(true)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}>
        Account
      </button>
      <Menu name="Account" open={open} onShut={() => setOpen(false)} rows={ROWS} />
    </div>
  )
}

describe("what a row says", () => {
  test("draws the glyph it carries, so a menu is not a column of bare words", () => {
    render(
      <Menu
        name="This repository"
        open
        onShut={() => undefined}
        rows={[{ name: "Settings", where: "/settings", art: "settings" }]}
      />
    )

    const row = screen.getByRole("menuitem", { name: "Settings" })
    expect(row.querySelector("svg")).not.toBeNull()
  })
})

describe("shutting a menu", () => {
  test("goes on Escape, and goes at once rather than fading for a sixth of a second", async () => {
    // A dismissal by key is the reader saying they are done: the 150ms the pointer path spends
    // travelling out is, on the keyboard, a menu that hangs about after the key that killed it.
    render(<Opened />)
    expect(screen.getByRole("menu")).toBeDefined()

    await userEvent.keyboard("{Escape}")

    expect(screen.queryByRole("menu")).toBeNull()
    expect(screen.queryByText("Sign out")).toBeNull()
  })

  test("still leaves slowly for a press outside, which is a pointer travelling away", () => {
    render(<Opened />)

    /*
     * Fired rather than acted out, and nothing awaited after it. What is being asked about
     * lasts 150ms, and every await between the press and the question is a turn of the loop
     * in which that can finish: on a machine running the whole suite it did, and the test
     * failed asking a menu that had already gone whether it was still going. Fired this way,
     * the press and both questions are one turn, and the close cannot land inside it.
     */
    fireEvent.pointerDown(document.body)

    // Gone as a menu, but still on the page for the length of its own close.
    expect(screen.queryByRole("menu")).toBeNull()
    expect(screen.getByText("Sign out")).toBeDefined()
  })
})
