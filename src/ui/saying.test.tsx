import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { cleanup, render, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect } from "effect"
import { Saying } from "./Saying"

afterEach(cleanup)

const VIEWER = { login: "reader-person", faceUrl: "https://example.test/face.png" }

const OPENING = "Say something about this pull request"

/*
 * Queried inside what this test rendered, rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it
 * holds every box every other test opened — and "the textbox" would be several of
 * them. Asking within this render is the difference between a test that passes on
 * its own and one that passes in the suite.
 */
const drawn = (onSay: (body: string) => Effect.Effect<unknown, unknown>) =>
  within(render(<Saying viewer={VIEWER} onSay={onSay} />).container)

/** Open the box, write in it, and press the button, which is the whole gesture. */
const say = async (
  box: ReturnType<typeof drawn>,
  written: string
): Promise<HTMLTextAreaElement> => {
  const opening = box.queryByText(OPENING)
  if (opening !== null) await userEvent.click(opening)
  const field = box.getByRole("textbox") as HTMLTextAreaElement
  await userEvent.type(field, written)
  await userEvent.click(box.getByText("Comment"))
  return field
}

describe("saying something about the pull request", () => {
  test("is folded until it is wanted, so it is not a box under every thread", () => {
    const box = drawn(() => Effect.void)

    expect(box.queryByRole("textbox")).toBeNull()
    expect(box.getByText(OPENING)).toBeTruthy()
  })

  test("sends what was typed, once", async () => {
    const sent: Array<string> = []
    const box = drawn((body) => Effect.sync(() => sent.push(body)))

    await say(box, "rebased onto main")

    await waitFor(() => expect(sent).toEqual(["rebased onto main"]))
  })

  test("folds itself away once GitHub has taken it", async () => {
    const box = drawn(() => Effect.void)

    await say(box, "looks good")

    await waitFor(() => expect(box.queryByRole("textbox")).toBeNull())
  })

  /*
   * The paragraph stays. Whatever GitHub objected to, what was typed is the one
   * thing on this card that cannot be fetched again.
   */
  test("keeps the words and says what was refused", async () => {
    const box = drawn(() => Effect.fail(new Error("Not Found")))

    const field = await say(box, "a thought worth keeping")

    await waitFor(() => expect(box.getByText(/would not take that/)).toBeTruthy())
    expect(field.value).toBe("a thought worth keeping")
  })

  test("turns a circle on the button while GitHub has not answered", async () => {
    // A remark goes to GitHub over the same seconds a merge does, and the button
    // said "Posting…" at forty percent opacity and stood there. The circle is the
    // part that says the wait is still going rather than stuck.
    const box = drawn(() => Effect.never)

    await say(box, "one moment")

    await waitFor(() =>
      expect(box.getByRole("button", { name: "Posting…" }).querySelector(".t-rotate")).not.toBeNull()
    )
  })

  test("holds both its words in one cell, so the box is the same width either way", async () => {
    const box = drawn(() => Effect.void)
    await userEvent.click(box.getByText(OPENING))

    const words = box.getByRole("button", { name: "Comment" }).querySelectorAll(".t-says > .t-say")

    expect([...words].map((word) => word.textContent)).toEqual(["Comment", "Posting…"])
  })

  test("will not send an empty remark", async () => {
    let asked = 0
    const box = drawn(() =>
      Effect.sync(() => {
        asked += 1
      })
    )

    await say(box, "   ")

    expect(asked).toBe(0)
  })
})

/**
 * Words typed and not sent, which are the one thing on this page GitHub has no copy of.
 *
 * Worse here than in most boxes: a press moves between screens, and every screen is its
 * own bundle with its own React tree, so leaving a page unmounts the box as surely as
 * closing the tab would. A draft that does not outlive that is a draft that is lost.
 */
describe("what was written and not yet sent", () => {
  const KEY = "issue:flazouh/stack-probe#77"

  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  const kept = (onSay: (body: string) => Effect.Effect<unknown, unknown>) =>
    within(render(<Saying viewer={VIEWER} keep={KEY} onSay={onSay} />).container)

  test("comes back after the page has gone and been drawn again", async () => {
    const first = kept(() => Effect.void)
    await userEvent.click(first.getByText(OPENING))
    await userEvent.type(first.getByRole("textbox"), "Half a thought")
    cleanup()

    const again = kept(() => Effect.void)

    expect((again.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Half a thought")
  })

  /*
   * Open rather than folded. Folded, the words are there and the reader cannot see them,
   * which is the same as having lost them with an extra step.
   */
  test("opens the box on arrival rather than hiding what is waiting", async () => {
    const first = kept(() => Effect.void)
    await userEvent.click(first.getByText(OPENING))
    await userEvent.type(first.getByRole("textbox"), "Half a thought")
    cleanup()

    const again = kept(() => Effect.void)

    expect(again.queryByText(OPENING)).toBeNull()
  })

  test("survives folding the box away, Cancel being not the same word as Delete", async () => {
    const box = kept(() => Effect.void)
    await userEvent.click(box.getByText(OPENING))
    await userEvent.type(box.getByRole("textbox"), "Half a thought")
    await userEvent.click(box.getByText("Cancel"))

    expect(box.getByRole("button", { name: /Carry on/ })).toBeDefined()
  })

  test("is gone once GitHub has taken it, which is what posting means", async () => {
    const box = kept(() => Effect.void)
    await say(box, "Sent for good")

    await waitFor(() => expect(box.queryByRole("textbox")).toBeNull())
    cleanup()

    const again = kept(() => Effect.void)
    expect(again.getByText(OPENING)).toBeDefined()
  })

  test("stays in the box where GitHub refused it, refusal being when it matters most", async () => {
    const box = kept(() => Effect.fail(new Error("Issue is locked.")))
    await say(box, "Kept through a refusal")
    cleanup()

    const again = kept(() => Effect.void)
    expect((again.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Kept through a refusal"
    )
  })
})
