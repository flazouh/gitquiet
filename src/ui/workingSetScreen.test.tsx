import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Deferred, Effect, Option } from "effect"
import { afterwards } from "../../tests/afterwards"
import { sittingsIn } from "../domain/sittings"
import type { InvolvedPullRequest, Shelf } from "../domain/workingSet"
import { WorkingSetScreen } from "./WorkingSetScreen"

afterEach(cleanup)

const involved = (title: string, number = 1): InvolvedPullRequest => ({
  reference: { owner: "flazouh", repo: "octo-repo", number },
  id: number * 1000,
  title,
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.some<Shelf>("needs-action"),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-01T00:00:00Z",
  headSha: "sha",
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none()
})

const listOf = (...titles: ReadonlyArray<string>) =>
  sittingsIn(
    titles.map((title, at) => involved(title, at + 1)),
    () => Option.none()
  )

/** A read that answers only when the test says so, so waiting is observable. */
const held = <A,>() => {
  const answer = Deferred.makeUnsafe<A, Error>()

  return {
    read: Deferred.await(answer),
    settle: (value: A) => {
      Deferred.doneUnsafe(answer, Effect.succeed(value))
    },
    fail: () => {
      Deferred.doneUnsafe(answer, Effect.fail(new Error("GitHub said no")))
    }
  }
}

/**
 * A tab someone is actually looking at.
 *
 * happy-dom answers `visibilityState` from whether a window is still behind the
 * document, so it says "hidden" or "visible" depending on what other test files
 * did before this one — which is nothing to do with what is being tested here.
 * Coming back to the tab is the whole subject, so the tab is put there.
 */
const looking = (undoing: (undo: () => void) => void): void => {
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true
  })
  undoing(() => {
    Reflect.deleteProperty(document, "visibilityState")
  })
}

