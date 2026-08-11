import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { ISSUES_VIEW } from "./issues"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds
 * whatever every other file drew. Asking within this render is the difference between a
 * test that passes on its own and one that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{ISSUES_VIEW.draw()}</Supplied>).container)

describe("the issues view", () => {
  test("draws a row for every issue, which is what fills the frame", async () => {
    const shot = drawn()

    const rows = await shot.findAllByRole("link", { name: /Issue / })
    expect(rows.length).toBe(22)
  })

  test("draws real issues from real repositories", async () => {
    const shot = drawn()
    await shot.findAllByRole("link", { name: /Issue / })

    expect(shot.getByText(/Optimistic routes wrongly predicts rewritten pages/)).toBeTruthy()
    expect(shot.getByText(/Bun silently drops writes/)).toBeTruthy()
  })

  test("names the repository on every row, because they come from everywhere", async () => {
    const shot = drawn()

    const rows = await shot.findAllByRole("link", { name: /Issue / })
    const named = rows.map((row) => row.getAttribute("href"))

    expect(named).toContain("/vercel/next.js/issues/96893")
    expect(named).toContain("/microsoft/vscode/issues/329713")
    expect(named).toContain("/react/react/issues/37243")
    expect(named).toContain("/oven-sh/bun/issues/37151")
  })

  test("says which of GitHub's three tabs this is", async () => {
    const shot = drawn()
    await shot.findAllByRole("link", { name: /Issue / })

    expect(shot.getByRole("tab", { name: "Assigned" }).getAttribute("aria-selected")).toBe("true")
  })
})
