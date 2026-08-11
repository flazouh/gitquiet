import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, within } from "@testing-library/react"
import { Owner } from "./Owner"

afterEach(cleanup)

const drawn = (owner: string) => within(render(<Owner owner={owner} />).container)

describe("whose repository it is", () => {
  test("is their picture, asked for by name rather than looked up", () => {
    const image = drawn("octo-org").getByRole("img").querySelector("img")

    expect(image?.getAttribute("src")).toBe("https://github.com/octo-org.png?size=28")
  })

  test("is labelled, so a face in a row is not a picture nobody can name", () => {
    expect(drawn("flowline-labs").getByLabelText("flowline-labs")).toBeTruthy()
  })

  /*
   * An owner GitHub has no picture for — renamed, deleted, or one of the accounts
   * their redirect does not answer for. A letter in the same square is a row that
   * still lines up; a broken image is a row that looks like a fault.
   */
  test("falls back to the initial rather than to a broken image", () => {
    const box = drawn("citrolabs")
    fireEvent.error(box.getByRole("img").querySelector("img")!)

    // Lowercase in the markup: the capital is the stylesheet's doing, and asserting
    // on what CSS renders would be asserting on a browser rather than on this.
    expect(box.getByRole("img").textContent).toBe("c")
    expect(box.getByRole("img").querySelector("img")).toBeNull()
  })
})