describe("the Working Set screen", () => {
  const undoing = afterwards()

  test("says it is reading while GitHub has not answered", async () => {
    const reading = held<ReturnType<typeof listOf>>()

    render(
      <WorkingSetScreen
        load={() => reading.read}
        onOpen={() => {}}
        onStepAside={() => {}}
      />
    )

    // Not at once: a wait too short to be read is one the reader is told
    // nothing about, out loud or on the screen.
    expect(await screen.findByText(/Reading your pull requests/)).toBeDefined()
  })

  test("shows the Working Set once it has", async () => {
    render(
      <WorkingSetScreen
        load={() => Effect.succeed(listOf("price claude turns"))}
        onOpen={() => {}}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText(/price claude turns/)).toBeDefined())
  })

  test("shows what was remembered before GitHub answers, and replaces it", async () => {
    // The point of remembering is that a reader who has opened this before waits
    // for nothing. The remembered list must not outlive the answer, though.
    const reading = held<ReturnType<typeof listOf>>()

    render(
      <WorkingSetScreen
        load={() => reading.read}
        preload={() => Effect.succeed(Option.some(listOf("what it was")))}
        onOpen={() => {}}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText(/what it was/)).toBeDefined())

    reading.settle(listOf("what it is now"))

    await waitFor(() => expect(screen.getByText(/what it is now/)).toBeDefined())
    expect(screen.queryByText(/what it was/)).toBeNull()
  })

  test("does not rest on what was remembered when the read fails", async () => {
    // A remembered list came out of another session and there is no bound on its
    // age. Shown after a failure it would look exactly like a fresh one, and this
    // list is read to decide what to work on next.
    const reading = held<ReturnType<typeof listOf>>()

    render(
      <WorkingSetScreen
        load={() => reading.read}
        preload={() => Effect.succeed(Option.some(listOf("half an hour old")))}
        onOpen={() => {}}
        onStepAside={() => {}}
        signedIn={() => true}
      />
    )

    await waitFor(() => expect(screen.getByText(/half an hour old/)).toBeDefined())

    reading.fail()

    await waitFor(() => expect(screen.getByText(/could not be read/)).toBeDefined())
    expect(screen.queryByText(/half an hour old/)).toBeNull()
  })

  test("blames the session rather than GitHub when nobody is signed in", async () => {
    // Every route answers as if there is nothing there to a signed-out reader,
    // which is indistinguishable from a payload that changed shape.
    render(
      <WorkingSetScreen
        load={() => Effect.fail(new Error("404"))}
        onOpen={() => {}}
        onStepAside={() => {}}
        signedIn={() => false}
      />
    )

    await waitFor(() => expect(screen.getByText(/signed out of GitHub/)).toBeDefined())
    expect(screen.getByRole("link", { name: /Sign in/ })).toBeDefined()
  })

  test("hands the page back to GitHub when asked", async () => {
    let handed = false

    render(
      <WorkingSetScreen
        load={() => Effect.fail(new Error("no"))}
        onOpen={() => {}}
        onStepAside={() => {
          handed = true
        }}
        signedIn={() => true}
      />
    )

    await waitFor(() => expect(screen.getByText(/could not be read/)).toBeDefined())
    await userEvent.click(screen.getByRole("button", { name: /Show GitHub's list/ }))

    expect(handed).toBe(true)
  })

  test("reads GitHub once, however many times the list draws", async () => {
    // Drawing is cheap and reading is eight requests. Anything that ties a read
    // to a render — a dependency that is a fresh value each time, a state change
    // during the read — turns each answer into the next request, and the list
    // asks GitHub for itself as fast as GitHub will reply.
    let reads = 0

    render(
      <WorkingSetScreen
        load={() => {
          reads += 1
          return Effect.succeed(listOf("read once"))
        }}
        onOpen={() => {}}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText(/read once/)).toBeDefined())
    await Effect.runPromise(Effect.sleep(50))

    expect(reads).toBe(1)
  })

  test("reads again when the reader comes back to the tab", async () => {
    // Someone else reviewing, or a check landing, cannot be listened for from
    // here. Coming back is the moment those stop being harmless.
    let reads = 0

    render(
      <WorkingSetScreen
        load={() => {
          reads += 1
          return Effect.succeed(listOf(reads === 1 ? "as it was" : "as it is"))
        }}
        onOpen={() => {}}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText(/as it was/)).toBeDefined())

    looking(undoing)
    expect(document.visibilityState).toBe("visible")

    // Bubbling, as the platform's own is: the listener is on `window`, and a
    // `visibilitychange` fired at the document reaches it by propagation.
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))

    await waitFor(() => expect(screen.getByText(/as it is/)).toBeDefined())
  })

  test("moves the row the moment a verb is confirmed, before GitHub has answered", async () => {
    /*
     * What this screen was for. Closing from a row used to mean pressing twice,
     * waiting for GitHub, and then waiting again for the whole Working Set to be
     * read from scratch — eight requests to be told the thing the domain already
     * knew: a closed pull request is in Settled.
     */
    const ask = held<void>()

    render(
      <WorkingSetScreen
        load={() => Effect.succeed(listOf("close me"))}
        onOpen={() => {}}
        onStepAside={() => {}}
        ask={() => ask.read}
      />
    )

    await waitFor(() => expect(screen.getByText("close me")).toBeDefined())
    expect(screen.getByRole("heading", { name: /Needs You/i })).toBeDefined()

    await userEvent.click(screen.getByLabelText("What to do with #1"))
    await userEvent.click(screen.getByText("Close"))
    await userEvent.click(screen.getByText("Confirm"))

    // GitHub has not answered and is not going to until this test says so.
    await waitFor(() => expect(screen.getByRole("heading", { name: /Settled/i })).toBeDefined())
  })

  test("puts the row back where GitHub refused the verb", async () => {
    const ask = held<void>()

    render(
      <WorkingSetScreen
        load={() => Effect.succeed(listOf("close me"))}
        onOpen={() => {}}
        onStepAside={() => {}}
        ask={() => ask.read}
      />
    )

    await waitFor(() => expect(screen.getByText("close me")).toBeDefined())

    await userEvent.click(screen.getByLabelText("What to do with #1"))
    await userEvent.click(screen.getByText("Close"))
    await userEvent.click(screen.getByText("Confirm"))

    await waitFor(() => expect(screen.getByRole("heading", { name: /Settled/i })).toBeDefined())

    ask.fail()

    await waitFor(() => expect(screen.getByRole("heading", { name: /Needs You/i })).toBeDefined())
  })

  /*
   * Their pull request dashboard is a page of ours, and it was the one page of ours with
   * no bar on it. The bar lived inside the Home half of this screen, so `/pulls` drew the
   * list alone — no switcher, no palette, no way to the settings — and GitHub's own header
   * stayed up, that being hidden by the presence of our bar rather than by anything else.
   */
  test("draws the bar on their dashboard, which is a page of ours too", async () => {
    render(
      <WorkingSetScreen
        load={() => Effect.succeed(listOf("price claude turns"))}
        onOpen={() => {}}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByRole("banner")).toBeDefined())
  })

  test("draws it before the list, the bar being what the reader steers with", async () => {
    // The read is eight requests. A bar that waited for them would be a page with no way
    // off it for most of a second, on the one screen a reader arrives at to leave again.
    const reading = held<ReturnType<typeof listOf>>()

    render(
      <WorkingSetScreen load={() => reading.read} onOpen={() => {}} onStepAside={() => {}} />
    )

    await waitFor(() => expect(screen.getByRole("banner")).toBeDefined())
  })

  test("keeps it up when the read fails, a failure being no reason to strand anyone", async () => {
    render(
      <WorkingSetScreen
        load={() => Effect.fail(new Error("no"))}
        onOpen={() => {}}
        onStepAside={() => {}}
        signedIn={() => true}
      />
    )

    await waitFor(() => expect(screen.getByText(/could not be read/)).toBeDefined())
    expect(screen.getByRole("banner")).toBeDefined()
  })

  test("keeps what is on the screen when a re-read fails", async () => {
    // Replacing a working list with an error because a background refresh missed
    // would punish the reader for our own optimism.
    let reads = 0
    const missed = held<ReturnType<typeof listOf>>()

    render(
      <WorkingSetScreen
        load={() => {
          reads += 1
          return reads === 1 ? Effect.succeed(listOf("still true enough")) : missed.read
        }}
        onOpen={() => {}}
        onStepAside={() => {}}
        signedIn={() => true}
      />
    )

    await waitFor(() => expect(screen.getByText(/still true enough/)).toBeDefined())

    document.dispatchEvent(new Event("visibilitychange"))
    missed.fail()
    // Awaited, so the assertions below run after the screen has had every chance
    // to react to the failure rather than merely before it noticed.
    await Effect.runPromise(missed.read.pipe(Effect.ignore))

    expect(screen.getByText(/still true enough/)).toBeDefined()
    expect(screen.queryByText(/could not be read/)).toBeNull()
  })
})
