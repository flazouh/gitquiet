import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { PULL_REQUEST_VIEW } from "./pullRequest"

afterEach(cleanup)

/*
 * The view writes an unsent remark into storage as it is drawn, and that is one of
 * the things being checked here, so the storage starts empty and is left empty.
 */
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const drawn = () => render(<Supplied chosen={PULL_REQUEST_VIEW.chosen}>{PULL_REQUEST_VIEW.draw()}</Supplied>)

/**
 * What the store listing has to show, asserted as text rather than as pixels.
 *
 * A view that typechecks and renders nothing is the failure worth catching: the props
 * are the whole of the coupling between a mock and a screen, and every one of them is
 * optional somewhere. So each test names something a reader would see in the
 * photograph and fails if the picture would be missing it.
 */
describe("the pull request view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(PULL_REQUEST_VIEW.name).toBe("pull-request")
    expect([PULL_REQUEST_VIEW.width, PULL_REQUEST_VIEW.height]).toEqual([1280, 800])
  })

  test("draws the pull request GitHub is being replaced for", async () => {
    drawn()

    expect(
      await screen.findByText(/Keep a keep-alive socket open when a streaming response aborts/)
    ).toBeDefined()
    expect(screen.getByText("serve-abort-mid-chunk")).toBeDefined()
  })

  test("files what is owed by Court, which is the argument the picture makes", async () => {
    drawn()

    await screen.findByText("What is owed")

    /*
     * Read as the headings rather than as their lists, because Settled is folded when
     * the panel opens and so has a heading and no list. All four are worth naming: a
     * mock that filled one Court would photograph as a list, not as a grouping.
     */
    for (const court of ["Needs You", "Waiting", "Running", "Settled"]) {
      expect(screen.getByRole("heading", { level: 3, name: new RegExp(court) })).toBeDefined()
    }
  })

  test("puts the failing check in the reader's own Court", async () => {
    drawn()

    const yours = await screen.findByRole("list", { name: "Needs You" })
    expect(within(yours).getByText("linux-x64 / test")).toBeDefined()
    expect(within(yours).getByText("3 failing tests in test/js/bun/http")).toBeDefined()
  })

  test("names a Bot Finding as a finding rather than as a comment", async () => {
    drawn()

    const yours = await screen.findByRole("list", { name: "Needs You" })
    expect(within(yours).getAllByText("finding").length).toBeGreaterThan(0)
  })

  test("counts what landed since the reader last reviewed", async () => {
    drawn()

    const yours = await screen.findByRole("list", { name: "Needs You" })
    expect(within(yours).getByText("since you last reviewed")).toBeDefined()
    expect(within(yours).getByText("3 commits")).toBeDefined()
  })

  test("opens the box on the remark that was written and not sent", async () => {
    drawn()

    // The words themselves, in the box, rather than a button offering to reopen it.
    expect(await screen.findByDisplayValue(/is the HEAD case dperrault asked about/)).toBeDefined()
  })

  test("shows the files with the code in them, not a count of files", async () => {
    drawn()

    const files = await screen.findByRole("region", { name: "Files" })
    expect(within(files).getByText(/7 changed/)).toBeDefined()
    expect(within(files).getByLabelText("Open file").textContent).toContain("server.zig")
  })

  test("has the merge card saying what is holding it up", async () => {
    drawn()

    await waitFor(() => expect(screen.getByText("Required checks must pass")).toBeDefined())
  })
})
