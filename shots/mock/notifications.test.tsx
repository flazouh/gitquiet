import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { NOTICES, NOTIFICATIONS_VIEW } from "./notifications"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds whatever
 * every other file drew. Asking within this render is the difference between a test that
 * passes on its own and one that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{NOTIFICATIONS_VIEW.draw()}</Supplied>).container)

const courtIn = async (shot: ReturnType<typeof drawn>, name: string) =>
  within(await shot.findByRole("region", { name }))

describe("the notifications view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(NOTIFICATIONS_VIEW.name).toBe("notifications")
    expect([NOTIFICATIONS_VIEW.width, NOTIFICATIONS_VIEW.height]).toEqual([1280, 800])
  })

  /*
   * The proportion is the argument. A picture where two rows were finished and ten were work
   * would photograph an inbox nobody has, and it is the other way round on a real one: 41 rows
   * of 51 measured concerned something already merged or closed.
   */
  test("photographs an inbox that is mostly finished work", async () => {
    const shot = drawn()
    const settled = await courtIn(shot, "Settled")

    expect(settled.getAllByRole("listitem").length).toBeGreaterThan(NOTICES.length / 2)
  })

  test("keeps Your Move small enough to read in one look", async () => {
    const shot = drawn()
    const yours = await courtIn(shot, "Your Move")

    expect(yours.getAllByRole("listitem")).toHaveLength(2)
  })

  /*
   * The row the screen exists for: a review was asked for, the pull request was merged
   * without the reader, and GitHub's own inbox still draws it as work.
   */
  test("puts a review request on a merged pull request in Settled", async () => {
    const shot = drawn()
    const settled = await courtIn(shot, "Settled")

    expect(
      settled.getByRole("link", { name: "Support import attributes in the CommonJS output" })
    ).toBeTruthy()
  })

  test("marks the machine in a thread without claiming it opened anything", async () => {
    const shot = drawn()
    await courtIn(shot, "Waiting")

    expect(shot.getByTitle("dependabot, a machine")).toBeTruthy()
  })

  /*
   * Drawn empty, and that is the finding. A Notice exists because a machine has finished, so
   * nothing on this page can honestly be filed under Running.
   */
  test("draws Running with nothing in it", async () => {
    const shot = drawn()
    const running = await courtIn(shot, "Running")

    expect(running.queryAllByRole("listitem")).toHaveLength(0)
  })

  test("offers the presses GitHub puts on the row, and never Save", async () => {
    const shot = drawn()
    const yours = await courtIn(shot, "Your Move")
    const first = yours.getAllByRole("listitem")[0]
    if (first === undefined) throw new Error("no rows")

    const row = within(first)
    expect(row.getByRole("button", { name: "Done" })).toBeTruthy()
    expect(row.getByRole("button", { name: "Mark read" })).toBeTruthy()
    expect(row.getByRole("button", { name: "Unsubscribe" })).toBeTruthy()
    expect(row.queryByRole("button", { name: /Save/ })).toBeNull()
  })
})
