import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { REPO_HOME_VIEW } from "./repoHome"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds
 * whatever every other file drew. Asking within this render is the difference between a
 * test that passes on its own and one that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{REPO_HOME_VIEW.draw()}</Supplied>).container)

describe("the repository home view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(REPO_HOME_VIEW.name).toBe("repo-home")
    expect([REPO_HOME_VIEW.width, REPO_HOME_VIEW.height]).toEqual([1280, 800])
  })

  /*
   * The README as prose and not as a link to it. Their own page gives a stranger a list
   * of dotfiles first, so a photograph that did not have the README's own words in it
   * would be a photograph of the page this screen replaces.
   */
  test("draws the README GitHub sent, rendered", async () => {
    const shot = drawn()

    expect(await shot.findByText(/all-in-one toolkit for JavaScript and TypeScript apps/))
      .toBeTruthy()
    expect(shot.getByRole("heading", { name: "Install" })).toBeTruthy()
  })

  test("says what the repository is and how many have starred it", async () => {
    const shot = drawn()

    expect(await shot.findByText(/Incredibly fast JavaScript runtime/)).toBeTruthy()
    expect(shot.getByText("80,412")).toBeTruthy()
  })

  /*
   * The card the capture waits for. It arrives on the second read rather than in the
   * payload the page already carries, which is why `REPO_HOME_VIEW.ready` names it.
   */
  test("draws the language bar the capture waits for", async () => {
    const shot = drawn()

    const tongues = within(await shot.findByLabelText("Languages"))
    expect(tongues.getByText("Zig")).toBeTruthy()
    expect(tongues.getByText("C++")).toBeTruthy()
  })

  test("draws the release and the people beside it", async () => {
    const shot = drawn()

    expect(await shot.findByText("bun-v1.3.15")).toBeTruthy()
    expect(shot.getByRole("img", { name: /Jon Halvorsen/ })).toBeTruthy()
  })
})
