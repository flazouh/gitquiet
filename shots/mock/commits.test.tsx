import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { COMMITS_VIEW, HISTORY } from "./commits"

afterEach(cleanup)

const drawn = () => render(<Supplied chosen={COMMITS_VIEW.chosen}>{COMMITS_VIEW.draw()}</Supplied>)

/**
 * What the store listing has to show, asserted as text rather than as pixels.
 *
 * The props are the whole of the coupling between a mock and a screen, and a screen
 * given none of them still typechecks and still renders, empty. So each test names
 * something a reader would see in the photograph.
 */
describe("the commits view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(COMMITS_VIEW.name).toBe("commits")
    expect([COMMITS_VIEW.width, COMMITS_VIEW.height]).toEqual([1280, 800])
  })

  test("draws every commit of the branch, which is what fills the frame", async () => {
    drawn()

    await screen.findByText(/Debounce the explorer's file watcher on very large workspaces/)
    expect(screen.getByText(/Fix quick pick keeping focus after the widget is disposed/)).toBeDefined()
    expect(screen.getByText(/Give the comment thread widget its own scroll/)).toBeDefined()
    expect(screen.getAllByRole("listitem").length).toBe(18)
  })

  test("groups them by day, under the heading GitHub writes", async () => {
    drawn()

    // Formatted from the commits rather than typed in, so this checks the format
    // their own reader produces and not a date that would go stale. See `dayOf`.
    for (const day of HISTORY.days) {
      expect(await screen.findByRole("heading", { level: 2, name: day.title })).toBeDefined()
      expect(day.title).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/)
    }
  })

  test("says how much each commit moved, which their own list leaves out", async () => {
    drawn()

    const said = await screen.findByText(/Debounce the explorer's file watcher/)
    const row = said.closest("li")
    if (row === null) throw new Error("the headline is not in a row")

    expect(within(row).getByText("9 files")).toBeDefined()
    expect(within(row).getByLabelText("274 added, 91 removed")).toBeDefined()
  })

  test("marks the commit whose checks failed and the one still running", async () => {
    drawn()

    expect(await screen.findByLabelText("22 / 24 checks OK")).toBeDefined()
    expect(screen.getByLabelText("18 / 24 checks running")).toBeDefined()
  })

  test("reads the pull request number out of the message rather than beside it", async () => {
    drawn()

    // `proposalIn` finds it in the headline, so a row cannot claim a number the
    // sentence above it does not carry.
    expect(await screen.findByRole("link", { name: "#327442" })).toBeDefined()
  })
})
