import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { aReview } from "../../tests/snapshots"
import type { MergeQueue, MergeState } from "../domain/PullRequest"
import { Merge, whatHappens } from "./Sections"

afterEach(cleanup)

const ready: MergeState = {
  isMergeable: true,
  blockers: [],
  queue: Option.none(),
  autoMerge: Option.none(),
  mayBypass: false,
  update: Option.none(),
  channels: []
}
const button = (name: RegExp) => screen.getByRole("button", { name })

const armed = Option.some({ method: Option.some("SQUASH"), viewerCanCancel: true })

const catchUp = ({
  how = "MERGE" as const,
  mayUpdate = true,
  refusal
}: {
  readonly how?: "MERGE" | "REBASE"
  readonly mayUpdate?: boolean
  readonly refusal?: string
}) => Option.some({ how, mayUpdate, refusal: Option.fromNullishOr(refusal) })

const inA = (queue: Partial<MergeQueue>): MergeState => ({
  ...ready,
  queue: Option.some({
    waiting: false,
    position: Option.none(),
    viewerCanQueue: true,
    mayJoin: true,
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
          ...ready,
          isMergeable: false,
          blockers: [
            {
              name: "Repo rules",
              explanation: "a passing build is required",
              bypassable: false,
              about: Option.none()
            }
          ]
        }}
        actions={{ merge: async () => {} }}
      />
    )

    expect(button(/Squash and merge/)).toHaveProperty("disabled", true)
    expect(screen.getByText("Repo rules")).toBeDefined()
    expect(screen.getByText("a passing build is required")).toBeDefined()
  })

  test("says what is in the way even where a queue is what would be joined", () => {
    render(
      <Merge
        merge={{
          ...inA({ mayJoin: false }),
          isMergeable: false,
          blockers: [
            {
              name: "Repo rules",
              explanation: "A conversation must be resolved.",
              bypassable: false,
              about: Option.none()
            }
          ]
        }}
        actions={{ enqueue: async () => {} }}
      />
    )

    expect(screen.getByText("A conversation must be resolved.")).toBeDefined()
    expect(button(/Merge when ready/)).toHaveProperty("disabled", true)
  })

  test("offers to catch the branch up when the base has moved on", async () => {
    let updated = 0
    let reread = 0
    render(
      <Merge
        merge={{ ...ready, update: catchUp({}) }}
        base="main"
        actions={{
          update: async () => void (updated += 1),
          onChanged: () => void (reread += 1)
        }}
      />
    )

    await userEvent.click(button(/Update branch/))
    expect(screen.getByText(/Merges main into this branch/)).toBeDefined()

    await userEvent.click(button(/Confirm update branch/))

    await waitFor(() => expect(updated).toBe(1))
    // The head commit is a new one, so every check on this page is about to be
    // re-run against something that no longer exists.
    await waitFor(() => expect(reread).toBe(1))
  })

  test("says nothing about updating a branch that is level with its base", () => {
    render(<Merge merge={ready} actions={{ update: async () => {} }} />)

    expect(screen.queryByRole("button", { name: /Update branch/ })).toBeNull()
  })

  test("gives GitHub's reason rather than a grey button with no explanation", () => {
    render(
      <Merge
        merge={{
          ...ready,
          update: catchUp({ mayUpdate: false, refusal: "You have no write access to that fork." })
        }}
        actions={{ update: async () => {} }}
      />
    )

    expect(button(/Update branch/)).toHaveProperty("disabled", true)
    expect(screen.getByText("You have no write access to that fork.")).toBeDefined()
  })

  test("says which blocker the reader's own permissions could go past", () => {
    render(
      <Merge
        merge={{
          ...ready,
          isMergeable: false,
          mayBypass: true,
          blockers: [
            { name: "Repo rules", explanation: "a passing build is required", bypassable: true, about: Option.none() },
            { name: "Review required", explanation: "one approval is required", bypassable: false, about: Option.none() }
          ]
        }}
      />
    )

    expect(screen.getAllByText(/merge past this one/)).toHaveLength(1)
  })

  test("keeps quiet about bypassable rules when the reader may not bypass them", () => {
    render(
      <Merge
        merge={{
          ...ready,
          isMergeable: false,
          mayBypass: false,
          blockers: [
            { name: "Repo rules", explanation: "a passing build is required", bypassable: true, about: Option.none() }
          ]
        }}
      />
    )

    expect(screen.queryByText(/merge past this one/)).toBeNull()
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

describe("what the reviewers decided", () => {
  test("says who approved it, since nothing else on this screen does", () => {
    render(<Merge merge={ready} reviews={[aReview("vijayupadya", "approved")]} />)

    expect(screen.getByText("vijayupadya")).toBeDefined()
    expect(screen.getByText("approved")).toBeDefined()
    expect(screen.getByLabelText("vijayupadya")).toBeDefined()
  })

  test("names a blocking review in the words GitHub uses for it", () => {
    render(<Merge merge={ready} reviews={[aReview("romalpani", "changes-requested")]} />)

    expect(screen.getByText("requested changes")).toBeDefined()
  })

  test("puts the objection above the approval, because it is the one that decides", () => {
    render(
      <Merge
        merge={ready}
        reviews={[aReview("vijayupadya", "approved"), aReview("romalpani", "changes-requested")]}
      />
    )

    const said = screen.getByRole("region", { name: "Merge" }).textContent ?? ""

    expect(said.indexOf("romalpani")).toBeLessThan(said.indexOf("vijayupadya"))
  })

  test("adds no empty row when nobody has reviewed it", () => {
    render(<Merge merge={ready} reviews={[]} />)

    expect(screen.queryByText(/approved|requested changes/)).toBeNull()
  })
})

describe("a repository that merges through a queue", () => {
  test("offers the queue rather than a merge that would jump it", () => {
    render(<Merge merge={inA({})} actions={{ merge: async () => {}, enqueue: async () => {} }} />)

    expect(button(/Merge when ready/)).toBeDefined()
    expect(screen.queryByRole("button", { name: /Squash and merge/ })).toBeNull()
  })

  test("joins the queue on the second press, as merging does", async () => {
    let joined = 0
    render(<Merge merge={inA({})} actions={{ enqueue: async () => void (joined += 1) }} />)

    await userEvent.click(button(/Merge when ready/))
    expect(joined).toBe(0)

    await userEvent.click(button(/Confirm merge when ready/))
    await waitFor(() => expect(joined).toBe(1))
  })

  test("asks for the pull request to be read again once it is queued", async () => {
    // Its place in the line is a fact only GitHub has, and the card cannot
    // invent one: without a re-read it goes on saying "merges through a merge
    // queue" about a pull request that is now third in it.
    let reread = 0
    render(
      <Merge
        merge={inA({})}
        actions={{ enqueue: async () => {}, onChanged: () => void (reread += 1) }}
      />
    )

    await userEvent.click(button(/Merge when ready/))
    await userEvent.click(button(/Confirm merge when ready/))

    await waitFor(() => expect(reread).toBe(1))
  })

  test("asks for it again when it is taken back out", async () => {
    let reread = 0
    render(
      <Merge
        merge={inA({ waiting: true })}
        actions={{ dequeue: async () => {}, onChanged: () => void (reread += 1) }}
      />
    )

    await userEvent.click(button(/Remove from the queue/))
    await userEvent.click(button(/Confirm remove from the queue/))

    await waitFor(() => expect(reread).toBe(1))
  })

  test("does not ask for a re-read when GitHub refused", async () => {
    let reread = 0
    render(
      <Merge
        merge={inA({})}
        actions={{
          enqueue: () => Promise.reject({ detail: "no" }),
          onChanged: () => void (reread += 1)
        }}
      />
    )

    await userEvent.click(button(/Merge when ready/))
    await userEvent.click(button(/Confirm merge when ready/))

    await waitFor(() => expect(screen.getByText("no")).toBeDefined())
    expect(reread).toBe(0)
  })

  test("says what joining the queue actually does", async () => {
    render(<Merge merge={inA({})} base="main" actions={{ enqueue: async () => {} }} />)

    await userEvent.click(button(/Merge when ready/))

    expect(screen.getByText(/tests it against whatever is ahead of it/)).toBeDefined()
  })

  test("says what GitHub said when it refuses to queue it", async () => {
    render(
      <Merge
        merge={inA({})}
        actions={{ enqueue: () => Promise.reject({ detail: "Base branch was modified." }) }}
      />
    )

    await userEvent.click(button(/Merge when ready/))
    await userEvent.click(button(/Confirm merge when ready/))

    await waitFor(() => expect(screen.getByText(/Base branch was modified/)).toBeDefined())
    expect(button(/Merge when ready/)).toBeDefined()
  })

  test("cannot be joined while GitHub says this one may not go in", () => {
    render(<Merge merge={inA({ mayJoin: false })} actions={{ enqueue: async () => {} }} />)

    expect(button(/Merge when ready/)).toHaveProperty("disabled", true)
  })

  test("cannot be joined by someone who may not queue anything", () => {
    render(<Merge merge={inA({ viewerCanQueue: false })} actions={{ enqueue: async () => {} }} />)

    expect(button(/Merge when ready/)).toHaveProperty("disabled", true)
  })

  test("takes it back out again when it is already waiting", async () => {
    let left = 0
    render(
      <Merge
        merge={inA({ waiting: true, position: Option.some(3) })}
        actions={{ dequeue: async () => void (left += 1) }}
      />
    )

    await userEvent.click(button(/Remove from the queue/))
    await userEvent.click(button(/Confirm remove from the queue/))

    await waitFor(() => expect(left).toBe(1))
  })

  test("offers no way in while it is already standing in the line", () => {
    render(
      <Merge merge={inA({ waiting: true })} actions={{ enqueue: async () => {}, dequeue: async () => {} }} />
    )

    expect(screen.queryByRole("button", { name: /Merge when ready/ })).toBeNull()
  })

  test("offers to call off an auto-merge already armed, rather than arming it twice", async () => {
    let called = 0
    render(
      <Merge
        merge={{ ...inA({}), autoMerge: armed }}
        actions={{ enqueue: async () => {}, cancel: async () => void (called += 1) }}
      />
    )

    expect(screen.queryByRole("button", { name: /Merge when ready/ })).toBeNull()

    await userEvent.click(button(/Cancel merge when ready/))
    await userEvent.click(button(/Confirm cancel merge when ready/))

    await waitFor(() => expect(called).toBe(1))
  })

  test("says it is armed, so a pull request that has not moved still reads as done", () => {
    render(<Merge merge={{ ...inA({}), autoMerge: armed }} />)

    expect(screen.getByText(/merges when it is ready/i)).toBeDefined()
  })

  test("still links to the queue GitHub keeps, for what is ahead of this", () => {
    render(<Merge merge={inA({})} actions={{ enqueue: async () => {} }} />)

    const link = screen.getByRole("link", { name: /merge queue/i })
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/queue/main")
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
