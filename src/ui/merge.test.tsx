import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { aReview } from "../../tests/snapshots"
import type {
  ChangedFile,
  MergeBlocker,
  MergeQueue,
  MergeState,
  StackLayer
} from "../domain/PullRequest"
import { Merge } from "./Merge"

afterEach(cleanup)

const ready: MergeState = {
  isMergeable: true,
  blockers: [],
  queue: Option.none(),
  autoMerge: Option.none(),
  mayBypass: false,
  update: Option.none(),
  channels: [],
  stack: Option.none(),
  method: Option.some("SQUASH")
}
const button = (name: RegExp) => screen.getByRole("button", { name })

/**
 * A blocker as the snapshot builds them, saying only the part a test is about.
 *
 * Written out in full in five tests, none of which was about the files a
 * conflict names or about whose editor could fix it, so both arrived as two
 * lines of noise in each of them.
 */
const blocking = (over: Partial<MergeBlocker> & { readonly name: string }): MergeBlocker => ({
  explanation: "",
  about: Option.none(),
  bypassable: false,
  files: [],
  mayResolve: false,
  ...over
})

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

/*
 * The button used to say "Squash and merge" on every repository there is.
 *
 * It posted `SQUASH` to match, so on a repository that allows only a merge commit
 * the one control that lands a change could not work, and the word above it named
 * a commit GitHub would never write. Which ways in are allowed is the merge box's
 * answer, and their own three words for them are the ones on their own button.
 */
describe("the word on the button that lands the change", () => {
  const landingWith = (method: "MERGE" | "SQUASH" | "REBASE"): MergeState => ({
    ...ready,
    method: Option.some(method)
  })

  test("names the merge commit, where that is what the repository writes", () => {
    render(<Merge state="open" merge={Option.some(landingWith("MERGE"))} actions={{ merge: () => Effect.void }} />)

    expect(button(/Merge pull request/)).toBeDefined()
    expect(screen.queryByRole("button", { name: /Squash and merge/ })).toBeNull()
  })

  test("names the rebase, where that is what the repository writes", () => {
    render(<Merge state="open" merge={Option.some(landingWith("REBASE"))} actions={{ merge: () => Effect.void }} />)

    expect(button(/Rebase and merge/)).toBeDefined()
  })

  test("asks a second time in its own words", async () => {
    render(<Merge state="open" merge={Option.some(landingWith("MERGE"))} actions={{ merge: () => Effect.void }} />)

    await userEvent.click(button(/Merge pull request/))

    expect(button(/Confirm merge pull request/)).toBeDefined()
  })

  test("sends the way it named, rather than a word of its own", async () => {
    const sent: Array<string> = []
    render(
      <Merge state="open"
        merge={Option.some(landingWith("REBASE"))}
        actions={{ merge: (method) => Effect.sync(() => void sent.push(method)) }}
      />
    )

    await userEvent.click(button(/Rebase and merge/))
    await userEvent.click(button(/Confirm rebase and merge/))

    await waitFor(() => expect(sent).toEqual(["REBASE"]))
  })

  test("cannot be pressed where GitHub named no way of merging at all", () => {
    render(
      <Merge state="open"
        merge={Option.some({ ...ready, method: Option.none() })}
        actions={{ merge: () => Effect.void }}
      />
    )

    expect(button(/Merge/)).toHaveProperty("disabled", true)
  })
})

