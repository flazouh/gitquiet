import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { REPO_PULLS_VIEW } from "./repoPulls"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds
 * whatever every other file drew. Asking within this render is the difference between a
 * test that passes on its own and one that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{REPO_PULLS_VIEW.draw()}</Supplied>).container)

/** Every row of the list, told from the pull request each one links to. */
const rowsIn = (shot: ReturnType<typeof drawn>) =>
  shot
    .getAllByRole("link")
    .filter((link) => (link.getAttribute("href") ?? "").startsWith("/vercel/next.js/pull/"))

describe("the repository pull requests view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(REPO_PULLS_VIEW.name).toBe("repo-pulls")
    expect([REPO_PULLS_VIEW.width, REPO_PULLS_VIEW.height]).toEqual([1280, 800])
  })

  test("draws every row of the page it holds", async () => {
    const shot = drawn()
    await shot.findByText(/Allow suppressing TypeScript plugin diagnostics/)

    expect(rowsIn(shot).length).toBe(14)
  })

  /*
   * The split is the claim the picture makes. Two of two thousand want the reader and
   * the rest of the page is somebody else's, which is what a repository's list really
   * looks like to a person who does not maintain it. A mock that filed every row under
   * one heading would photograph a list rather than a grouping.
   */
  test("files the rows by what needs you", async () => {
    const shot = drawn()
    await shot.findByText(/Allow suppressing TypeScript plugin diagnostics/)

    const held = (court: string) =>
      rowsIn(within(shot.getByRole("region", { name: court }))).length

    expect(held("Needs You")).toBe(2)
    expect(held("Waiting")).toBe(12)
  })

  /*
   * The count and the safe-read limit, because the rows cannot say either. Fourteen rows
   * under a bar that says `vercel/next.js` and nothing else would be the most
   * misleading true thing this screen could draw.
   */
  test("says how much of the repository this cut list holds", async () => {
    const shot = drawn()
    await shot.findByText(/Allow suppressing TypeScript plugin diagnostics/)

    expect(shot.getByText(/14 of 2,136 pull requests/)).toBeTruthy()
  })

  /*
   * The whole reason this repository was chosen. Their own list gives the seven
   * `gc-*` branches seven unrelated rows, and each of them is really based on the one
   * below it, so a reader has no way of knowing from that page which one to read first.
   */
  test("folds the seven that stand on each other into one stack", async () => {
    const shot = drawn()
    await shot.findByText(/Allow suppressing TypeScript plugin diagnostics/)

    const stack = shot
      .getByText(/turbo-persistence: add key-value tombstones/)
      .closest("[data-stack]")
    if (!(stack instanceof HTMLElement)) throw new Error("No stack card in the view")
    expect(rowsIn(within(stack)).length).toBe(7)
  })

  test("draws the review the reader was asked for", async () => {
    const shot = drawn()
    await shot.findByText(/Allow suppressing TypeScript plugin diagnostics/)

    const yours = within(shot.getByRole("region", { name: "Needs You" }))
    expect(yours.getByText(/Use OIDC tokens to read private preview builds/)).toBeTruthy()
    expect(yours.getAllByText("83 of 100").length).toBe(2)
  })
})
