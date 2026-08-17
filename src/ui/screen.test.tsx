import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Deferred, Effect, Option } from "effect"
import { aMergeState, aSnapshot } from "../../tests/snapshots"
import type { PullRequestState } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { PullRequestScreen } from "./PullRequestScreen"

afterEach(cleanup)

const reference: PullRequestRef = { owner: "acme", repo: "widgets", number: 7 }

const failing = (signedIn: boolean) =>
  render(
    <PullRequestScreen
      reference={reference}
      load={() => Effect.fail(new Error("HTTP 404"))}
      fetchDiffs={() => Effect.succeed([])}
      onStepAside={() => {}}
      signedIn={() => signedIn}
    />
  )

/** A pull request on a repository that merges through a queue. */
const queued = () =>
  aSnapshot({
    reference,
    merge: aMergeState({
      channels: ["queue-channel"],
      queue: Option.some({
        waiting: false,
        position: Option.none(),
        viewerCanQueue: true,
        mayJoin: true,
        url: Option.some("https://github.com/acme/widgets/queue/main")
      })
    })
  })

/** A write GitHub has not answered yet, and will answer when this test says so. */
const held = () => {
  const answer = Deferred.makeUnsafe<void, { readonly detail: string }>()

  return {
    read: Deferred.await(answer),
    settle: () => Deferred.doneUnsafe(answer, Effect.void),
    // Shaped as GitHub's refusals arrive, since the sentence the card prints is
    // read off `detail` rather than made up here.
    fail: () => Deferred.doneUnsafe(answer, Effect.fail({ detail: "GitHub said no" }))
  }
}

/** An ordinary pull request, ready to land, on a repository with no queue. */
const ready = () =>
  aSnapshot({
    reference,
    merge: aMergeState()
  })

describe("a verb pressed on the merge card", () => {
  test("wears the state it leads to before GitHub has answered", async () => {
    /*
     * The card knows what closing does. Waiting two seconds for GitHub to say
     * "closed" — and then a further read of the whole pull request to hear it —
     * is a press that appears to do nothing, on the one control in this
     * interface that ends a piece of work.
     */
    const ask = held()

    render(
      <PullRequestScreen
        reference={reference}
        load={() => Effect.succeed({ snapshot: ready() })}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{ close: () => ask.read }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: /Close pull request/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm close pull request/ }))

    // GitHub has not answered and is not going to until this test says so.
    await waitFor(() => expect(screen.getByText(/ended without landing/)).toBeDefined())
  })

  test("puts the card back where GitHub refused it", async () => {
    const ask = held()

    render(
      <PullRequestScreen
        reference={reference}
        load={() => Effect.succeed({ snapshot: ready() })}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{ close: () => ask.read }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: /Close pull request/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm close pull request/ }))

    await waitFor(() => expect(screen.getByText(/ended without landing/)).toBeDefined())

    ask.fail()

    // The controls are back, and so is the sentence saying why they are.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Close pull request/ })).toBeDefined()
    )
    expect(screen.getByText(/GitHub said no/)).toBeDefined()
  })

  test("hands the verbs back where the write never reached GitHub at all", async () => {
    // A reader whose network blinked once. The card says so, and then every verb
    // on it has to be pressable again: the one thing to do with a write that
    // never left the machine is make it again.
    render(
      <PullRequestScreen
        reference={reference}
        load={() => Effect.succeed({ snapshot: ready() })}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{
          close: () =>
            Effect.fail({ reason: "unreachable", detail: "TypeError: Failed to fetch" })
        }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: /Close pull request/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm close pull request/ }))

    await waitFor(() => expect(screen.getByText("GitHub could not be reached.")).toBeDefined())

    expect(screen.getByRole("button", { name: /Close pull request/ })).toHaveProperty(
      "disabled",
      false
    )
  })

  test("hands the verbs back once the verb has landed", async () => {
    /*
     * The fault this was written for. Marking a draft ready is a write that
     * works and leaves a pull request worth reading — it still has a merge, a
     * draft door and a close on it — and the card said the word and then held
     * every one of them down for the rest of the session. Nine dead controls,
     * and no way back except reloading the page.
     */
    // As GitHub answers it: the read that follows the write says what the write
    // did, which is what turns the draft door around.
    let state: PullRequestState = "draft"

    render(
      <PullRequestScreen
        reference={reference}
        load={() => Effect.succeed({ snapshot: aSnapshot({ reference, state }) })}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{
          markReady: () => Effect.sync(() => void (state = "open")),
          toDraft: () => Effect.sync(() => void (state = "draft")),
          close: () => Effect.void
        }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: /Mark ready for review/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm mark ready for review/ }))

    // The draft door turning around is the write having landed.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Convert to draft/ })).toBeDefined()
    )
    expect(screen.getByRole("button", { name: /Convert to draft/ })).toHaveProperty(
      "disabled",
      false
    )
    expect(screen.getByRole("button", { name: /Close pull request/ })).toHaveProperty(
      "disabled",
      false
    )
  })
})

