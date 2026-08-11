import { afterEach, describe, expect, test } from "bun:test"
import { render, screen, within } from "@testing-library/react"
import { Effect, Option } from "effect"
import bare from "../../fixtures/github/repo-sidebar-bare.json"
import payload from "../../fixtures/github/repo-sidebar.json"
import type { Standing as Stands } from "../domain/repoHome"
import { decodeSidebar, standingFrom } from "../github/standing"
import { Languages, Standing } from "./Standing"

afterEach(() => {
  document.body.innerHTML = ""
})

const read = (given: unknown = payload): Stands =>
  standingFrom(Effect.runSync(decodeSidebar(given)))

const showing = (given: unknown = payload) => render(<Standing stands={read(given)} />)

const NOTHING: Stands = {
  hands: [],
  handCount: Option.none(),
  handsUrl: Option.none(),
  tongues: [],
  shipped: Option.none(),
  shippedUrl: Option.none(),
  landings: [],
  landingsUrl: Option.none(),
  leaning: Option.none(),
  leaningFaces: [],
  leaningUrl: Option.none(),
  parcels: Option.none(),
  parcelsUrl: Option.none()
}

describe("what a repository stands on, drawn", () => {
  test("shows the people as faces, named for anything that does not paint", () => {
    showing()

    const face = screen.getByAltText("Sebastian Markbåge")
    expect(face.getAttribute("src")?.startsWith("https://avatars.")).toBe(true)
    expect(screen.getByText("1,760 contributors")).toBeTruthy()
  })

  test("keeps the face row to a sample rather than the fourteen GitHub sends", () => {
    // Fourteen reads as a list that has been cut off. Eight and a count reads as
    // what it is, and does not wrap to a second row of nothing but faces.
    const { container } = showing()

    expect(container.querySelectorAll("img").length).toBe(8)
  })

  test("says what shipped last and where the builds went", () => {
    showing()

    expect(screen.getByText("19.2.8 (July 21st, 2026)")).toBeTruthy()
    expect(screen.getByText("8 environments")).toBeTruthy()
    expect(screen.getByText("30,052,750 using this")).toBeTruthy()
  })

  test("leaves out every section a repository has nothing in", () => {
    // A private repository with one author is one face, not five headings saying
    // it has no releases, no packages and no deployments.
    showing(bare)

    const row = screen.getByLabelText("Standing")
    expect(within(row).getByAltText("Alex")).toBeTruthy()
    expect(within(row).getByText("1 contributor")).toBeTruthy()
    expect(screen.queryByText(/environment/)).toBeNull()
    expect(screen.queryByText(/using this/)).toBeNull()
    expect(screen.queryByText(/package/)).toBeNull()
  })

  test("draws nothing at all while the read is in the air", () => {
    const { container } = render(<Standing stands={undefined} />)

    expect(container.querySelector("[aria-label='Standing']")).toBeNull()
  })

  test("draws nothing for a repository that has none of any of it", () => {
    render(<Standing stands={NOTHING} />)

    expect(screen.queryByLabelText("Standing")).toBeNull()
  })
})

describe("what a repository is written in, drawn", () => {
  test("draws the bar in GitHub's own colours", () => {
    render(<Languages stands={read()} />)

    const card = screen.getByLabelText("Languages")
    const first = card.querySelector("span") as HTMLElement

    expect(first.style.width).toBe("49.5%")
    expect(first.style.background).toBe("#f1e05a")
  })

  test("names every language under the bar, which is what makes the bar mean something", () => {
    // Its own card now, so there is room for the legend the strip needs. Squeezed
    // onto the row above, it was sixty-four pixels wide and named one language.
    render(<Languages stands={read()} />)

    const card = within(screen.getByLabelText("Languages"))
    expect(card.getByText("JavaScript")).toBeTruthy()
    expect(card.getByText("49.5%")).toBeTruthy()
    expect(card.getByText("TypeScript")).toBeTruthy()
  })

  test("draws no card at all for a repository with no languages", () => {
    render(<Languages stands={NOTHING} />)

    expect(screen.queryByLabelText("Languages")).toBeNull()
  })

  test("draws no card while the read is in the air", () => {
    render(<Languages stands={undefined} />)

    expect(screen.queryByLabelText("Languages")).toBeNull()
  })
})
