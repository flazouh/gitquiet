import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { Effect } from "effect"
import { afterwards } from "../../tests/afterwards"
import { paced } from "../../tests/paced"
import type { Sitting } from "../domain/sittings"
import { RepoPullsScreen } from "./RepoPullsScreen"
import { WorkingSetScreen } from "./WorkingSetScreen"

const undo = afterwards()

afterEach(cleanup)

const nothing: ReadonlyArray<Sitting> = [
  { court: "needs-you", count: 0, piles: [], issues: [] },
  { court: "waiting", count: 0, piles: [], issues: [] },
  { court: "settled", count: 0, piles: [], issues: [] }
]

const wait = (): HTMLElement | null => document.querySelector("[data-gitquiet-loading]")

/** Waits for it to appear, since it is held back until a wait is worth drawing. */
const drawn = async (): Promise<HTMLElement> => {
  await waitFor(() => expect(wait()).not.toBeNull())
  return wait()!
}

/** A read that never answers, so the wait itself can be looked at. */
const waitingSet = async () => {
  const rendered = render(
    <WorkingSetScreen
      load={() => Effect.never as Effect.Effect<never>}
      onOpen={() => {}}
      onStepAside={() => {}}
    />
  )
  await drawn()
  return rendered
}

/**
 * A read held open until the test lands it, so the wait was up first as a fact.
 *
 * The 400ms delay this replaces was a race against the wait's own threshold
 * timer, and `bun test --parallel` made it lose — `waiting.test.tsx` records
 * the mechanism on the read it holds the same way.
 */
const arrivingSet = () => {
  let land = (): void => {}
  const landed = new Promise<void>((done) => {
    land = () => done()
  })

  render(
    <WorkingSetScreen
      load={() => Effect.promise(() => landed).pipe(Effect.as(nothing))}
      onOpen={() => {}}
      onStepAside={() => {}}
    />
  )
  return { land }
}

const waitingRepo = async () => {
  const rendered = render(
    <RepoPullsScreen
      repo={{ owner: "acme", repo: "widgets" }}
      load={() => Effect.never as Effect.Effect<never>}
      onOpen={() => {}}
      onStepAside={() => {}}
    />
  )
  await drawn()
  return rendered
}

describe("the wait before a list of pull requests has been read", () => {
  test("says what it is reading, which is not the same sentence on both screens", async () => {
    await waitingSet()
    expect(screen.getByRole("status").textContent).toContain("Reading your pull requests")

    cleanup()

    await waitingRepo()
    expect(screen.getByRole("status").textContent).toContain("this repository's pull requests")
  })

  test("names the repository while it waits, since that much was known from the address", async () => {
    // Not a guess: it came off the URL before a single request went out, so a
    // reader can see that the wait belongs to the repository they asked for.
    const { container } = await waitingRepo()

    expect(container.textContent).toContain("acme/widgets")
  })

  test("offers nothing to press or type into", async () => {
    const { container } = await waitingSet()

    expect(container.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0)
  })
})

describe("the moment a list arrives", () => {
  test("keeps the very element that was on the page, so it has something to fade from", async () => {
    // Paced so the wait goes up at once and its dissolve never finishes, which
    // holds the element still for the identity check.
    undo(paced({ "--duration-quick": "0ms", "--wait-reveal-dur": "600s" }))
    const { land } = arrivingSet()

    const shown = await drawn()
    land()

    await waitFor(() => expect(screen.getByRole("searchbox")).toBeDefined())
    expect(wait() === shown).toBe(true)
  })

  test("takes it off the page once it has gone", async () => {
    // A dissolve of no length at all, so "gone" is the very next thing.
    undo(paced({ "--duration-quick": "0ms", "--wait-reveal-dur": "0ms" }))
    const { land } = arrivingSet()

    await drawn()
    land()

    await waitFor(() => expect(wait() === null).toBe(true))
  })

  test("does not dissolve a wait nobody was around for", async () => {
    // A list is remembered between sittings and comes back from memory within the
    // same document, so this is the common case rather than the exception: a wait
    // up for a frame, and no reason to fade it over a list already being read.
    // The threshold is paced far past the answer, so the frame stays a frame on
    // a loaded worker.
    undo(paced({ "--duration-quick": "600s" }))
    render(
      <WorkingSetScreen
        load={() => Effect.succeed(nothing)}
        onOpen={() => {}}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(wait() === null).toBe(true), { timeout: 250 })
  })
})
