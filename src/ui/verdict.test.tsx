import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { person } from "../../tests/snapshots"
import type { Review as Given } from "../domain/PullRequest"
import { Verdict } from "./Verdict"

afterEach(cleanup)
/* The panel keeps what was typed and what was sent, so one test would furnish the next. */
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

/** GitHub answering that nobody has judged this yet, which is not GitHub saying nothing. */
const NONE: Option.Option<ReadonlyArray<Given>> = Option.some([])
const HEAD = "9f2c1d4a77e0b3c5"
const reader = { login: "ana" }
const author = person("ben")

const shown = (
  props: Partial<Parameters<typeof Verdict>[0]> = {}
) =>
  render(
    <Verdict
      reviews={NONE}
      viewer={reader}
      author={author}
      headSha={HEAD}
      onReview={() => Effect.void}
      {...props}
    />
  )

/** Opens the box, which is folded until it is asked for. */
const opened = () => userEvent.click(screen.getByRole("button", { name: /^Say what you found/ }))

describe("saying what you think of a pull request", () => {
  /*
   * Folded, like every other box here. Open by default it is two hundred pixels of empty box
   * under a conversation that is usually read without a word being added.
   */
  test("stands folded, with the approval that needs no words beside the fold", () => {
    shown()

    expect(screen.getByRole("button", { name: "Approve" })).toBeDefined()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("button", { name: "Request changes" })).toBeNull()
  })

  /*
   * The fold wears a field's fill and a field's corner, so it has to answer a press the way a
   * field does. A control shaped like somewhere to type that opens a box the caret is not in
   * has lied about what it was, and the reader presses twice for one thought.
   */
  test("hands the caret to the box on the press that opens it", async () => {
    shown()
    await opened()

    expect(document.activeElement).toBe(screen.getByRole("textbox"))
  })

  test("offers all three verdicts on the page, rather than behind a dialog", async () => {
    shown()
    await opened()

    expect(screen.getByRole("button", { name: "Approve" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Request changes" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Comment" })).toBeDefined()
  })

  test("approves with no words, since that is what an approval usually is", async () => {
    const review = mock(() => Effect.void)
    shown({ onReview: review })

    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    expect(review).toHaveBeenCalledWith({ verdict: "approve", note: "", headSha: HEAD })
  })

  /*
   * GitHub refuses both of these without a body. A button that earns a 422 is a button that
   * teaches the reader nothing, so it is out until there is something to send.
   */
  test("keeps the two that need words out until there are words", async () => {
    shown()
    await opened()

    expect((screen.getByRole("button", { name: "Request changes" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Comment" }) as HTMLButtonElement).disabled).toBe(true)

    await userEvent.type(screen.getByRole("textbox"), "the retry loop is off by one")

    expect((screen.getByRole("button", { name: "Request changes" }) as HTMLButtonElement).disabled).toBe(false)
  })

  test("sends the words with the verdict they were typed for", async () => {
    const review = mock(() => Effect.void)
    shown({ onReview: review })
    await opened()

    await userEvent.type(screen.getByRole("textbox"), "the retry loop is off by one")
    await userEvent.click(screen.getByRole("button", { name: "Request changes" }))

    expect(review).toHaveBeenCalledWith({
      verdict: "request-changes",
      note: "the retry loop is off by one",
      headSha: HEAD
    })
  })

  /*
   * The commit is on the panel because GitHub does not clear a verdict when the branch moves:
   * an approval given here stands over whatever is pushed next.
   */
  test("says which commit is being judged", () => {
    shown()

    expect(screen.getByText("9f2c1d4")).toBeDefined()
  })

  test("does not offer an approval of your own pull request, which GitHub refuses", async () => {
    shown({ author: person("ana") })
    await userEvent.click(screen.getByRole("button", { name: /^Answer the review/ }))

    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull()
    expect(screen.getByRole("button", { name: "Comment" })).toBeDefined()
  })

  test("says what this reader already said about it", () => {
    shown({ reviews: Option.some([{ reviewer: person("ana"), decision: "approved" }]) })

    expect(screen.getByText("You approved this")).toBeDefined()
  })

  /*
   * The press has to change the panel it was pressed in.
   *
   * GitHub answers a review on a route of its own and says nothing about it anywhere else,
   * so the record this panel reads is a page old until the next read of the whole pull
   * request lands. Between the two, the button went back to saying "Approve" over a panel
   * that looked exactly as it did before — which is a press that appears to have done
   * nothing, on the one act a reviewer comes here to perform.
   */
  test("turns its own edge the moment the verdict is sent, before the record has it", async () => {
    shown()

    expect(screen.getByRole("heading", { name: "Verdict" }).className).not.toMatch(
      /text-(done|fail|busy)/
    )

    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Verdict" }).className).toContain("text-done")
    )
    expect(screen.getByText("You approved this")).toBeDefined()
  })

  test("holds the plain edge for a verdict given against an older commit", async () => {
    const keep = "verdict:acme/widgets#7"
    shown({ keep })
    await userEvent.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Verdict" }).className).toContain("text-done")
    )
    cleanup()

    // The same panel a push later. The approval stands on GitHub and it is about
    // the commit before this one, which is the whole reason the sha is on the panel.
    shown({ keep, headSha: "0b1c2d3e4f5a6b7c" })

    expect(screen.getByRole("heading", { name: "Verdict" }).className).not.toMatch(
      /text-(done|fail|busy)/
    )
  })

  /*
   * The approval beside the fold is the one verb here that needs no box, so a reader can
   * press it without ever opening one — and the sentence saying GitHub refused it was
   * inside the box. Pressing Approve on a pull request GitHub will not take an approval
   * for said nothing at all: the button went back to "Approve" and that was the whole
   * report.
   */
  test("says what GitHub refused, where the box was never opened", async () => {
    shown({ onReview: () => Effect.fail(new Error("Can not approve your own pull request")) })

    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    await waitFor(() =>
      expect(screen.getByText(/Can not approve your own pull request/)).toBeDefined()
    )
    expect(screen.getByRole("heading", { name: "Verdict" }).className).not.toMatch(
      /text-(done|fail|busy)/
    )
  })

  test("turns the title red where the reader asked for changes", async () => {
    shown()
    await opened()

    await userEvent.type(screen.getByRole("textbox"), "the retry loop is off by one")
    await userEvent.click(screen.getByRole("button", { name: "Request changes" }))

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Verdict" }).className).toContain("text-fail")
    )
  })

  test("says nothing about a verdict somebody else gave", () => {
    shown({ reviews: Option.some([{ reviewer: person("ben"), decision: "changes-requested" }]) })

    expect(screen.getByText("not read yet by you")).toBeDefined()
  })

  /*
   * GitHub not saying and GitHub saying nobody has judged this are different facts, and
   * the fold is the one line that reports either. "Not read yet by you" over a merge box
   * that never arrived would be this panel inventing the record: the reader may well have
   * approved it an hour ago and be about to do it twice.
   */
  test("says the record is missing, rather than that nobody has read it", () => {
    shown({ reviews: Option.none() })

    expect(screen.getByText("not known")).toBeDefined()
    expect(screen.queryByText("not read yet by you")).toBeNull()
  })

  /* Still worth saying, because it is a note about this session and not about their record. */
  test("still says what this session sent, where GitHub would not say what it holds", async () => {
    const first = shown({ keep: "verdict:ana/four#4" })
    await opened()

    await userEvent.type(screen.getByRole("textbox"), "one thing")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))
    await waitFor(() => expect(screen.getByText("You commented on this")).toBeDefined())
    first.unmount()

    shown({ keep: "verdict:ana/four#4", reviews: Option.none() })

    expect(screen.getByText("You commented on this")).toBeDefined()
  })

  /*
   * The complaint about their own dialog, in one test: a review it refuses comes back with an
   * empty box, and the paragraph that was typed is the one thing that cannot be fetched again.
   */
  test("keeps the words where GitHub would not take the verdict", async () => {
    shown({ onReview: () => Effect.fail(new Error("Can not approve your own pull request.")) })
    await opened()

    await userEvent.type(screen.getByRole("textbox"), "looks right to me")
    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    await waitFor(() =>
      expect(screen.getByText(/Can not approve your own pull request\./)).toBeDefined()
    )
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("looks right to me")
  })

  /*
   * GitHub's payload carries the "opinionated" reviews and says nothing about one that only
   * commented, so a reader who commented and came back was told they had not read this. What
   * was sent is kept here instead. See `verdicts.ts`.
   */
  test("says you commented next time, which GitHub's own payload will not", async () => {
    const first = shown({ keep: "verdict:ana/one#1" })
    await opened()

    await userEvent.type(screen.getByRole("textbox"), "two small things")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))
    await waitFor(() => expect(screen.getByText("You commented on this")).toBeDefined())
    first.unmount()

    shown({ keep: "verdict:ana/one#1" })

    expect(screen.getByText("You commented on this")).toBeDefined()
  })

  test("says a remembered verdict was about an older commit, where it was", async () => {
    const first = shown({ keep: "verdict:ana/two#2" })
    await opened()

    await userEvent.type(screen.getByRole("textbox"), "one thing")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))
    await waitFor(() => expect(screen.getByText("You commented on this")).toBeDefined())
    first.unmount()

    shown({ keep: "verdict:ana/two#2", headSha: "0000111122223333" })

    expect(screen.getByText("You commented on this, at an older commit")).toBeDefined()
  })

  test("lets GitHub's own record outrank what was kept here", async () => {
    const first = shown({ keep: "verdict:ana/three#3" })
    await opened()

    await userEvent.type(screen.getByRole("textbox"), "one thing")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))
    await waitFor(() => expect(screen.getByText("You commented on this")).toBeDefined())
    first.unmount()

    shown({
      keep: "verdict:ana/three#3",
      reviews: Option.some([{ reviewer: person("ana"), decision: "dismissed" }])
    })

    expect(screen.getByText("Your review was dismissed")).toBeDefined()
  })

  /* And folds it away again, which is what says GitHub took it. */
  test("empties the box once GitHub has taken it", async () => {
    shown()
    await opened()

    await userEvent.type(screen.getByRole("textbox"), "one thing to fix")
    await userEvent.click(screen.getByRole("button", { name: "Request changes" }))

    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull())
    await opened()
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("")
  })
})
