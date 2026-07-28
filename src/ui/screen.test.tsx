import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { aSnapshot } from "../../tests/snapshots"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { PullRequestScreen } from "./PullRequestScreen"

afterEach(cleanup)

const reference: PullRequestRef = { owner: "acme", repo: "widgets", number: 7 }

const failing = (signedIn: boolean) =>
  render(
    <PullRequestScreen
      reference={reference}
      load={() => Promise.reject(new Error("HTTP 404"))}
      fetchDiffs={async () => []}
      onStepAside={() => {}}
      signedIn={() => signedIn}
    />
  )

/** A pull request on a repository that merges through a queue. */
const queued = () =>
  aSnapshot({
    reference,
    merge: {
      isMergeable: true,
      blockers: [],
      autoMerge: Option.none(),
      mayBypass: false,
      update: Option.none(),
      channels: ["queue-channel"],
      queue: Option.some({
        waiting: false,
        position: Option.none(),
        viewerCanQueue: true,
        mayJoin: true,
        url: Option.some("https://github.com/acme/widgets/queue/main")
      })
    }
  })

describe("a pull request that changed under a write of ours", () => {
  test("reads it again when the merge card says something moved", async () => {
    let reads = 0
    const load = () => {
      reads += 1
      return Promise.resolve({ snapshot: queued() })
    }

    render(
      <PullRequestScreen
        reference={reference}
        load={load}
        fetchDiffs={async () => []}
        onStepAside={() => {}}
        actions={{ enqueue: async () => {} }}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    expect(reads).toBe(1)

    await userEvent.click(screen.getByRole("button", { name: /Merge when ready/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirm merge when ready/ }))

    await waitFor(() => expect(reads).toBe(2))
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
          return Promise.resolve({ snapshot: queued() })
        }}
        fetchDiffs={async () => []}
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
        load={() => Promise.resolve({ snapshot: queued() })}
        fetchDiffs={async () => []}
        onStepAside={() => {}}
        watch={() => () => void (stopped += 1)}
      />
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Merge" })).toBeDefined())
    unmount()

    expect(stopped).toBe(1)
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
