import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Portrait } from "../domain/portrait"
import { PortraitsProvider } from "./portraits"
import { Who } from "./Who"

afterEach(cleanup)

const dan: Portrait = {
  login: "gaearon",
  name: Option.some("dan"),
  pronouns: Option.none(),
  bio: Option.none(),
  location: Option.none(),
  faceUrl: Option.none(),
  note: Option.none(),
  sponsorable: false,
  followedByViewer: false
}

/**
 * Who a face asks, and where the answer comes from.
 *
 * A face is nine levels below the screen that knows how to read a hovercard — it
 * is in a commit's author line and among a merge card's avatars — so the reads
 * arrive by context rather than by prop. These are about that arrangement rather
 * than about the card, which `who.test.tsx` covers.
 */
describe("where a face gets its reads", () => {
  test("uses the reads the screen was given", async () => {
    render(
      <PortraitsProvider
        reads={{
          look: () => Effect.succeed(Option.some(dan)),
          count: () => Effect.succeed(Option.some(1))
        }}
      >
        <Who login="gaearon" />
      </PortraitsProvider>
    )

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    expect(await screen.findByText("dan")).toBeTruthy()
    expect(screen.getByText("1 contribution in the last year")).toBeTruthy()
  })

  test("draws the login alone where nobody provided any", async () => {
    // Which is what an interface on a platform with no hovercards looks like: the
    // face and the login, and no card that fails to load. Every field of a
    // portrait is already optional, so this is a shorter card rather than a
    // broken one.
    render(<Who login="gaearon" />)

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    expect(await screen.findByText("gaearon")).toBeTruthy()
    expect(screen.queryByText(/contribution/)).toBeNull()
  })

  test("lets one face be told directly, for a card standing in a test", async () => {
    render(
      <PortraitsProvider
        reads={{
          look: () => Effect.die(new Error("the screen's reads were used")),
          count: () => Effect.succeed(Option.none())
        }}
      >
        <Who
          login="gaearon"
          look={() => Effect.succeed(Option.some(dan))}
          count={() => Effect.succeed(Option.none())}
        />
      </PortraitsProvider>
    )

    await userEvent.hover(screen.getByRole("img", { name: "gaearon" }))

    expect(await screen.findByText("dan")).toBeTruthy()
  })
})
