import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Deferred, Effect } from "effect"
import { aComment, aThread, person } from "../../tests/snapshots"
import type { ThreadComment } from "../domain/PullRequest"
import { Conversation } from "./Conversation"
import { ThreadInDiff } from "./ThreadView"

afterEach(cleanup)
/* Every box here keeps what is unsent, so one test's half-written answer would open the next
   test's box. See `held.ts`. */
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const thread = aThread("t1", [aComment(person("ana"), "this reads oddly", "1001")])
const settled = aThread("t2", [aComment(person("ben"), "fixed", "1002")], true)

/** Opens the fold a thread is behind in the column, which the diff does not have. */
const unfold = async (words: string) => {
  await userEvent.click(screen.getAllByText(words)[0]!)
}

const answered: ReadonlyArray<ThreadComment> = [
  aComment(person("ana"), "this reads oddly", "1001"),
  aComment(person("me"), "renamed it", "1003")
]

describe("answering a thread where it is read", () => {
  test("keeps the box away until it is asked for, since most threads get no answer", async () => {
    render(<Conversation threads={[thread]} remarks={[]} onReply={() => Effect.succeed(answered)} />)
    await unfold("this reads oddly")

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByRole("button", { name: "Answer this" })).toBeDefined()
  })

  test("addresses the answer to the comment their route wants, not to the thread", async () => {
    const reply = mock(() => Effect.succeed(answered))
    render(<Conversation threads={[thread]} remarks={[]} onReply={reply} />)
    await unfold("this reads oddly")

    await userEvent.click(screen.getByRole("button", { name: "Answer this" }))
    await userEvent.type(screen.getByRole("textbox"), "renamed it")
    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    expect(reply).toHaveBeenCalledWith("1001", "renamed it")
  })

  /*
   * The whole thread comes back from their route, so the answer is on the screen without a
   * second read of the page. Waiting for one is how the old interface made a reply feel lost.
   */
  test("shows the answer as soon as GitHub hands the thread back", async () => {
    render(<Conversation threads={[thread]} remarks={[]} onReply={() => Effect.succeed(answered)} />)
    await unfold("this reads oddly")

    await userEvent.click(screen.getByRole("button", { name: "Answer this" }))
    await userEvent.type(screen.getByRole("textbox"), "renamed it")
    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    await waitFor(() => expect(screen.getByText("renamed it")).toBeDefined())
  })

  test("keeps the words in the box where GitHub would not take them", async () => {
    render(
      <Conversation
        threads={[thread]}
        remarks={[]}
        onReply={() => Effect.fail(new Error("Conversation is locked."))}
      />
    )
    await unfold("this reads oddly")

    await userEvent.click(screen.getByRole("button", { name: "Answer this" }))
    await userEvent.type(screen.getByRole("textbox"), "renamed it")
    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    await waitFor(() => expect(screen.getByText(/Conversation is locked\./)).toBeDefined())
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("renamed it")
  })

  test("says it is posting while GitHub is being asked, and refuses a second press", async () => {
    const waited = Effect.runSync(Deferred.make<ReadonlyArray<ThreadComment>, never>())
    render(
      <Conversation threads={[thread]} remarks={[]} onReply={() => Deferred.await(waited)} />
    )
    await unfold("this reads oddly")

    await userEvent.click(screen.getByRole("button", { name: "Answer this" }))
    await userEvent.type(screen.getByRole("textbox"), "renamed it")
    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    const sending = screen.getByRole("button", { name: /Posting/ }) as HTMLButtonElement
    expect(sending.disabled).toBe(true)
  })

  /*
   * The complaint people make about GitHub's review pages: a paragraph typed into a thread and
   * never sent goes with the tab. This interface makes that worse than most if it does nothing,
   * because moving between screens tears down the whole tree. See `held.ts`.
   */
  test("keeps an unsent answer, and opens the box on it next time", async () => {
    const first = render(
      <Conversation threads={[thread]} remarks={[]} onReply={() => Effect.succeed(answered)} />
    )
    await unfold("this reads oddly")
    await userEvent.click(screen.getByRole("button", { name: "Answer this" }))
    await userEvent.type(screen.getByRole("textbox"), "half a thought")
    first.unmount()

    render(<Conversation threads={[thread]} remarks={[]} onReply={() => Effect.succeed(answered)} />)
    await unfold("this reads oddly")

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("half a thought")
  })

  test("offers no box on a thread nobody may answer", async () => {
    render(
      <Conversation
        threads={[{ ...thread, canReply: false }]}
        remarks={[]}
        onReply={() => Effect.succeed(answered)}
      />
    )
    await unfold("this reads oddly")

    expect(screen.queryByRole("button", { name: "Answer this" })).toBeNull()
  })

  test("offers no box where nothing is wired up to answer with", async () => {
    render(<Conversation threads={[thread]} remarks={[]} />)
    await unfold("this reads oddly")

    expect(screen.queryByRole("button", { name: "Answer this" })).toBeNull()
  })
})

