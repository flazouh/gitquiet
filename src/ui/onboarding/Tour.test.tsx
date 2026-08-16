import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BEATS } from "./beats"
import { Tour } from "./Tour"

// `screen` reads the whole document, and every test file in a run shares one.
afterEach(cleanup)

const ENDING = {
  title: "Ready when you are.",
  says: ["Sign in and this window fills with your own pull requests."],
  act: <button type="button">Sign in with GitHub</button>
}

/** What each host does with a named screen, said here as the name of the screen. */
const show = (shot: string) => <div data-testid="shot">{shot}</div>

const tour = () => render(<Tour show={show} ending={ENDING} />)

const last = BEATS.length + 1

describe("the onboarding", () => {
  test("opens on the first beat and says how many there are", () => {
    tour()

    expect(screen.getByText(BEATS[0]!.title)).toBeTruthy()
    expect(screen.getByText(`1 of ${last}`)).toBeTruthy()
  })

  test("draws the screen each beat is about, and none where a beat has no screen", async () => {
    const second = BEATS[1]?.shot
    if (second === undefined) throw new Error("the second beat is the one that shows a screen")

    tour()

    // The first beat is the words: nothing of the product is on screen yet to point at.
    expect(screen.queryByTestId("shot")).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(screen.getByTestId("shot").textContent).toBe(second)
  })

  test("names the four Courts on the beat that is about them, in the list's own words", async () => {
    tour()
    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    // The words a reader is taught here are the words the list's own headings use.
    expect(screen.getByText("Your Move")).toBeTruthy()
    expect(screen.getByText("You can act on it now.")).toBeTruthy()
    expect(screen.getByText("Settled")).toBeTruthy()
  })

  test("goes back, which is the whole reason Back is there", async () => {
    tour()

    // Nothing to go back to on the first beat, so nothing offers to.
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await userEvent.click(screen.getByRole("button", { name: "Back" }))

    expect(screen.getByText(`1 of ${last}`)).toBeTruthy()
  })

  /*
   * Skipping is going to the end rather than closing anything. A reader who opened
   * the app to sign in should reach the sign-in in one press, and the end is where it
   * is — so a Skip that hid the tour would hide the button they were skipping to.
   */
  test("skips to the last beat, which is the host's, rather than out of the tour", async () => {
    tour()
    await userEvent.click(screen.getByRole("button", { name: "Skip" }))

    expect(screen.getByText(ENDING.title)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeTruthy()
  })

  test("offers nothing to skip or press next on the last beat, where both would say the same", async () => {
    tour()
    await userEvent.click(screen.getByRole("button", { name: "Skip" }))

    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
  })

  test("goes to a beat by its dot, so the second one is one press away from the fourth", async () => {
    tour()

    const dots = screen.getAllByRole("button", { name: BEATS[1]!.title })
    await userEvent.click(dots[0]!)

    expect(screen.getByText(`2 of ${last}`)).toBeTruthy()
  })

  test("walks on the arrow keys, and stops at both ends rather than counting past them", async () => {
    tour()

    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByText(`2 of ${last}`)).toBeTruthy()

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}")
    expect(screen.getByText(`1 of ${last}`)).toBeTruthy()

    await userEvent.keyboard("{ArrowRight}".repeat(last + 3))
    expect(screen.getByText(`${last} of ${last}`)).toBeTruthy()
    expect(screen.getByText(ENDING.title)).toBeTruthy()
  })
})

describe("what the onboarding says", () => {
  /*
   * Four beats and no more, and the reason is the reader rather than the layout: this
   * is read by somebody who has just installed something and wants to get on with
   * their work. A fifth beat is a beat that should have been two products.
   */
  test("is four beats, each of one or two sentences", () => {
    expect(BEATS).toHaveLength(4)

    for (const beat of BEATS) {
      expect(beat.says.length).toBeGreaterThan(0)
      expect(beat.says.length).toBeLessThanOrEqual(2)
    }
  })

  test("names the Courts once, because a thing explained twice reads as two things", () => {
    expect(BEATS.filter((beat) => beat.courts === true)).toHaveLength(1)
  })
})