describe("the merge card", () => {
  test("builds its hidden route over separate preparation stages", () => {
    const view = render(
      <Merge state="open" merge={Option.some(ready)} prepareThrough={0} />
    )

    expect(screen.getByRole("region", { name: "Merge" })).toBeDefined()
    expect(screen.queryByRole("button", { name: /Squash and merge/ })).toBeNull()

    view.rerender(
      <Merge state="open" merge={Option.some(ready)} prepareThrough={4} />
    )

    expect(button(/Squash and merge/)).toBeDefined()
  })

  test("asks a second time before it merges anything", async () => {
    let merges = 0
    render(<Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.sync(() => void (merges += 1)) }} />)

    await userEvent.click(button(/Squash and merge/))

    expect(merges).toBe(0)
    expect(button(/Confirm squash and merge/)).toBeDefined()
    expect(button(/Do not squash and merge/)).toBeDefined()
  })

  test("changes the word on the half that acts, so being armed looks like something", async () => {
    render(<Merge merge={Option.some(ready)} state="open" actions={{ toDraft: () => Effect.void }} />)

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
      <Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.void, close: () => Effect.void }} />
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
    render(<Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.sync(() => void (merges += 1)) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(merges).toBe(1))
    await waitFor(() => expect(button(/Merged/)).toBeDefined())
  })

  test("turns a circle on the button while GitHub has not answered", async () => {
    // The word on its own was the whole of it: "Merging…" on a button greyed out,
    // over a card that looks exactly as it did, for as long as GitHub takes.
    render(<Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.never }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(button(/Merging…/).querySelector(".t-rotate")).not.toBeNull())
  })

  test("holds every word it can say from the first frame, so no press moves it", () => {
    /*
     * The verb, "Confirm", the verb in flight and what GitHub agreed to, all in
     * one cell. Four words written one at a time is four widths, and each of them
     * arrives under the pointer of somebody who is deciding whether to press
     * again — on a row that wraps, taking the two buttons beside it along.
     */
    render(<Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.void }} />)

    const words = button(/Squash and merge/).querySelectorAll(".t-says > .t-say")

    expect([...words].map((word) => word.textContent)).toEqual([
      "Squash and merge",
      "Confirm",
      "Merging…",
      "Merged"
    ])
  })

  test("holds the circle's room in the word that waits, and turns nothing before then", () => {
    render(<Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.void }} />)

    const yes = button(/Squash and merge/)

    expect(yes.querySelector("[data-room]")).not.toBeNull()
    expect(yes.querySelector(".t-rotate")).toBeNull()
  })

  test("lets the page be read again once it lands", async () => {
    let read = 0
    render(
      <Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.void, onMerged: () => void (read += 1) }} />
    )

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(read).toBe(1))
  })

  test("backs out without merging", async () => {
    let merges = 0
    render(<Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.sync(() => void (merges += 1)) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Do not squash and merge/))

    expect(merges).toBe(0)
    expect(button(/Squash and merge/)).toBeDefined()
  })

  test("says what GitHub said when it refuses", async () => {
    render(
      <Merge state="open"
        merge={Option.some(ready)}
        actions={{
          merge: () => Effect.fail({ detail: "Required status check is failing." })
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
    render(<Merge state="open" merge={Option.some(ready)} actions={{ merge: () => Effect.fail(new Error("boom")) }} />)

    await userEvent.click(button(/Squash and merge/))
    await userEvent.click(button(/Confirm squash and merge/))

    await waitFor(() => expect(screen.getByText(/could not be reached/)).toBeDefined())
  })

  test("cannot be pressed while GitHub is blocking the merge", () => {
    render(
      <Merge state="open"
        merge={Option.some({
          ...ready,
          isMergeable: false,
          blockers: [
            blocking({ name: "Repo rules", explanation: "a passing build is required" })
          ]
        })}
        actions={{ merge: () => Effect.void }}
      />
    )

    expect(button(/Squash and merge/)).toHaveProperty("disabled", true)
    expect(screen.getByText("Repo rules")).toBeDefined()
    expect(screen.getByText("a passing build is required")).toBeDefined()
  })

  test("says what is in the way even where a queue is what would be joined", () => {
    render(
      <Merge state="open"
        merge={Option.some({
          ...inA({ mayJoin: false }),
          isMergeable: false,
          blockers: [
            blocking({ name: "Repo rules", explanation: "A conversation must be resolved." })
          ]
        })}
        actions={{ enqueue: () => Effect.void }}
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
        merge={Option.some({ ...ready, update: catchUp({}) })}
        actions={{
          update: () => Effect.sync(() => void (updated += 1)),
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
    render(<Merge state="open" merge={Option.some(ready)} actions={{ update: () => Effect.void }} />)

    expect(screen.queryByRole("button", { name: /Update branch/ })).toBeNull()
  })

  test("gives GitHub's reason rather than a grey button with no explanation", () => {
    render(
      <Merge state="open"
        merge={Option.some({
          ...ready,
          update: catchUp({ mayUpdate: false, refusal: "You have no write access to that fork." })
        })}
        actions={{ update: () => Effect.void }}
      />
    )

    expect(button(/Update branch/)).toHaveProperty("disabled", true)
    expect(screen.getByText("You have no write access to that fork.")).toBeDefined()
  })

  test("says which blocker the reader's own permissions could go past", () => {
    render(
      <Merge state="open"
        merge={Option.some({
          ...ready,
          isMergeable: false,
          mayBypass: true,
          blockers: [
            blocking({ name: "Repo rules", explanation: "a passing build is required", bypassable: true }),
            blocking({ name: "Review required", explanation: "one approval is required" })
          ]
        })}
      />
    )

    expect(screen.getAllByText(/merge past this one/)).toHaveLength(1)
  })

  test("keeps quiet about bypassable rules when the reader may not bypass them", () => {
    render(
      <Merge state="open"
        merge={Option.some({
          ...ready,
          isMergeable: false,
          mayBypass: false,
          blockers: [
            blocking({ name: "Repo rules", explanation: "a passing build is required", bypassable: true })
          ]
        })}
      />
    )

    expect(screen.queryByText(/merge past this one/)).toBeNull()
  })

  /*
   * GitHub's own page lists the paths and this card said only that a conflict
   * exists, which left a reader to leave for their page to find out whether it
   * was one lock file or eleven source files.
   */
  const conflicted = (over: Partial<MergeBlocker> = {}): MergeState => ({
    ...ready,
    isMergeable: false,
    blockers: [
      blocking({
        name: "Pull request merge conflict state",
        explanation: "Pull request cannot be merged because it has a merge conflict.",
        files: ["src/ui/Merge.tsx", "src/domain/PullRequest.ts"],
        ...over
      })
    ]
  })

  test("lists the files a conflict is about, in GitHub's order", () => {
    render(<Merge state="open" merge={Option.some(conflicted())} />)

    const paths = screen.getAllByRole("listitem").map((one) => one.textContent)
    expect(paths).toContain("src/ui/Merge.tsx")
    expect(paths).toContain("src/domain/PullRequest.ts")
    expect(paths.indexOf("src/ui/Merge.tsx")).toBeLessThan(
      paths.indexOf("src/domain/PullRequest.ts")
    )
  })

  test("does not count them, the list being the count", () => {
    render(<Merge state="open" merge={Option.some(conflicted())} />)

    expect(screen.queryByText(/2 files/)).toBeNull()
  })

  /** As the snapshot carries them, with only the fields these rows read said. */
  const changed = (
    path: string,
    over: Partial<ChangedFile> = {}
  ): ChangedFile => ({
    path,
    digest: `d-${path}`,
    changeType: "modified",
    linesAdded: 0,
    linesDeleted: 0,
    readByViewer: false,
    diff: Option.none(),
    ...over
  })

  test("says how big each conflicted file is, off the files already read", () => {
    // The difference between a conflict in a lock file nobody reads and one in
    // the file the pull request is about.
    render(
      <Merge
        state="open"
        merge={Option.some(conflicted())}
        files={[
          changed("src/ui/Merge.tsx", { linesAdded: 12, linesDeleted: 3 }),
          changed("src/domain/PullRequest.ts", { linesAdded: 4, linesDeleted: 0 })
        ]}
      />
    )

    const rows = screen.getAllByRole("listitem").map((one) => one.textContent)
    expect(rows.some((row) => row?.includes("Merge.tsx") && row.includes("+12"))).toBe(true)
    expect(rows.some((row) => row?.includes("Merge.tsx") && row.includes("−3"))).toBe(true)
    expect(rows.some((row) => row?.includes("PullRequest.ts") && row.includes("+4"))).toBe(true)
  })

  test("says how a conflicted file changed, where it is not a plain edit", () => {
    render(
      <Merge
        state="open"
        merge={Option.some(conflicted({ files: ["src/ui/Merge.tsx", "src/domain/PullRequest.ts"] }))}
        files={[
          changed("src/ui/Merge.tsx", { changeType: "renamed" }),
          changed("src/domain/PullRequest.ts", { changeType: "modified" })
        ]}
      />
    )

    // "modified" is what almost every row would say, so it says nothing.
    expect(screen.getByText("renamed")).toBeDefined()
    expect(screen.queryByText("modified")).toBeNull()
  })

  /*
   * A file deleted on the base branch conflicts with a branch that never touched
   * it, so GitHub can name a path this pull request does not change. Inventing
   * `+0 −0` for it would be the card answering what it was not told.
   */
  test("invents no counts for a conflicted path this pull request does not change", () => {
    render(
      <Merge
        state="open"
        merge={Option.some(conflicted({ files: ["deleted/on/main.ts"] }))}
        files={[changed("src/ui/Merge.tsx", { linesAdded: 12, linesDeleted: 3 })]}
      />
    )

    const row = screen.getAllByRole("listitem").find((one) => one.textContent?.includes("main.ts"))
    expect(row).toBeDefined()
    expect(row?.textContent).not.toContain("+0")
    expect(row?.textContent).not.toContain("−0")
  })

  test("draws the paths and no metadata where nobody handed the card any files", () => {
    render(<Merge state="open" merge={Option.some(conflicted())} />)

    const rows = screen.getAllByRole("listitem").map((one) => one.textContent)
    expect(rows.some((row) => row?.includes("Merge.tsx"))).toBe(true)
    expect(rows.every((row) => !row?.includes("+"))).toBe(true)
  })

  test("offers their editor where GitHub says it could resolve them", () => {
    render(
      <Merge
        state="open"
        merge={Option.some(conflicted({ mayResolve: true }))}
        url="https://github.com/o/r/pull/12"
      />
    )

    const link = screen.getByRole("link", { name: /Resolve them on GitHub/ })
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/pull/12/conflicts")
  })

  /*
   * `placeOwning` claims that address for nobody, so a press followed in place
   * would spend the reader's page on a screen this extension does not draw.
   */
  test("leaves for their editor in a tab of its own", () => {
    render(
      <Merge
        state="open"
        merge={Option.some(conflicted({ mayResolve: true }))}
        url="https://github.com/o/r/pull/12"
      />
    )

    const link = screen.getByRole("link", { name: /Resolve them on GitHub/ })
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noreferrer")
  })

  /*
   * Null from GitHub is them declining to say, which the snapshot reads as false.
   * Sending a reader to an editor that then refuses them is the one thing this
   * must not do.
   */
  test("offers no editor where GitHub did not say it could", () => {
    render(
      <Merge
        state="open"
        merge={Option.some(conflicted({ mayResolve: false }))}
        url="https://github.com/o/r/pull/12"
      />
    )

    expect(screen.queryByRole("link", { name: /Resolve them/ })).toBeNull()
  })

  test("offers no editor where nobody said where this pull request is", () => {
    render(<Merge state="open" merge={Option.some(conflicted({ mayResolve: true }))} />)

    expect(screen.queryByRole("link", { name: /Resolve them/ })).toBeNull()
  })

  test("offers to mark a draft ready, that being what is holding it up", async () => {
    let marked = 0
    let reread = 0
    render(
      <Merge
        merge={Option.some(ready)}
        state="draft"
        actions={{
          markReady: () => Effect.sync(() => void (marked += 1)),
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
      <Merge merge={Option.some(ready)} state="open" actions={{ toDraft: () => Effect.sync(() => void (drafted += 1)) }} />
    )

    await userEvent.click(button(/Convert to draft/))
    await userEvent.click(button(/Confirm convert to draft/))

    await waitFor(() => expect(drafted).toBe(1))
  })

  test("says nothing about drafts once it has been merged", () => {
    render(<Merge merge={Option.some(ready)} state="merged" actions={{ markReady: () => Effect.void }} />)

    expect(screen.queryByText(/Mark ready for review/)).toBeNull()
    expect(screen.queryByText(/Convert to draft/)).toBeNull()
  })

  test("asks a second time before it closes the pull request", async () => {
    let closes = 0
    render(<Merge state="open" merge={Option.some(ready)} actions={{ close: () => Effect.sync(() => void (closes += 1)) }} />)

    await userEvent.click(button(/Close pull request/))

    expect(closes).toBe(0)
    expect(button(/Confirm close pull request/)).toBeDefined()
  })

  test("closes it on the second press, and asks for the page again", async () => {
    let closes = 0
    let reread = 0
    render(
      <Merge state="open"
        merge={Option.some(ready)}
        actions={{
          close: () => Effect.sync(() => void (closes += 1)),
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
        merge={Option.some(ready)}
        actions={{
          close: () => Effect.fail(new Error("nope")),
          onChanged: () => {}
        }}
      />
    )

    await userEvent.click(button(/Close pull request/))
    await userEvent.click(button(/Confirm close pull request/))

    await waitFor(() => expect(screen.getByText("GitHub could not be reached.")).toBeDefined())
  })

  test("cannot be pressed when nothing is wired to it", () => {
    render(<Merge state="open" merge={Option.some(ready)} />)

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
        merge={Option.some(inA({}))}
        state="merged"
        actions={{ merge: () => Effect.void, enqueue: () => Effect.void, close: () => Effect.void }}
      />
    )

    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  test("says which way it went, rather than going quiet", () => {
    render(<Merge merge={Option.some(ready)} state="merged" />)

    expect(screen.getByText(/merged/i)).toBeDefined()
  })

  test("says the same of a closed one", () => {
    render(<Merge merge={Option.some(behind)} state="closed" actions={{ update: () => Effect.void }} />)

    expect(screen.getByText(/closed/i)).toBeDefined()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  test("keeps the queue's explanation off a pull request that has already landed", () => {
    render(<Merge merge={Option.some(inA({ waiting: true }))} state="merged" />)

    expect(screen.queryByText(/its turn comes/)).toBeNull()
    expect(screen.queryByText(/position/)).toBeNull()
  })

  test("says nothing about catching up a branch that has landed", () => {
    render(<Merge merge={Option.some(behind)} state="merged" />)

    expect(screen.queryByText(/base branch has moved on/)).toBeNull()
  })

  test("still says who reviewed it, which is a fact about the reading", () => {
    render(<Merge merge={Option.some(ready)} state="merged" reviews={Option.some([aReview("vijayupadya", "approved")])} />)

    expect(screen.getByText("vijayupadya")).toBeDefined()
  })

  test("offers the branch it was made from, which is the loose end left", () => {
    render(
      <Merge
        merge={Option.some(ready)}
        state="merged"
        headRef={{ mayDelete: true, mayRestore: false }}
        actions={{ deleteBranch: () => Effect.void }}
      />
    )

    expect(button(/Delete branch/)).toBeDefined()
  })

  test("asks a second time before it takes a branch away", async () => {
    let deletes = 0
    render(
      <Merge
        merge={Option.some(ready)}
        state="merged"
        headRef={{ mayDelete: true, mayRestore: false }}
        actions={{ deleteBranch: () => Effect.sync(() => void (deletes += 1)) }}
      />
    )

    await userEvent.click(button(/Delete branch/))
    expect(deletes).toBe(0)

    await userEvent.click(button(/Confirm delete branch/))
    await waitFor(() => expect(deletes).toBe(1))
    expect(button(/Branch deleted/)).toBeDefined()
  })

  test("offers nothing where GitHub says the branch is not this reader's to delete", () => {
    // A fork, a protected branch, or a repository that deletes head branches on
    // merge by itself and has already done it. Each of them arrives as the same
    // no, and a button GitHub would refuse is worse than no button.
    render(
      <Merge
        merge={Option.some(ready)}
        state="merged"
        headRef={{ mayDelete: false, mayRestore: false }}
        actions={{ deleteBranch: () => Effect.void }}
      />
    )

    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  test("says the branch has gone where GitHub offers to put it back", () => {
    render(<Merge merge={Option.some(ready)} state="merged" headRef={{ mayDelete: false, mayRestore: true }} />)

    expect(screen.getByText(/branch it was made from has gone/)).toBeDefined()
  })

  test("repeats GitHub's refusal rather than saying the branch went", async () => {
    render(
      <Merge
        merge={Option.some(ready)}
        state="merged"
        headRef={{ mayDelete: true, mayRestore: false }}
        actions={{
          deleteBranch: () => Effect.fail({ detail: "Branch not deletable, it is protected" })
        }}
      />
    )

    await userEvent.click(button(/Delete branch/))
    await userEvent.click(button(/Confirm delete branch/))

    await waitFor(() => {
      expect(screen.getByText(/Branch not deletable/)).toBeDefined()
    })
  })

  test("offers the same press on a closed one, GitHub keeping its branch too", () => {
    render(
      <Merge
        merge={Option.some(ready)}
        state="closed"
        headRef={{ mayDelete: true, mayRestore: false }}
        actions={{ deleteBranch: () => Effect.void }}
      />
    )

    expect(button(/Delete branch/)).toBeDefined()
  })
})

describe("what the reviewers decided", () => {
  test("says who approved it, since nothing else on this screen does", () => {
    render(<Merge state="open" merge={Option.some(ready)} reviews={Option.some([aReview("vijayupadya", "approved")])} />)

    expect(screen.getByText("vijayupadya")).toBeDefined()
    expect(screen.getByText("approved")).toBeDefined()
    expect(screen.getByLabelText("vijayupadya")).toBeDefined()
  })

  test("names a blocking review in the words GitHub uses for it", () => {
    render(<Merge state="open" merge={Option.some(ready)} reviews={Option.some([aReview("romalpani", "changes-requested")])} />)

    expect(screen.getByText("requested changes")).toBeDefined()
  })

  test("puts the objection above the approval, because it is the one that decides", () => {
    render(
      <Merge state="open"
        merge={Option.some(ready)}
        reviews={Option.some([aReview("vijayupadya", "approved"), aReview("romalpani", "changes-requested")])}
      />
    )

    const said = screen.getByRole("region", { name: "Merge" }).textContent ?? ""

    expect(said.indexOf("romalpani")).toBeLessThan(said.indexOf("vijayupadya"))
  })

  test("adds no empty row when nobody has reviewed it", () => {
    render(<Merge state="open" merge={Option.some(ready)} reviews={Option.some([])} />)

    expect(screen.queryByText(/approved|requested changes/)).toBeNull()
  })
})

describe("a pull request that is one layer of a stack", () => {
  const layer = (number: number, seat: "below" | "here" | "above", draft = false) => ({
    reference: { owner: "flazouh", repo: "stack-probe", number },
    title: `module ${number}`,
    headBranch: `feat-${number}`,
    state: draft ? ("draft" as const) : ("open" as const),
    seat
  })

  const onTopOf = (...layers: ReadonlyArray<StackLayer>): MergeState => ({
    ...ready,
    stack: Option.some({ number: 11, layers, floor: Option.none() })
  })

  const inTheMiddle = onTopOf(layer(8, "below"), layer(9, "here"), layer(10, "above"))

  test("draws the stack above everything else the card has to say", () => {
    render(<Merge state="open" merge={Option.some(inTheMiddle)} />)

    const said = screen.getByRole("region", { name: "Merge" }).textContent ?? ""

    expect(said.indexOf("This press lands")).toBeLessThan(said.indexOf("Squash and merge"))
  })

  test("says nothing about a stack on a pull request that is not in one", () => {
    render(<Merge state="open" merge={Option.some(ready)} />)

    expect(screen.queryByText(/This press lands/)).toBeNull()
  })

  test("stops calling itself ready while a draft below it cannot land", () => {
    // GitHub says MERGEABLE here and they are right about this pull request.
    // The press lands three of them and one of the three is a draft.
    const overADraft = onTopOf(layer(8, "below"), layer(9, "below", true), layer(10, "here"))

    render(<Merge state="open" merge={Option.some(overADraft)} />)

    expect(screen.queryByText("ready to merge")).toBeNull()
    expect(screen.getByText("blocked")).toBeDefined()
    expect(button(/Squash and merge/)).toHaveProperty("disabled", true)
  })

  test("still calls itself ready when the draft is above, which the press misses", () => {
    const underADraft = onTopOf(layer(8, "below"), layer(9, "here"), layer(10, "above", true))

    render(<Merge state="open" merge={Option.some(underADraft)} />)

    expect(screen.getByText("ready to merge")).toBeDefined()
  })

  test("names the stack on the button, because that is what this press lands", () => {
    // The panel above already counts the layers, but the button is the thing
    // being pressed, and "Squash and merge" is the label for landing one pull
    // request. GitHub's own button on a stack says "Merge stack".
    render(<Merge state="open" merge={Option.some(inTheMiddle)} />)

    expect(button(/^Squash and merge stack/)).toBeDefined()
  })

  test("asks for the stack by name on the second press too", async () => {
    render(
      <Merge state="open" merge={Option.some(inTheMiddle)} actions={{ merge: () => Effect.void }} />
    )

    await userEvent.click(button(/Squash and merge stack/))

    expect(button(/Confirm squash and merge stack/)).toBeDefined()
  })

  test("keeps the plain word while the press lands one layer, the rest being merged", () => {
    // A half-landed stack keeps its merged layers in the list, and the press
    // takes what is left below here — which on this seat is this one alone. A
    // button saying stack would claim three pull requests to land one.
    const lastOneStanding = onTopOf(
      { ...layer(8, "below"), state: "merged" as const },
      { ...layer(9, "below"), state: "merged" as const },
      layer(10, "here")
    )

    render(<Merge state="open" merge={Option.some(lastOneStanding)} />)

    expect(button(/^Squash and merge$/)).toBeDefined()
  })
})

describe("a repository that merges through a queue", () => {
  test("offers the queue rather than a merge that would jump it", () => {
    render(<Merge state="open" merge={Option.some(inA({}))} actions={{ merge: () => Effect.void, enqueue: () => Effect.void }} />)

    expect(button(/Merge when ready/)).toBeDefined()
    expect(screen.queryByRole("button", { name: /Squash and merge/ })).toBeNull()
  })

  test("joins the queue on the second press, as merging does", async () => {
    let joined = 0
    render(<Merge state="open" merge={Option.some(inA({}))} actions={{ enqueue: () => Effect.sync(() => void (joined += 1)) }} />)

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
        merge={Option.some(inA({}))}
        actions={{ enqueue: () => Effect.void, onChanged: () => void (reread += 1) }}
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
        merge={Option.some(inA({ waiting: true }))}
        actions={{ dequeue: () => Effect.void, onChanged: () => void (reread += 1) }}
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
        merge={Option.some(inA({}))}
        actions={{
          enqueue: () => Effect.fail({ detail: "no" }),
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
        merge={Option.some(inA({}))}
        actions={{ enqueue: () => Effect.fail({ detail: "Base branch was modified." }) }}
      />
    )

    await userEvent.click(button(/Merge when ready/))
    await userEvent.click(button(/Confirm merge when ready/))

    await waitFor(() => expect(screen.getByText(/Base branch was modified/)).toBeDefined())
    expect(button(/Merge when ready/)).toBeDefined()
  })

  test("cannot be joined while GitHub says this one may not go in", () => {
    render(<Merge state="open" merge={Option.some(inA({ mayJoin: false }))} actions={{ enqueue: () => Effect.void }} />)

    expect(button(/Merge when ready/)).toHaveProperty("disabled", true)
  })

  test("cannot be joined by someone who may not queue anything", () => {
    render(<Merge state="open" merge={Option.some(inA({ viewerCanQueue: false }))} actions={{ enqueue: () => Effect.void }} />)

    expect(button(/Merge when ready/)).toHaveProperty("disabled", true)
  })

  test("takes it back out again when it is already waiting", async () => {
    let left = 0
    render(
      <Merge state="open"
        merge={Option.some(inA({ waiting: true, position: Option.some(3) }))}
        actions={{ dequeue: () => Effect.sync(() => void (left += 1)) }}
      />
    )

    await userEvent.click(button(/Remove from the queue/))
    await userEvent.click(button(/Confirm remove from the queue/))

    await waitFor(() => expect(left).toBe(1))
  })

  test("offers no way in while it is already standing in the line", () => {
    render(
      <Merge state="open" merge={Option.some(inA({ waiting: true }))} actions={{ enqueue: () => Effect.void, dequeue: () => Effect.void }} />
    )

    expect(screen.queryByRole("button", { name: /Merge when ready/ })).toBeNull()
  })

  test("offers to call off an auto-merge already armed, rather than arming it twice", async () => {
    let called = 0
    render(
      <Merge state="open"
        merge={Option.some({ ...inA({}), autoMerge: armed })}
        actions={{ enqueue: () => Effect.void, cancel: () => Effect.sync(() => void (called += 1)) }}
      />
    )

    expect(screen.queryByRole("button", { name: /Merge when ready/ })).toBeNull()

    await userEvent.click(button(/Cancel merge when ready/))
    await userEvent.click(button(/Confirm cancel merge when ready/))

    await waitFor(() => expect(called).toBe(1))
  })

  test("says it is armed, so a pull request that has not moved still reads as done", () => {
    render(<Merge state="open" merge={Option.some({ ...inA({}), autoMerge: armed })} />)

    expect(screen.getByText(/merges when it is ready/i)).toBeDefined()
  })

  test("still links to the queue GitHub keeps, for what is ahead of this", () => {
    render(<Merge state="open" merge={Option.some(inA({}))} actions={{ enqueue: () => Effect.void }} />)

    const link = screen.getByRole("link", { name: /merge queue/i })
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/queue/main")
  })

  test("says where in the line it is already waiting", () => {
    render(<Merge state="open" merge={Option.some(inA({ waiting: true, position: Option.some(3) }))} />)

    expect(screen.getByText(/position 3/)).toBeDefined()
  })

  test("says it is waiting even when GitHub does not say where", () => {
    render(<Merge state="open" merge={Option.some(inA({ waiting: true }))} />)

    expect(screen.getByText(/waiting in the merge queue/i)).toBeDefined()
    expect(screen.queryByText(/position/)).toBeNull()
  })
})
