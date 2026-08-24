import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { Effect } from "effect"
import { aFile, aSnapshot } from "../../tests/snapshots"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { PullRequestScreen } from "./PullRequestScreen"

const idled = globalThis.requestIdleCallback
const unidled = globalThis.cancelIdleCallback

afterEach(() => {
  cleanup()
  globalThis.requestIdleCallback = idled
  globalThis.cancelIdleCallback = unidled
})

const holdIdleTime = () => {
  const waiting = new Map<number, () => void>()
  let asked = 0

  globalThis.requestIdleCallback = ((run: IdleRequestCallback) => {
    asked += 1
    waiting.set(asked, () => run({ didTimeout: false, timeRemaining: () => 0 }))
    return asked
  }) as typeof globalThis.requestIdleCallback
  globalThis.cancelIdleCallback = ((handle: number) => {
    waiting.delete(handle)
  }) as typeof globalThis.cancelIdleCallback

  return {
    pending: () => waiting.size,
    runIdle: () =>
      act(() => {
        const due = [...waiting.values()]
        waiting.clear()
        for (const run of due) run()
      })
  }
}

const reference: PullRequestRef = { owner: "acme", repo: "widgets", number: 7 }

const wait = (): HTMLElement | null => document.querySelector("[data-gitquiet-loading]")

/** Waits for it to appear, since it is held back until a wait is worth drawing. */
const drawn = async (): Promise<HTMLElement> => {
  await waitFor(() => expect(wait()).not.toBeNull())
  return wait()!
}

/** A read that never answers, so the wait itself can be looked at. */
const waiting = async () => {
  const rendered = render(
    <PullRequestScreen
      reference={reference}
      load={() => Effect.never}
      fetchDiffs={() => Effect.succeed([])}
      onStepAside={() => {}}
    />
  )
  await drawn()
  return rendered
}

/**
 * A read that answers after long enough to have been watched.
 *
 * The dissolve is for a wait the reader sat through — long enough for it to have
 * gone up and been read. A read that answers in the same breath as the question is
 * a different case, tested on its own below.
 */
const arriving = (after = 400) =>
  render(
    <PullRequestScreen
      reference={reference}
      load={() =>
        Effect.succeed({ snapshot: aSnapshot({ reference }) }).pipe(Effect.delay(after))
      }
      fetchDiffs={() => Effect.succeed([])}
      onStepAside={() => {}}
    />
  )

describe("the wait before a pull request has been read", () => {
  test("says what it is doing, out loud and on the screen", async () => {
    // The one thing that is true before GitHub has answered. It used to be said
    // only to a screen reader, because a page-sized skeleton was saying it to
    // everyone else; with the bars gone, the sentence is the answer.
    await waiting()

    expect(screen.getByRole("status").textContent).toContain("Reading this pull request")
  })

  test("names the pull request, so the wait is plainly about what was pressed", async () => {
    const { container } = await waiting()

    expect(container.textContent).toContain("acme/widgets #7")
  })

  test("turns something, so a wait that is taking a while still reads as work", async () => {
    const { container } = await waiting()

    expect(container.querySelector(".t-rotate")).not.toBeNull()
  })

  test("offers nothing to press, since there is nothing yet to press", async () => {
    const { container } = await waiting()

    expect(container.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0)
  })
})