describe("a pull request that changed under a write of ours", () => {
  test("reads it again when the merge card says something moved", async () => {
    let reads = 0
    const load = () => {
      reads += 1
      return Effect.succeed({ snapshot: queued() })
    }

    render(
      <PullRequestScreen
        reference={reference}
        load={load}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{ enqueue: () => Effect.void }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    expect(reads).toBe(1)

    await userEvent.click(screen.getByRole("button", { name: /Merge when ready/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm merge when ready/ }))

    await waitFor(() => expect(reads).toBe(2))
  })

  test("reads it again where the merge card's verb was refused", async () => {
    // The same news the strip gets from a refusal, on the card beside it. GitHub
    // refuses a close, a merge or a draft because something moved — a branch was
    // pushed to, somebody else landed it, a rule started applying — and rolling
    // the card back puts the reader in front of the picture that was already
    // wrong. The rollback says what the card is not; only a read says what it is.
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({ snapshot: ready() })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{ close: () => Effect.fail({ reason: "rejected", detail: "GitHub said no" }) }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    expect(reads).toBe(1)

    await userEvent.click(screen.getByRole("button", { name: /Close pull request/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm close pull request/ }))

    await waitFor(() => expect(screen.getByText(/GitHub said no/)).toBeDefined())
    await waitFor(() => expect(reads).toBe(2))
  })

  test("does not read again where a verb of the card never reached GitHub", async () => {
    // The strip's rule, on the card, for the same reason: a read over the wire
    // that just failed fails too, and the page underneath is still worth having.
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({ snapshot: ready() })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{
          close: () =>
            Effect.fail({ reason: "unreachable", detail: "TypeError: Failed to fetch" })
        }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: /Close pull request/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm close pull request/ }))

    await waitFor(() => expect(screen.getByText("GitHub could not be reached.")).toBeDefined())
    expect(reads).toBe(1)
  })
})

describe("a pull request GitHub offers to stack", () => {
  /** The pair on `flazouh/stack-probe`, read from the top of it. */
  const offered = () =>
    aSnapshot({
      reference,
      proposal: Option.some({
        floor: Option.some("main"),
        layers: [
          {
            reference: { owner: "acme", repo: "widgets", number: 6 },
            title: "the layer underneath",
            headBranch: "under",
            state: "open" as const,
            seat: "below" as const
          },
          {
            reference,
            title: "this one",
            headBranch: "spin",
            state: "open" as const,
            seat: "here" as const
          }
        ]
      })
    })

  test("reads it again once the stack is made, which is what takes the strip away", async () => {
    // The strip cannot draw its own way out of this. What replaces it is a
    // pull request with no proposal on it and a stack on its merge state, and
    // both of those are GitHub's to say.
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({ snapshot: offered() })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        makeStack={() => Effect.void}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Proposed stack" })).toBeDefined())
    expect(reads).toBe(1)

    await userEvent.click(screen.getByRole("button", { name: /Make the stack/ }))

    await waitFor(() => expect(reads).toBe(2))
  })

  test("reads it again where GitHub refused, because a refusal is news about the world", async () => {
    // The commonest refusal here is the offer having moved: somebody stacked
    // these from another tab, so GitHub answers "no longer offers this stack.
    // Read the pull request again." That instruction is the read this screen
    // used to decline to do, which left a dead button in front of the reader
    // over a picture of a world that had already changed.
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({ snapshot: offered() })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        makeStack={() => Effect.fail({ reason: "rejected", detail: "GitHub said no" })}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Proposed stack" })).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: /Make the stack/ }))

    await waitFor(() => expect(screen.getByText("GitHub said no")).toBeDefined())
    await waitFor(() => expect(reads).toBe(2))
  })

  test("does not read again where the write never reached GitHub", async () => {
    // A read over the same broken wire fails too, and it fails over a page the
    // reader can still use. The one thing worth knowing is already on the strip.
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({ snapshot: offered() })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        makeStack={() => Effect.fail({ reason: "unreachable", detail: "TypeError: Failed to fetch" })}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Proposed stack" })).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: /Make the stack/ }))

    await waitFor(() => expect(screen.getByText("GitHub could not be reached.")).toBeDefined())
    expect(reads).toBe(1)
  })
})

