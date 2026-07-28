import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import type { MergeQueue, MergeState } from "../domain/PullRequest"
import { Merge, whatHappens } from "./Sections"

afterEach(cleanup)

const ready: MergeState = { isMergeable: true, blockers: [], queue: Option.none() }
const button = (name: RegExp) => screen.getByRole("button", { name })

const inA = (queue: Partial<MergeQueue>): MergeState => ({
  ...ready,
  queue: Option.some({
    waiting: false,
    position: Option.none(),
    viewerCanQueue: true,
    url: Option.some("https://github.com/o/r/queue/main"),
    ...queue
  })
})

describe("the merge card", () => {
  test("asks a second time before it merges anything", async () => {
    let merges = 0
    render(<Merge merge={ready} actions={{ merge: async () => void (merges += 1) }} />)

    await userEvent.click(button(/Squash and merge/))

    expect(merges).toBe(0)
    expect(button(/Confirm squash and merge/)).toBeDefined()
    expect(screen.getByText(/Undoing it means opening a revert on GitHub/)).toBeDefined()
  })

  test("merges on the second press", async () => {
    let merges = 0
    render(<Merge merge={ready} actions={{ merge: async () => void (merges += 1) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(merges).toBe(1))
    await waitFor(() => expect(button(/Merged/)).toBeDefined())
  })

  test("lets the page be read again once it lands", async () => {
    let read = 0
    render(
      <Merge merge={ready} actions={{ merge: async () => {}, onMerged: () => void (read += 1) }} />
    )

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(read).toBe(1))
  })

  test("backs out without merging", async () => {
    let merges = 0
    render(<Merge merge={ready} actions={{ merge: async () => void (merges += 1) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Cancel/))

    expect(merges).toBe(0)
    expect(button(/Squash and merge/)).toBeDefined()
  })

  test("says what GitHub said when it refuses", async () => {
    render(
      <Merge
        merge={ready}
        actions={{
          merge: () => Promise.reject({ detail: "Required status check is failing." })
        }}
      />
    )

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(screen.getByText(/Required status check is failing/)).toBeDefined())
    // Back to a button that can be pressed again, rather than stuck mid-merge.
    expect(button(/Squash and merge/)).toBeDefined()
  })

  test("says something plain when the failure carries no sentence", async () => {
    render(<Merge merge={ready} actions={{ merge: () => Promise.reject(new Error("boom")) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(screen.getByText(/could not be reached/)).toBeDefined())
  })

  test("cannot be pressed while GitHub is blocking the merge", () => {
    render(
      <Merge
        merge={{
          isMergeable: false,
          blockers: [{ name: "Repo rules", explanation: "a passing build is required" }],
          queue: Option.none()
        }}
        actions={{ merge: async () => {} }}
      />
    )

    expect(button(/Squash and merge/)).toHaveProperty("disabled", true)
  })

  test("cannot be pressed when nothing is wired to it", () => {
    render(<Merge merge={ready} />)

    expect(button(/Squash and merge/)).toHaveProperty("disabled", true)
    expect(button(/Close pull request/)).toHaveProperty("disabled", true)
  })

  test("names the branch and counts the commits it would flatten", async () => {
    render(
      <Merge merge={ready} base="main" commits={4} actions={{ merge: async () => {} }} />
    )

    await userEvent.click(button(/Squash and merge/))

    expect(screen.getByText(/Combines 4 commits into one and adds it to main/)).toBeDefined()
  })

  test("says nothing about checks when they have all finished", async () => {
    render(<Merge merge={ready} actions={{ merge: async () => {} }} />)

    await userEvent.click(button(/Squash and merge/))

    expect(screen.queryByText(/not finished/)).toBeNull()
  })
})

describe("a repository that merges through a queue", () => {
  test("says so, rather than offering a merge that would jump it", () => {
    render(<Merge merge={inA({})} actions={{ merge: async () => {} }} />)

    expect(screen.getByText(/merge queue/i)).toBeDefined()
    // Gone rather than greyed out: the paragraph above it has just said that
    // merging from here is not offered, and a disabled button saying the same
    // thing is a third control competing for a column this narrow.
    expect(screen.queryByRole("button", { name: /Squash and merge/ })).toBeNull()
  })

  test("sends the reader to the queue GitHub keeps", () => {
    render(<Merge merge={inA({})} actions={{ merge: async () => {} }} />)

    const link = screen.getByRole("link", { name: /Merge when ready/ })
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/queue/main")
  })

  test("falls back to the pull request when the queue has no page of its own", () => {
    render(
      <Merge
        merge={inA({ url: Option.none() })}
        url="https://github.com/o/r/pull/7"
        actions={{ merge: async () => {} }}
      />
    )

    expect(screen.getByRole("link", { name: /Merge when ready/ }).getAttribute("href")).toBe(
      "https://github.com/o/r/pull/7"
    )
  })

  test("says where in the line it is already waiting", () => {
    render(<Merge merge={inA({ waiting: true, position: Option.some(3) })} />)

    expect(screen.getByText(/position 3/)).toBeDefined()
  })

  test("says it is waiting even when GitHub does not say where", () => {
    render(<Merge merge={inA({ waiting: true })} />)

    expect(screen.getByText(/waiting in the merge queue/i)).toBeDefined()
    expect(screen.queryByText(/position/)).toBeNull()
  })
})

describe("what the second press agrees to", () => {
  test("counts one commit as one, not as a combination", () => {
    expect(whatHappens({ base: "main", commits: 1, running: 0 })).toStartWith(
      "Adds this branch's one commit to main."
    )
  })

  test("falls back to the base branch when its name has not arrived", () => {
    expect(whatHappens({ commits: 0, running: 0 })).toStartWith(
      "Squashes this branch into the base branch."
    )
  })

  test("warns about the checks that have not finished, and counts them", () => {
    expect(whatHappens({ base: "main", commits: 2, running: 2 })).toEndWith(
      "2 checks have not finished, and merging now does not wait for them."
    )
  })

  test("warns about a single unfinished check in the singular", () => {
    expect(whatHappens({ base: "main", commits: 2, running: 1 })).toEndWith(
      "One check has not finished, and merging now does not wait for it."
    )
  })
})
