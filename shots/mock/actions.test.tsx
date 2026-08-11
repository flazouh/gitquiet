import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { ACTIONS_VIEW } from "./actions"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds
 * whatever every other file drew. Asking within this render is the difference between a
 * test that passes on its own and one that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{ACTIONS_VIEW.draw()}</Supplied>).container)

/*
 * A row is told from a chip by the title the chip carries.
 *
 * Both are links to a run, because pressing either one goes to a run, so an href is no
 * help here. `Strands` gives every chip a title saying which workflow and which run it
 * stands for, and gives the row's own heading none.
 */
const rowsIn = (shot: ReturnType<typeof drawn>) =>
  shot
    .getAllByRole("link")
    .filter(
      (link) =>
        (link.getAttribute("href") ?? "").includes("/actions/runs/") &&
        link.getAttribute("title") === null
    )

describe("the actions view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(ACTIONS_VIEW.name).toBe("actions")
    expect([ACTIONS_VIEW.width, ACTIONS_VIEW.height]).toEqual([1280, 800])
  })

  /*
   * The two numbers are the argument. Thirty-four runs went in and eleven rows came out,
   * and a mock where the two were close would photograph a list with nothing to fold.
   */
  test("says how many runs the rows stand for", async () => {
    const shot = drawn()
    await shot.findByRole("region", { name: "Runs" })

    expect(shot.getByText("11 strands, from 34 runs")).toBeTruthy()
  })

  test("draws one row for each piece of work rather than one for each run", async () => {
    const shot = drawn()
    await shot.findByRole("region", { name: "Runs" })

    expect(rowsIn(shot).length).toBe(11)
  })

  test("names every workflow that ran against the head of a row", async () => {
    const shot = drawn()
    const listing = within(await shot.findByRole("region", { name: "Runs" }))

    expect(listing.getByRole("link", { name: "Decode streamed chunks with one decoder" }))
      .toBeTruthy()
    expect(listing.getAllByTitle(/^CI failure, run #/).length).toBeGreaterThan(0)
    expect(listing.getAllByTitle(/^CodeQL/).length).toBeGreaterThan(0)
  })

  /*
   * Both counts, because they count different things and the screen says so. An attempt
   * a re-run has answered for is superseded; a run against a commit the work has moved
   * past is on an earlier commit. A photograph with one of them in it would leave the
   * other looking like a rounding error.
   */
  test("counts the runs it does not draw", async () => {
    const shot = drawn()
    const listing = within(await shot.findByRole("region", { name: "Runs" }))

    expect(listing.getByText("1 superseded")).toBeTruthy()
    expect(listing.getAllByText(/on earlier commits$/).length).toBeGreaterThan(0)
  })

  test("leaves every row in the repository the bar names", async () => {
    const shot = drawn()
    const listing = within(await shot.findByRole("region", { name: "Runs" }))

    expect(listing.getByRole("link", { name: "#23014" }).getAttribute("href")).toBe(
      "/oven-sh/bun/pull/23014"
    )
  })
})