describe("the moment the pull request arrives", () => {
  test("reports when a detached pull request is ready to cache", async () => {
    let prepared = 0
    render(
      <PullRequestScreen
        reference={reference}
        load={() =>
          Effect.succeed({ snapshot: aSnapshot({ reference, files: [aFile("src/spin.ts")] }) })
        }
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        preparing
        onPrepared={() => {
          prepared += 1
        }}
      />
    )

    await waitFor(() => expect(prepared).toBe(1), { timeout: 6_000 })
  })

  test("builds a detached pull request over separate idle tasks", async () => {
    const idle = holdIdleTime()
    let prepared = 0
    render(
      <PullRequestScreen
        reference={reference}
        load={() =>
          Effect.succeed({ snapshot: aSnapshot({ reference, files: [aFile("src/spin.ts")] }) })
        }
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        preparing
        onPrepared={() => {
          prepared += 1
        }}
      />
    )

    await waitFor(() => expect(idle.pending()).toBe(1))
    expect(prepared).toBe(0)
    expect(screen.queryByRole("region", { name: "Merge" })).toBeNull()

    let turns = 0
    while (screen.queryByRole("region", { name: "Merge" }) === null && turns < 10) {
      idle.runIdle()
      turns += 1
      await waitFor(() => expect(idle.pending()).toBeGreaterThan(0))
    }
    expect(screen.getByRole("region", { name: "Merge" })).toBeDefined()
    expect(prepared).toBe(0)
    expect(screen.queryByLabelText("How the files are drawn")).toBeNull()

    while (prepared === 0 && turns < 30) {
      idle.runIdle()
      turns += 1
      if (prepared === 0) await waitFor(() => expect(idle.pending()).toBeGreaterThan(0))
    }
    expect(turns).toBeGreaterThan(2)
    expect(screen.getByLabelText("How the files are drawn")).toBeDefined()
    expect(prepared).toBe(1)
  })

  test("puts the card on the page and lets the wait leave over it", async () => {
    // The card is not waited for: it is in the page the moment GitHub answers, at
    // full strength, and the wait dissolves on top of it. Fading the card in
    // instead would spend four hundred milliseconds of a read this whole extension
    // exists to make quick.
    arriving()

    /*
     * Held before the card arrives, and asked afterwards. The leave takes the wait off
     * the page when it finishes, so a look for it after the card is a look that finds
     * nothing on a loaded machine — the test failed on a dissolve that had run exactly
     * as it should have. The element that was up keeps the mark it left under, whether
     * or not it is still on the page.
     */
    const shown = await drawn()

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    await waitFor(() => expect(shown.hasAttribute("data-leaving")).toBe(true))
  })

  test("keeps the very element that was on the page, so it has something to fade from", async () => {
    // A transition needs the element to have been on the page in its resting
    // state. Drawing the card wrapped in something the wait was not wrapped in
    // makes React throw the wait away and mount a second one already faded out —
    // which passes every test about attributes and shows the reader nothing.
    arriving()

    const shown = await drawn()

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    expect(wait() === shown).toBe(true)
  })

  test("takes it off the page once it has gone", async () => {
    arriving()

    await drawn()
    await waitFor(() => expect(wait() === null).toBe(true), { timeout: 2000 })
  })

  test("draws nothing at all for a wait that is over before it could be read", async () => {
    // A cold load lands the pull request about sixty milliseconds after the
    // interface reaches the page. A wait drawn and taken away inside that window
    // is not a wait being explained — it is a flash between an empty page and a
    // full one, and the reader reads it as the page changing its mind.
    let flashed = false
    render(
      <PullRequestScreen
        reference={reference}
        load={() =>
          Effect.succeed({ snapshot: aSnapshot({ reference }) }).pipe(Effect.delay(60))
        }
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
      />
    )

    await waitFor(
      () => {
        if (wait() !== null) flashed = true
        expect(screen.queryByRole("region", { name: "Merge" })).not.toBeNull()
      },
      { interval: 1, timeout: 2000 }
    )

    expect(flashed).toBe(false)
  })

  test("does not dissolve a wait nobody was around for", async () => {
    // A remembered pull request answers in tens of milliseconds. Fading anything
    // over it for four hundred of them spends the whole saving on an apology for a
    // wait that never happened.
    render(
      <PullRequestScreen
        reference={reference}
        load={() => Effect.succeed({ snapshot: aSnapshot({ reference }) })}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(wait() === null).toBe(true), { timeout: 250 })
  })
})
