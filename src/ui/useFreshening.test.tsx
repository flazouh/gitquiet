import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { Effect, Option } from "effect"
import { SETTLED, Toasts, UP_TO_DATE } from "./Toasts"
import { useFreshening } from "./useFreshening"
import { useLive } from "./useLive"

afterEach(cleanup)

const settle = (ms = 40) => act(() => new Promise((rest) => setTimeout(rest, ms)))

const SAID = "Reading the newest of these…"

/** A screen doing the two lines every seeding screen does. */
type Reading = {
  readonly load: () => Effect.Effect<ReadonlyArray<string>, unknown>
  readonly preload?: () => Effect.Effect<Option.Option<ReadonlyArray<string>>>
}

/** The two lines every seeding screen does, without the toaster it stands under. */
const Reading = ({ load, preload }: Reading) => {
  const live = useLive(load, preload)
  useFreshening(live.catchingUp, SAID)

  return <p data-testid="rows">{live.read.status === "ready" ? live.read.value.join(",") : ""}</p>
}

const Screen = (props: Reading) => (
  <Toasts>
    <Reading {...props} />
  </Toasts>
)

const rowsOf = () => screen.getByTestId("rows").textContent

/**
 * How many toasts are standing.
 *
 * Counted rather than read, because a dismissed toast stays in the document:
 * sonner marks it removed and waits for the leaving transition to end, and in a
 * test there is no stylesheet for that transition to be in. So the text is still
 * findable after it has gone, and the mark is the only honest answer.
 */
const standing = () =>
  document.querySelectorAll('[data-sonner-toast]:not([data-removed="true"])').length

const toldOf = () => (standing() === 0 ? null : screen.queryByText(SAID))

describe("what a screen says while it is checking what it remembered", () => {
  test("says it, over the memory the reader is already reading", async () => {
    const load = () => Effect.sleep("400 millis").pipe(Effect.as(["fresh"]))
    const preload = () => Effect.succeed(Option.some(["remembered"]))

    render(<Screen load={load} preload={preload} />)
    await settle(10)

    // The list is there first. That is the point of the memory, and the sentence
    // is about the list rather than in place of it.
    expect(rowsOf()).toBe("remembered")

    await waitFor(() => expect(toldOf()).not.toBeNull())
  })

  test("answers its own sentence the moment GitHub does, rather than vanishing", async () => {
    /*
     * The read landing is the one thing a reader cannot see for themselves. A list that was
     * already right does not change when GitHub agrees with it, so a spinner that simply
     * disappeared was indistinguishable from a read that gave up.
     */
    const load = () => Effect.sleep("300 millis").pipe(Effect.as(["fresh"]))
    const preload = () => Effect.succeed(Option.some(["remembered"]))

    render(<Screen load={load} preload={preload} />)
    await waitFor(() => expect(toldOf()).not.toBeNull())

    await settle(400)

    expect(rowsOf()).toBe("fresh")
    expect(screen.getByText(UP_TO_DATE)).toBeDefined()
    // In place: one toast, which spun and then said what came of it.
    expect(standing()).toBe(1)

    // And then it goes on its own, which the sentence before it never did.
    await settle(SETTLED + 400)

    expect(standing()).toBe(0)
  })

  test("says nothing at all where the screen went away mid-read", async () => {
    // Not "Up to date": nobody has told this screen anything, and it is no longer reading.
    const load = () => Effect.sleep("2 seconds").pipe(Effect.as(["fresh"]))
    const preload = () => Effect.succeed(Option.some(["remembered"]))

    const shown = render(
      <Toasts>
        <Reading load={load} preload={preload} />
      </Toasts>
    )
    await waitFor(() => expect(toldOf()).not.toBeNull())

    shown.rerender(<Toasts />)

    await waitFor(() => expect(standing()).toBe(0))
    expect(screen.queryByText(UP_TO_DATE)).toBeNull()
  })

  test("says nothing about a read that answered before anybody could read it", async () => {
    const load = () => Effect.sleep("5 millis").pipe(Effect.as(["fresh"]))
    const preload = () => Effect.succeed(Option.some(["remembered"]))

    render(<Screen load={load} preload={preload} />)
    await settle(300)

    // A toast up for eighty milliseconds is not a sentence anybody reads. It is
    // the top of the screen flickering, on the screens that are quickest.
    expect(rowsOf()).toBe("fresh")
    expect(toldOf()).toBeNull()
  })

  test("says nothing where there is nothing underneath it yet", async () => {
    const load = () => Effect.sleep("400 millis").pipe(Effect.as(["fresh"]))

    render(<Screen load={load} />)
    await settle(300)

    // The wait is saying this already, in the middle of the screen. Two things
    // saying it is one thing too many, and the toast is the smaller of the two.
    expect(rowsOf()).toBe("")
    expect(toldOf()).toBeNull()
  })
})
