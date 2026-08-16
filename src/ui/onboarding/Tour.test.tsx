import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { COURT_NAME } from "../courts"
import { BEATS } from "./beats"
import { Tour } from "./Tour"

// `screen` reads the whole document, and every test file in a run shares one.
afterEach(cleanup)

const ENDING = {
  title: "Ready when you are.",
  says: ["Your token stays in the macOS keychain."],
  act: <button type="button">Sign in with GitHub</button>
}

/** What each host does with a named screen, said here as the name of the screen. */
const show = (shot: string) => <div data-testid="shot">{shot}</div>

const tour = () => render(<Tour show={show} ending={ENDING} />)

const last = BEATS.length + 1

describe("the onboarding", () => {
  test("opens on the first beat", () => {
    tour()

    expect(screen.getByText(BEATS[0]!.title)).toBeTruthy()
  })

  test("draws the screen each beat is about, from the first one", () => {
    const shown = BEATS[0]?.picture
    if (shown === undefined) throw new Error("the welcome is about a screen")

    tour()

    expect(screen.getByTestId("shot").textContent).toBe(shown)
  })

  /*
   * The welcome and the beat after it are about the same screen, and the picture is keyed
   * by the screen rather than by the beat — so the press between them changes the words
   * and leaves the list alone. Keyed by the beat, a running screen was torn down and
   * built again on a press that was meant to say one more thing about it.
   */
  test("leaves the screen where it is across two beats about the same one", async () => {
    tour()
    const first = screen.getByTestId("shot")

    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(screen.getByTestId("shot")).toBe(first)
  })

  test("says nothing of a screen on the host's own beat, which has none", async () => {
    tour()
    await userEvent.click(screen.getByRole("button", { name: "Skip" }))

    expect(screen.queryByTestId("shot")).toBeNull()
    expect(screen.getByText(ENDING.title)).toBeTruthy()
  })

  test("goes back, which is the whole reason Back is there", async () => {
    tour()

    // Nothing to go back to on the first beat, so nothing offers to.
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await userEvent.click(screen.getByRole("button", { name: "Back" }))

    expect(screen.getByText(BEATS[0]!.title)).toBeTruthy()
  })

  /*
   * Skipping is going to the end rather than closing anything. A reader who opened
   * the app to sign in should reach the sign-in in one press, and the end is where it
   * is — so a Skip that hid the tour would hide the button they were skipping to.
   */
  test("skips to the last beat, which is the host's, rather than out of the tour", async () => {
    tour()
    await userEvent.click(screen.getByRole("button", { name: "Skip" }))

    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeTruthy()
  })

  test("offers nothing to skip or press next on the last beat, where both would say the same", async () => {
    tour()
    await userEvent.click(screen.getByRole("button", { name: "Skip" }))

    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
  })

  test("goes to a beat by its dot, so the second one is one press away from the last", async () => {
    tour()

    const dots = screen.getAllByRole("button", { name: BEATS[1]!.title })
    await userEvent.click(dots[0]!)

    expect(screen.getByText(BEATS[1]!.title)).toBeTruthy()
  })

  test("walks on the arrow keys, and stops at both ends rather than counting past them", async () => {
    tour()

    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByText(BEATS[1]!.title)).toBeTruthy()

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}")
    expect(screen.getByText(BEATS[0]!.title)).toBeTruthy()

    await userEvent.keyboard("{ArrowRight}".repeat(last + 3))
    expect(screen.getByText(ENDING.title)).toBeTruthy()
  })
})

describe("what the onboarding says", () => {
  /*
   * One sentence a beat, and the reason is the reader rather than the layout: this is read
   * by somebody who has just installed something and wants to get on with their work. A
   * second sentence is a beat that has started explaining itself.
   */
  test("is one sentence a beat", () => {
    for (const beat of BEATS) expect(beat.says).toHaveLength(1)
  })

  /*
   * Every beat is about a screen, the welcome included. A beat whose picture row is empty
   * is a card that reads as still loading, and a beat that fills it with a logo is a
   * splash screen — which costs a press and shows nothing. Both were tried here.
   */
  test("is about a screen on every beat, the welcome included", () => {
    expect(BEATS.length).toBeGreaterThan(1)

    for (const beat of BEATS) expect(beat.picture).toBeTruthy()
  })

  /*
   * The first beat promises a heading, and the promise is the beat. This is the fault
   * that guard was written for: the Court was renamed from Your Move to Needs You in
   * the app, and the tour went on naming the old one to a reader who would never see
   * it. Nothing failed, which is why it took a person noticing.
   */
  test("names the first Court as the list names it, rather than as it was once named", () => {
    const named = BEATS.some((beat) =>
      beat.says.some((sentence) => sentence.includes(COURT_NAME["needs-you"]))
    )

    expect(named).toBe(true)
  })
})
