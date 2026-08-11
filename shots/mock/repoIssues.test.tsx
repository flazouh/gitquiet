import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { REPO_ISSUES_VIEW } from "./repoIssues"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds
 * whatever every other file drew. Asking within this render is the difference between a
 * test that passes on its own and one that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{REPO_ISSUES_VIEW.draw()}</Supplied>).container)

describe("the repository issues view", () => {
  test("draws a whole page of them, which is what fills the frame", async () => {
    const shot = drawn()

    const rows = await shot.findAllByRole("link", { name: /Issue #/ })
    expect(rows.length).toBe(25)
  })

  test("draws real issues from the repository it names", async () => {
    const shot = drawn()

    const rows = await shot.findAllByRole("link", { name: /Issue #/ })
    expect(rows[0]?.getAttribute("href")).toBe("/oven-sh/bun/issues/37161")
    expect(shot.getByText(/Test failure handler/)).toBeTruthy()
  })

  test("says how many there are, which the rows cannot", async () => {
    const shot = drawn()
    await shot.findAllByRole("link", { name: /Issue #/ })

    expect(shot.getByText(/3,835 issues/)).toBeTruthy()
    expect(shot.getByText(/page 1 of 154/)).toBeTruthy()
  })

  test("offers the way to raise one", async () => {
    const shot = drawn()
    await shot.findAllByRole("link", { name: /Issue #/ })

    expect(shot.getByRole("link", { name: "New issue" }).getAttribute("href")).toBe(
      "/oven-sh/bun/issues/new"
    )
  })
})
