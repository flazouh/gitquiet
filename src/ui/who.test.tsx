import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Deferred, Effect, Option } from "effect"
import type { Portrait } from "../domain/portrait"
import { Who, type Count, type Look } from "./Who"

afterEach(cleanup)

const portrait = (over: Partial<Portrait> = {}): Portrait => ({
  login: "gaearon",
  name: Option.some("dan"),
  pronouns: Option.some("he/him"),
  bio: Option.some("Making things for the web."),
  location: Option.none(),
  faceUrl: Option.none(),
  note: Option.some("Committed to this repository in the past week"),
  sponsorable: false,
  followedByViewer: false,
  ...over
})

/**
 * A face with both of its reads stood in for.
 *
 * Both, always, and never only the one a test is about: the defaults reach GitHub,
 * and a suite that leaves one of them in place is a suite that passes or fails on
 * whether the network answered.
 */
const face = ({
  login = "gaearon",
  look = () => Effect.succeed(Option.some(portrait())),
  count = () => Effect.succeed(Option.none())
}: {
  login?: string
  look?: Look
  count?: Count
} = {}) => render(<Who login={login} look={look} count={count} />)

describe("the person behind a face", () => {
  test("asks GitHub nothing until somebody looks", async () => {
    // The face is the first column of every row, so a cursor going down the list
    // crosses all of them. Asking on the way past would be a read per row nobody
    // meant to look at.
    let asked = 0
    face({
      look: () => {
        asked += 1
        return Effect.succeed(Option.none())
      }
    })

    await waitFor(() => expect(screen.getByRole("img", { name: "gaearon" })).toBeTruthy())

    expect(asked).toBe(0)
  })

  test("shows who they are once GitHub answers", async () => {
    face()

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    expect(await screen.findByText("dan")).toBeTruthy()
    expect(screen.getByText("Making things for the web.")).toBeTruthy()
    expect(screen.getByText("he/him")).toBeTruthy()
  })

  test("says how recently they were in this repository, which is why the card is worth a read", async () => {
    face()

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    expect(await screen.findByText(/Committed to this repository/)).toBeTruthy()
  })

  test("leads to their profile", async () => {
    face()

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    const link = await screen.findByRole("link")
    expect(link.getAttribute("href")).toBe("https://github.com/gaearon")
  })

  test("shows the login on its own while the answer is still coming", async () => {
    face({ look: () => Effect.never })

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    // Twice on the page now: the face keeps its label and the card names them.
    await waitFor(() => expect(screen.getAllByText("gaearon").length).toBeGreaterThan(0))
  })

  test("draws a card with a login and nothing else for a login GitHub knows nothing about", async () => {
    // Every app is this case. A card that is mostly empty beats a card that says
    // an app has no name, which is true of every app and worth saying about none.
    face({ login: "dependabot[bot]", look: () => Effect.succeed(Option.none()) })

    await userEvent.hover(screen.getByRole("img", { name: "dependabot[bot]" }))

    await waitFor(() => expect(screen.getByText("dependabot[bot]")).toBeTruthy())
    expect(screen.queryByText("he/him")).toBeNull()
  })

  test("marks somebody the reader already follows", async () => {
    face({ look: () => Effect.succeed(Option.some(portrait({ followedByViewer: true }))) })

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    expect(await screen.findByText("Following")).toBeTruthy()
  })
})

describe("a year of their work", () => {
  test("is grouped, because four digits unbroken is a number to be worked out", async () => {
    face({ count: () => Effect.succeed(Option.some(3212)) })

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    expect(await screen.findByText("3,212 contributions in the last year")).toBeTruthy()
  })

  test("is said in the singular where there was one", async () => {
    face({ count: () => Effect.succeed(Option.some(1)) })

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    expect(await screen.findByText("1 contribution in the last year")).toBeTruthy()
  })

  test("arrives without holding up the rest of the card", async () => {
    // The calendar it is read off is a quarter of a megabyte. The card is up and
    // readable first, and this line appears under it.
    const counting = Deferred.makeUnsafe<Option.Option<number>>()
    face({ count: () => Deferred.await(counting) })

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))
    expect(await screen.findByText("dan")).toBeTruthy()
    expect(screen.queryByText(/contributions in the last year/)).toBeNull()

    Deferred.doneUnsafe(counting, Effect.succeed(Option.some(847)))

    expect(await screen.findByText("847 contributions in the last year")).toBeTruthy()
  })

  test("is left out entirely where the calendar could not be read", async () => {
    face({ count: () => Effect.succeed(Option.none()) })

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    await screen.findByText("dan")
    expect(screen.queryByText(/contribution/)).toBeNull()
  })
})