describe("ending a thread from the same place it is answered", () => {
  test("resolves it, which is the other half of answering it", async () => {
    const settle = mock(() => Effect.succeed(undefined))
    render(<Conversation threads={[thread]} remarks={[]} onSettle={settle} />)
    await unfold("this reads oddly")

    await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

    expect(settle).toHaveBeenCalledWith("t1")
  })

  /*
   * The fault this caught on `proof-fixture#1`: the press reached GitHub, the thread was
   * resolved, and the row said "Resolve" until the page was read again. A button that answers
   * nothing is a button that gets pressed twice.
   */
  test("says so on the folded line at the press, not after the next read", async () => {
    const waited = Effect.runSync(Deferred.make<void, never>())
    render(
      <Conversation
        threads={[thread]}
        remarks={[]}
        onSettle={() => Deferred.await(waited)}
        onUnsettle={() => Effect.void}
      />
    )
    await unfold("this reads oddly")

    await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

    expect(screen.getByLabelText("Resolved")).toBeDefined()
    expect(screen.getByRole("button", { name: "Open again" })).toBeDefined()
  })

  test("offers to open a resolved one again, rather than sending the reader to GitHub", async () => {
    const unsettle = mock(() => Effect.succeed(undefined))
    render(<Conversation threads={[settled]} remarks={[]} onSettle={() => Effect.void} onUnsettle={unsettle} />)
    await unfold("fixed")

    await userEvent.click(screen.getByRole("button", { name: "Open again" }))

    expect(unsettle).toHaveBeenCalledWith("t2")
  })
})

describe("a thread hung off a line of the diff", () => {
  test("moves the mark at the press, rather than after the round trip", async () => {
    const waited = Effect.runSync(Deferred.make<void, never>())
    render(
      <ThreadInDiff
        thread={thread}
        answering={{ onSettle: () => Deferred.await(waited), onReply: () => Effect.succeed(answered) }}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

    expect(screen.getByLabelText("Resolved")).toBeDefined()
  })

  test("puts the mark back where GitHub refuses", async () => {
    render(
      <ThreadInDiff
        thread={thread}
        answering={{ onSettle: () => Effect.fail(new Error("no")), onReply: () => Effect.succeed(answered) }}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

    await waitFor(() => expect(screen.queryByLabelText("Resolved")).toBeNull())
  })

  test("answers a line without leaving the file it is on", async () => {
    const reply = mock(() => Effect.succeed(answered))
    render(<ThreadInDiff thread={thread} answering={{ onReply: reply }} />)

    await userEvent.click(screen.getByRole("button", { name: "Answer this" }))
    await userEvent.type(screen.getByRole("textbox"), "renamed it")
    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    expect(reply).toHaveBeenCalledWith("1001", "renamed it")
  })
})
