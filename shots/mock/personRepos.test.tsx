import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { PERSON_REPOS_VIEW } from "./personRepos"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`, for the reason
 * the repository home view's test gives: nothing clears the document between files.
 */
const drawn = () => within(render(<Supplied>{PERSON_REPOS_VIEW.draw()}</Supplied>).container)

describe("the person repositories view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(PERSON_REPOS_VIEW.name).toBe("person-repos")
    expect([PERSON_REPOS_VIEW.width, PERSON_REPOS_VIEW.height]).toEqual([1280, 800])
  })

  /*
   * Both halves of the page, because half of them was the complaint this screen answers:
   * their column beside a list of ours was one page in two type scales.
   */
  test("draws the column and the list from the same saved page", async () => {
    const shot = drawn()

    const column = within(await shot.findByLabelText("About flazouh"))
    expect(column.getByRole("heading", { name: "Alex" })).toBeTruthy()

    expect(await shot.findByRole("heading", { name: "Moving" })).toBeTruthy()
    expect(shot.getByRole("heading", { name: "Forked" })).toBeTruthy()
  })

  test("draws the face locally rather than fetching it from github.com", () => {
    const face = within(drawn().getByLabelText("About flazouh")).getByRole("presentation", {
      hidden: true
    })

    expect(face.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(true)
  })

  test("says the count is the first pages of a longer list", async () => {
    const shot = drawn()

    expect(await shot.findByText(/30 repositories, the first pages of a longer list/)).toBeTruthy()
  })
})
