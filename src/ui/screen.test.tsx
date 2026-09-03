import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Deferred, Effect, Option } from "effect"
import { aComment, aMergeState, aSnapshot, aThread, person } from "../../tests/snapshots"
import type {
  MergeMethod,
  PullRequestSnapshot,
  PullRequestState,
  UpdateWay
} from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { PullRequestScreen } from "./PullRequestScreen"

/**
 * Closing, which is behind the glyph at the end of the merge card's row.
 *
 * Two presses, as it always was: the item arms on the first and goes to GitHub
 * on the second. The menu holds itself open between them, so both land on the
 * same item.
 */
const openTheRest = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: /More to do with this pull request/ })
  )
}
const rest = (name: RegExp) => screen.getByRole("menuitem", { name })

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
const queued = (over: Partial<PullRequestSnapshot> = {}) =>
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
    }),
    ...over
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

    await openTheRest()
    await userEvent.click(rest(/Close pull request/))
    await userEvent.click(rest(/Confirm/))

    // GitHub has not answered and is not going to until this test says so.
    await waitFor(() => expect(screen.getByText(/ended without landing/)).toBeDefined())
  })

  test("keeps the card closed while GitHub's page data is still behind", async () => {
    /*
     * The success path, which neither test around this one walks.
     *
     * GitHub's page data lags a write by a second or two, so the read this screen
     * sends out the moment a close succeeds is the one most likely to still
     * describe the pull request as open. Believing it took the card straight back
     * to offering Close on something the reader had just closed.
     *
     * The `load` here is that lag written down: it never stops saying open.
     */
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
        actions={{ close: () => Effect.void }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())

    await openTheRest()
    await userEvent.click(rest(/Close pull request/))
    await userEvent.click(rest(/Confirm/))

    await waitFor(() => expect(reads).toBeGreaterThan(1))
    expect(screen.getByText(/ended without landing/)).toBeDefined()
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

    await openTheRest()
    await userEvent.click(rest(/Close pull request/))
    await userEvent.click(rest(/Confirm/))

    await waitFor(() => expect(screen.getByText(/ended without landing/)).toBeDefined())

    ask.fail()

    // The controls are back, and so is the sentence saying why they are. The
    // menu shut when the reader let go of it, so this opens it again.
    await waitFor(() => expect(screen.getByText(/GitHub said no/)).toBeDefined())
    await openTheRest()
    expect(rest(/Close pull request/).getAttribute("data-disabled")).toBeNull()
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

    await openTheRest()
    await userEvent.click(rest(/Close pull request/))
    await userEvent.click(rest(/Confirm/))

    await waitFor(() => expect(screen.getByText("GitHub could not be reached.")).toBeDefined())

    expect(rest(/Close pull request/).getAttribute("data-disabled")).toBeNull()
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

    await openTheRest()
    await userEvent.click(rest(/Mark ready for review/))
    await userEvent.click(rest(/Confirm/))

    // The draft door turning around is the write having landed. Read out of the
    // same menu, which stays open across the press: an item that came back
    // greyed is the fault this was written for.
    await waitFor(() => expect(rest(/Convert to draft/)).toBeDefined())
    expect(rest(/Convert to draft/).getAttribute("data-disabled")).toBeNull()
    expect(rest(/Close pull request/).getAttribute("data-disabled")).toBeNull()
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

    await openTheRest()
    await userEvent.click(rest(/Close pull request/))
    await userEvent.click(rest(/Confirm/))

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

    await openTheRest()
    await userEvent.click(rest(/Close pull request/))
    await userEvent.click(rest(/Confirm/))

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

/*
 * A verdict is the one write on this screen GitHub answers with an empty body and
 * reports nowhere else. Without a read behind it, the merge card at the top of the
 * column went on asking for the approving review that had just been given, and the
 * reader had pressed a button that changed nothing they could see.
 */
describe("a verdict sent from the panel under the conversation", () => {
  test("reads the pull request again, so the merge card hears about it", async () => {
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
        onReview={() => Effect.void}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Verdict" })).toBeDefined())
    expect(reads).toBe(1)

    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    await waitFor(() => expect(reads).toBe(2))
  })

  test("does not read again where GitHub refused the verdict", async () => {
    // Nothing was recorded, so there is nothing new to read. The panel keeps the
    // words and prints what GitHub said, which is the whole report.
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
        onReview={() => Effect.fail(new Error("GitHub said no"))}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Verdict" })).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    await waitFor(() => expect(screen.getByText(/GitHub said no/)).toBeDefined())
    expect(reads).toBe(1)
  })
})

/*
 * Resolving a conversation is the other write that moves the merge card: a rule
 * asking for every conversation to be resolved stops blocking the moment the
 * last one is. The press reached GitHub and the thread folded itself, but the
 * card at the top went on saying the merge was blocked — nothing on the screen
 * read the pull request again to hear otherwise.
 */
describe("a conversation resolved from the column", () => {
  test("reads the pull request again, so the merge card hears about it", async () => {
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({
            snapshot: aSnapshot({
              reference,
              merge: aMergeState(),
              threads: [aThread("t1", [aComment(person("ana"), "this reads oddly", "1001")])]
            })
          })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        onSettle={() => Effect.void}
      />
    )

    await waitFor(() => expect(screen.getAllByText("this reads oddly").length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByText("this reads oddly")[0]!)
    expect(reads).toBe(1)

    await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

    await waitFor(() => expect(reads).toBe(2))
  })

  test("does not read again where GitHub refused the resolve", async () => {
    let reads = 0

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          reads += 1
          return Effect.succeed({
            snapshot: aSnapshot({
              reference,
              merge: aMergeState(),
              threads: [aThread("t1", [aComment(person("ana"), "this reads oddly", "1001")])]
            })
          })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        onSettle={() => Effect.fail(new Error("GitHub said no"))}
      />
    )

    await waitFor(() => expect(screen.getAllByText("this reads oddly").length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByText("this reads oddly")[0]!)

    await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

    await new Promise((rest) => setTimeout(rest, 100))
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

  /*
   * The socket's tokens come off the merge box, so an outage leaves nothing to join.
   *
   * Opening it late is the case worth pinning. The effect is keyed on the tokens
   * themselves — see the dependency array in `PullRequestScreen` — so the move from
   * nothing to a token string re-runs it, and the reader who arrives during an incident
   * is listening again the moment GitHub serves the box, without a remount.
   */
  test("joins the socket on the read that finally brings a merge box", async () => {
    let listening: ReadonlyArray<string> | undefined
    let served = false

    render(
      <PullRequestScreen
        reference={reference}
        load={() => {
          const snapshot = served
            ? queued()
            : queued({ merge: Option.none(), reviews: Option.none() })
          served = true
          return Effect.succeed({ snapshot })
        }}
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        watch={(channels) => {
          listening = channels
          return () => {}
        }}
      />
    )

    await waitFor(() => expect(screen.getByText(/GitHub did not answer for this one/)).toBeDefined())
    expect(listening).toBeUndefined()

    // Bubbling, as the platform's own is: the listener behind `revalidateOnFocus` is on
    // `window`, and a `visibilitychange` fired at the document reaches it by propagation.
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))

    await waitFor(() => expect(listening).toEqual(["queue-channel"]))
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

  /**
   * This screen drew its own version of the card until 2026-08-17, when the copy was
   * measured against a real failure and found to be two cases behind.
   *
   * `useLive` says a screen hands a failure to `ReadFailed`, and every list does. This
   * one had the two cases that existed when it was written, so an organisation waiting
   * to be signed on to and GitHub itself being down both reached every list and
   * neither reached a pull request. Blocking `/changes` on a live page drew "something
   * GitHub sends has changed" over a 503 that had already been asked three times.
   *
   * The two tests below are about the card being the shared one, not about its
   * wording. A third case written next has to reach this screen without anybody
   * remembering that it exists.
   */
  describe("the same card every other screen shows", () => {
    const failingWith = (why: unknown) =>
      render(
        <PullRequestScreen
          reference={reference}
          load={() => Effect.fail(why)}
          fetchDiffs={() => Effect.succeed([])}
          onStepAside={() => {}}
          signedIn={() => true}
        />
      )

    test("says GitHub is having trouble, where GitHub is having trouble", async () => {
      failingWith({ reason: "down", detail: "HTTP 503" })

      await waitFor(() =>
        expect(screen.getByRole("heading").textContent).toContain("GitHub is having trouble")
      )
      expect(screen.getByRole("link", { name: "GitHub status" })).toBeDefined()
    })

    test("names the organisation, where one is waiting to be signed on to", async () => {
      failingWith({ reason: "sign-on", reference, detail: "HTTP 401" })

      await waitFor(() =>
        expect(screen.getByRole("heading").textContent).toContain("acme wants a single sign-on")
      )
    })
  })
})

describe("the choice on a split button and the write underneath it", () => {
  /*
   * The wrapper that gives every verb its optimistic state and its re-read used
   * to take no arguments. Two of the verbs have one, and both are the reader's
   * own choice: which way the repository merges, and which way a branch is
   * caught up. Both arrived at the wrapper and went no further, so GitHub was
   * sent a body with the field missing and chose for itself — while the button
   * went on saying the word the reader picked.
   */
  test("sends the merge method the button is showing", async () => {
    let sent: MergeMethod | undefined
    render(
      <PullRequestScreen
        reference={reference}
        load={() =>
          Effect.succeed({
            snapshot: aSnapshot({
              reference,
              merge: aMergeState({ method: Option.some("SQUASH"), methods: ["SQUASH", "MERGE"] })
            })
          })
        }
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{ merge: (method) => Effect.sync(() => void (sent = method)) }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    await userEvent.click(screen.getByRole("button", { name: /Squash and merge/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm squash and merge/ }))

    await waitFor(() => expect(sent).toBe("SQUASH"))
  })

  test("sends the way the branch is being caught up", async () => {
    let sent: UpdateWay | undefined
    render(
      <PullRequestScreen
        reference={reference}
        load={() =>
          Effect.succeed({
            snapshot: aSnapshot({
              reference,
              merge: aMergeState({
                update: Option.some({
                  how: "REBASE",
                  ways: ["REBASE", "MERGE"],
                  mayUpdate: true,
                  refusal: Option.none()
                })
              })
            })
          })
        }
        fetchDiffs={() => Effect.succeed([])}
        onStepAside={() => {}}
        actions={{ update: (how) => Effect.sync(() => void (sent = how)) }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    await userEvent.click(screen.getByRole("button", { name: /Update branch/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm update branch/ }))

    await waitFor(() => expect(sent).toBe("REBASE"))
  })
})