describe("a pull request GitHub says has changed", () => {
  test("reads it again when a channel it is listening to fires", async () => {
    let reads = 0
    let listening: ReadonlyArray<string> = []
    let fire = () => {}

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({ snapshot: queued() })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        watch={(channels, onFire) => {
          listening = channels
          fire = onFire
          return () => {}
        }}
      />
    )

    await waitFor(() => expect(listening).toEqual(["queue-channel"]))
    expect(reads).toBe(1)

    fire()

    await waitFor(() => expect(reads).toBe(2))
  })

  test("stops listening when the reader leaves", async () => {
    let stopped = 0

    const { unmount } = render(
      <PullRequestScreen
        reference={reference}
        load={() => Effect.succeed({ snapshot: queued() })}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        watch={() => () => void (stopped += 1)}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    unmount()

    expect(stopped).toBe(1)
  })
})

describe("a pull request left open while the reader was elsewhere", () => {
  /** What the browser does when a tab is shown or hidden. */
  const tabBecomes = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true })
    // Bubbling, as the platform's own is: the listener is on `window`, and a
    // `visibilitychange` fired at the document reaches it by propagation.
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))
  }

  test("reads it again on the way back, since anything at all may have happened", async () => {
    // A channel that never fired, a socket that quietly dropped, a laptop that
    // slept: every one of them ends with a card saying something GitHub stopped
    // agreeing with, and none of them can be told apart from here. Coming back
    // to the tab is the one moment the reader is about to trust what it says.
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({ snapshot: queued() })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(reads).toBe(1))

    tabBecomes("hidden")
    tabBecomes("visible")

    await waitFor(() => expect(reads).toBe(2))
  })

  test("does not read it again while it is being hidden", async () => {
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({ snapshot: queued() })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
      />
    )

    await waitFor(() => expect(reads).toBe(1))

    tabBecomes("hidden")

    expect(reads).toBe(1)
  })
})

describe("a pull request GitHub would not answer for a second time", () => {
  test("says so rather than leaving what was remembered standing as the truth", async () => {
    // Remembered payloads are worth showing for the half second before GitHub
    // answers. They are not worth resting on: a merge card is read to decide
    // whether to merge, and one that quietly went half an hour out of date
    // answers that question wrongly with no way for the reader to notice.
    render(
      <PullRequestScreen
        reference={reference}
        load={() => Effect.fail(new Error("HTTP 500"))}
        preload={() => Effect.succeed(Option.some({ snapshot: queued() }))}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        signedIn={() => true}
      />
    )

    await waitFor(() =>
      expect(screen.getByRole("heading").textContent).toContain("Something GitHub sends")
    )
    expect(screen.queryByRole("region", { name: "Merge" })).toBeNull()
  })
})

describe("a pull request that could not be read", () => {
  test("blames the signed-out session rather than GitHub, when that is what it is", async () => {
    // Every route answers 404 to a signed-out reader on a private repository,
    // which is indistinguishable from a payload we cannot parse — until you ask
    // the page who is signed in, which is the one question that separates them.
    failing(false)

    await waitFor(() => expect(screen.getByRole("heading").textContent).toContain("signed out"))
    expect(screen.getByRole("link", { name: /Sign in/ }).getAttribute("href")).toContain(
      "https://github.com/login"
    )
  })

  test("still says a payload changed when the reader is signed in", async () => {
    failing(true)

    await waitFor(() =>
      expect(screen.getByRole("heading").textContent).toContain("Something GitHub sends")
    )
    expect(screen.queryByRole("link", { name: /Sign in/ })).toBeNull()
  })

  test("offers GitHub's own conversation either way, since it is still on the page", async () => {
    failing(false)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Show GitHub's conversation/ })).toBeDefined()
    )
  })
})
