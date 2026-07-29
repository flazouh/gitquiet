import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { aReview } from "../../tests/snapshots"
import type { MergeQueue, MergeState } from "../domain/PullRequest"
import { Merge } from "./Merge"

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

const behind: MergeState = { ...ready, update: catchUp({}) }

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
    render(<Merge state="open" merge={ready} actions={{ merge: async () => void (merges += 1) }} />)

    await userEvent.click(button(/Squash and merge/))

    expect(merges).toBe(0)
    expect(button(/Confirm squash and merge/)).toBeDefined()
    expect(button(/Do not squash and merge/)).toBeDefined()
  })

  test("changes the word on the half that acts, so being armed looks like something", async () => {
    render(<Merge merge={ready} state="open" actions={{ toDraft: async () => {} }} />)

    // Both words are there the whole time — the swap is one rising as the other
    // leaves — so which is shown is the one not hidden from a reader.
    const word = (name: RegExp, said: string) => within(button(name)).getByText(said)

    expect(word(/Convert to draft/, "Confirm").getAttribute("aria-hidden")).toBe("true")
    expect(word(/Convert to draft/, "Convert to draft").getAttribute("aria-hidden")).toBeNull()

    await userEvent.click(button(/Convert to draft/))

    expect(word(/Confirm convert to draft/, "Confirm").getAttribute("aria-hidden")).toBeNull()
    expect(word(/Confirm convert to draft/, "Convert to draft").getAttribute("aria-hidden")).toBe(
      "true"
    )
  })

  test("asks where the button already was, rather than in a card of its own", async () => {
    render(
      <Merge state="open" merge={ready} actions={{ merge: async () => {}, close: async () => {} }} />
    )

    await userEvent.click(button(/Close pull request/))

    const yes = button(/Confirm close pull request/)
    const no = button(/Do not close pull request/)
    // The pair is one control in the place the single button stood: the way out
    // is inside it, and the buttons beside it are not.
    const control = yes.parentElement
    expect(control?.contains(no)).toBe(true)
    expect(control?.contains(button(/Squash and merge/))).toBe(false)
    // And the buttons it stands beside are left alone, still saying what they do.
    expect(button(/Squash and merge/)).toBeDefined()
  })

  test("merges on the second press", async () => {
    let merges = 0
    render(<Merge state="open" merge={ready} actions={{ merge: async () => void (merges += 1) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(merges).toBe(1))
    await waitFor(() => expect(button(/Merged/)).toBeDefined())
  })

  test("lets the page be read again once it lands", async () => {
    let read = 0
    render(
      <Merge state="open" merge={ready} actions={{ merge: async () => {}, onMerged: () => void (read += 1) }} />
    )

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(read).toBe(1))
  })

  test("backs out without merging", async () => {
    let merges = 0
    render(<Merge state="open" merge={ready} actions={{ merge: async () => void (merges += 1) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Do not squash and merge/))

    expect(merges).toBe(0)
    expect(button(/Squash and merge/)).toBeDefined()
  })

  test("says what GitHub said when it refuses", async () => {
    render(
      <Merge state="open"
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
    render(<Merge state="open" merge={ready} actions={{ merge: () => Promise.reject(new Error("boom")) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(screen.getByText(/could not be reached/)).toBeDefined())
  })

  test("cannot be pressed while GitHub is blocking the merge", () => {
    render(
      <Merge state="open"
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
      <Merge state="open"
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
      <Merge state="open"
        merge={{ ...ready, update: catchUp({}) }}
        actions={{
          update: async () => void (updated += 1),
          onChanged: () => void (reread += 1)
        }}
      />
    )

    await userEvent.click(button(/Update branch/))

    await userEvent.click(button(/Confirm update branch/))

    await waitFor(() => expect(updated).toBe(1))
    // The head commit is a new one, so every check on this page is about to be
    // re-run against something that no longer exists.
    await waitFor(() => expect(reread).toBe(1))
  })

  test("says nothing about updating a branch that is level with its base", () => {
    render(<Merge state="open" merge={ready} actions={{ update: async () => {} }} />)

    expect(screen.queryByRole("button", { name: /Update branch/ })).toBeNull()
  })

  test("gives GitHub's reason rather than a grey button with no explanation", () => {
    render(
      <Merge state="open"
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
      <Merge state="open"
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
      <Merge state="open"
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

  test("offers to mark a draft ready, that being what is holding it up", async () => {
    let marked = 0
    let reread = 0
    render(
      <Merge
        merge={ready}
        state="draft"
        actions={{
          markReady: async () => void (marked += 1),
          onChanged: () => void (reread += 1)
        }}
      />
    )

    await userEvent.click(button(/Mark ready for review/))
    expect(marked).toBe(0)

    await userEvent.click(button(/Confirm mark ready for review/))

    await waitFor(() => expect(marked).toBe(1))
    await waitFor(() => expect(reread).toBe(1))
  })

  test("offers to put an open one back into draft, which is the same door", async () => {
    // The state a draft is stuck in is one somebody chose, and a control that
    // only goes one way turns a mistake into a trip to GitHub.
    let drafted = 0
    render(
      <Merge merge={ready} state="open" actions={{ toDraft: async () => void (drafted += 1) }} />
    )

    await userEvent.click(button(/Convert to draft/))
    await userEvent.click(button(/Confirm convert to draft/))

    await waitFor(() => expect(drafted).toBe(1))
  })

  test("says nothing about drafts once it has been merged", () => {
    render(<Merge merge={ready} state="merged" actions={{ markReady: async () => {} }} />)

    expect(screen.queryByText(/Mark ready for review/)).toBeNull()
    expect(screen.queryByText(/Convert to draft/)).toBeNull()
  })

  test("asks a second time before it closes the pull request", async () => {
    let closes = 0
    render(<Merge state="open" merge={ready} actions={{ close: async () => void (closes += 1) }} />)

    await userEvent.click(button(/Close pull request/))

    expect(closes).toBe(0)
    expect(button(/Confirm close pull request/)).toBeDefined()
  })

  test("closes it on the second press, and asks for the page again", async () => {
    let closes = 0
    let reread = 0
    render(
      <Merge state="open"
        merge={ready}
        actions={{
          close: async () => void (closes += 1),
          onChanged: () => void (reread += 1)
        }}
      />
    )

    await userEvent.click(button(/Close pull request/))
    await userEvent.click(button(/Confirm close pull request/))

    await waitFor(() => expect(closes).toBe(1))
    // What is on the page — the merge card, the state in the header — describes
    // a pull request that is now closed, and only GitHub can say what it says
    // about a closed one.
    await waitFor(() => expect(reread).toBe(1))
  })

  test("says what GitHub said when it refuses to close it", async () => {
    render(
      <Merge state="open"
        merge={ready}
        actions={{
          close: () => Promise.reject(new Error("nope")).then(() => {}),
          onChanged: () => {}
        }}
      />
    )

    await userEvent.click(button(/Close pull request/))
    await userEvent.click(button(/Confirm close pull request/))

    await waitFor(() => expect(screen.getByText("GitHub could not be reached.")).toBeDefined())
  })

  test("cannot be pressed when nothing is wired to it", () => {
    render(<Merge state="open" merge={ready} />)

    expect(button(/Squash and merge/)).toHaveProperty("disabled", true)
    expect(button(/Close pull request/)).toHaveProperty("disabled", true)
  })

})

describe("a pull request that is past deciding", () => {
  test("offers nothing to press once it has been merged", () => {
    // The one that sent us looking: the card said "Merged" at the top and
    // "Merge when ready" at the bottom, because each button worked its own
    // answer out of the merge state and none of them asked whether there was
    // still a decision to make.
    render(
      <Merge
        merge={inA({})}
        state="merged"
        actions={{ merge: async () => {}, enqueue: async () => {}, close: async () => {} }}
      />
    )

    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  test("says which way it went, rather than going quiet", () => {
    render(<Merge merge={ready} state="merged" />)

    expect(screen.getByText(/merged/i)).toBeDefined()
  })

  test("says the same of a closed one", () => {
    render(<Merge merge={behind} state="closed" actions={{ update: async () => {} }} />)

    expect(screen.getByText(/closed/i)).toBeDefined()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  test("keeps the queue's explanation off a pull request that has already landed", () => {
    render(<Merge merge={inA({ waiting: true })} state="merged" />)

    expect(screen.queryByText(/its turn comes/)).toBeNull()
    expect(screen.queryByText(/position/)).toBeNull()
  })

  test("says nothing about catching up a branch that has landed", () => {
    render(<Merge merge={behind} state="merged" />)

    expect(screen.queryByText(/base branch has moved on/)).toBeNull()
  })

  test("still says who reviewed it, which is a fact about the reading", () => {
    render(<Merge merge={ready} state="merged" reviews={[aReview("vijayupadya", "approved")]} />)

    expect(screen.getByText("vijayupadya")).toBeDefined()
  })
})

describe("what the reviewers decided", () => {
  test("says who approved it, since nothing else on this screen does", () => {
    render(<Merge state="open" merge={ready} reviews={[aReview("vijayupadya", "approved")]} />)

    expect(screen.getByText("vijayupadya")).toBeDefined()
    expect(screen.getByText("approved")).toBeDefined()
    expect(screen.getByLabelText("vijayupadya")).toBeDefined()
  })

  test("names a blocking review in the words GitHub uses for it", () => {
    render(<Merge state="open" merge={ready} reviews={[aReview("romalpani", "changes-requested")]} />)

    expect(screen.getByText("requested changes")).toBeDefined()
  })

  test("puts the objection above the approval, because it is the one that decides", () => {
    render(
      <Merge state="open"
        merge={ready}
        reviews={[aReview("vijayupadya", "approved"), aReview("romalpani", "changes-requested")]}
      />
    )

    const said = screen.getByRole("region", { name: "Merge" }).textContent ?? ""

    expect(said.indexOf("romalpani")).toBeLessThan(said.indexOf("vijayupadya"))
  })

  test("adds no empty row when nobody has reviewed it", () => {
    render(<Merge state="open" merge={ready} reviews={[]} />)

    expect(screen.queryByText(/approved|requested changes/)).toBeNull()
  })
})

describe("a repository that merges through a queue", () => {
  test("offers the queue rather than a merge that would jump it", () => {
    render(<Merge state="open" merge={inA({})} actions={{ merge: async () => {}, enqueue: async () => {} }} />)

    expect(button(/Merge when ready/)).toBeDefined()
    expect(screen.queryByRole("button", { name: /Squash and merge/ })).toBeNull()
  })

  test("joins the queue on the second press, as merging does", async () => {
    let joined = 0
    render(<Merge state="open" merge={inA({})} actions={{ enqueue: async () => void (joined += 1) }} />)

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
      <Merge state="open"
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
      <Merge state="open"
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
      <Merge state="open"
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

  test("says what GitHub said when it refuses to queue it", async () => {
    render(
      <Merge state="open"
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
    render(<Merge state="open" merge={inA({ mayJoin: false })} actions={{ enqueue: async () => {} }} />)

    expect(button(/Merge when ready/)).toHaveProperty("disabled", true)
  })

  test("cannot be joined by someone who may not queue anything", () => {
    render(<Merge state="open" merge={inA({ viewerCanQueue: false })} actions={{ enqueue: async () => {} }} />)

    expect(button(/Merge when ready/)).toHaveProperty("disabled", true)
  })

  test("takes it back out again when it is already waiting", async () => {
    let left = 0
    render(
      <Merge state="open"
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
      <Merge state="open" merge={inA({ waiting: true })} actions={{ enqueue: async () => {}, dequeue: async () => {} }} />
    )

    expect(screen.queryByRole("button", { name: /Merge when ready/ })).toBeNull()
  })

  test("offers to call off an auto-merge already armed, rather than arming it twice", async () => {
    let called = 0
    render(
      <Merge state="open"
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
    render(<Merge state="open" merge={{ ...inA({}), autoMerge: armed }} />)

    expect(screen.getByText(/merges when it is ready/i)).toBeDefined()
  })

  test("still links to the queue GitHub keeps, for what is ahead of this", () => {
    render(<Merge state="open" merge={inA({})} actions={{ enqueue: async () => {} }} />)

    const link = screen.getByRole("link", { name: /merge queue/i })
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/queue/main")
  })

  test("says where in the line it is already waiting", () => {
    render(<Merge state="open" merge={inA({ waiting: true, position: Option.some(3) })} />)

    expect(screen.getByText(/position 3/)).toBeDefined()
  })

  test("says it is waiting even when GitHub does not say where", () => {
    render(<Merge state="open" merge={inA({ waiting: true })} />)

    expect(screen.getByText(/waiting in the merge queue/i)).toBeDefined()
    expect(screen.queryByText(/position/)).toBeNull()
  })
})
