import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { ISSUE_VIEW } from "./issue"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds
 * whatever every other file drew. Asking within this render is the difference between a
 * test that passes on its own and one that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{ISSUE_VIEW.draw()}</Supplied>).container)

describe("the issue view", () => {
  test("draws the issue it says it draws", async () => {
    const shot = drawn()

    expect(await shot.findByText(/blocks Local Network access/)).toBeTruthy()
    expect(shot.getByText("#328399")).toBeTruthy()
  })

  test("draws the body, which is the half of this picture that is not layout", async () => {
    const shot = drawn()
    await shot.findByText(/blocks Local Network access/)

    expect(shot.getByText(/Downgrade to VS Code 1.130/)).toBeTruthy()
  })

  test("names the labels the repository actually put on it", async () => {
    const shot = drawn()
    await shot.findByText(/blocks Local Network access/)

    for (const name of ["bug", "info-needed", "macos", "regression"]) {
      expect(shot.getByText(name)).toBeTruthy()
    }
  })

  test("draws what everybody said, which is what fills the frame", async () => {
    const shot = drawn()
    await shot.findByText(/blocks Local Network access/)

    // Each of them twice: once as the folded line that summarises it, once as the
    // comment itself inside the fold. Several people rather than one, because a page
    // with one comment on it says nothing about reading a week-old argument.
    expect(shot.getAllByText(/Downgraded to 1.129/).length).toBeGreaterThan(0)
    expect(shot.getAllByText(/unable to repro on my machine/).length).toBeGreaterThan(0)
  })

  test("offers the box to write in, signed by the reader", async () => {
    const shot = drawn()
    await shot.findByText(/blocks Local Network access/)

    expect(shot.getByRole("button", { name: "Say something about this issue" })).toBeTruthy()
  })
})
