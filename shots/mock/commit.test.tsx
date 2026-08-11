import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { COMMIT_VIEW } from "./commit"

afterEach(cleanup)

const drawn = () => render(<Supplied chosen={COMMIT_VIEW.chosen}>{COMMIT_VIEW.draw()}</Supplied>)

/**
 * What the store listing has to show, asserted as text rather than as pixels.
 *
 * The props are the whole of the coupling between a mock and a screen, and a screen
 * given none of them still typechecks and still renders, empty. So each test names
 * something a reader would see in the photograph.
 */
describe("the commit view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(COMMIT_VIEW.name).toBe("commit")
    expect([COMMIT_VIEW.width, COMMIT_VIEW.height]).toEqual([1280, 800])
  })

  test("draws the commit, its author and its short sha", async () => {
    drawn()

    expect(await screen.findByText(/Hide portals nested under an element inside/)).toBeDefined()
    // The author is a face rather than a name, and the face carries the login.
    expect(screen.getByRole("img", { name: "s-almeida" })).toBeDefined()
    expect(screen.getByText("b1f6d4a")).toBeDefined()
  })

  test("keeps the message under the headline, which is the reason for the page", async () => {
    drawn()

    expect(await screen.findByText(/The container is the boundary|the container is the boundary/)).toBeDefined()
  })

  /*
   * The tree is a virtualised widget and draws no rows in a host with no height,
   * which is a fact about this test environment rather than about the view. See the
   * same note in `src/ui/fileBrowser.test.tsx`. What can be checked is that the panel
   * was handed the files and opened on one, which is where the rows come from.
   */
  test("opens on the file the commit is about, with the whole set counted", async () => {
    drawn()

    const files = await screen.findByRole("region", { name: "Files" })
    expect(within(files).getByText(/6 changed/)).toBeDefined()
    await waitFor(() =>
      expect(within(files).getByLabelText("Open file").textContent).toContain(
        "ReactFiberConfigDOM.js"
      )
    )
  })
})
