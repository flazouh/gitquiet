import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect } from "effect"
import { Settle } from "./Settle"
import type { Settled } from "../domain/Issue"

/**
 * The one thing on an issue a reader does rather than reads.
 *
 * Three verbs behind it, because "Closed" alone hides the answer whoever raised it came back
 * for: an issue closed as not planned is not going to be done, and an issue closed as
 * completed is the opposite. The third names another issue, which is a question and not a
 * press, and it is the one GitHub's own team called confusing in the thread on their control.
 */

afterEach(cleanup)

const where = { owner: "flazouh", repo: "stack-probe" }

const open = { state: "open" as const, where, allowed: { close: true, reopen: false } }

const closed = { state: "closed" as const, where, allowed: { close: false, reopen: true } }

const asking = () => {
  let asked: Settled | undefined
  const onSettle = (settling: Settled) => Effect.sync(() => void (asked = settling))
  return { onSettle, said: () => asked }
}

const chose = async (what: RegExp) => {
  await userEvent.click(screen.getByRole("button", { name: /^Close issue/ }))
  await userEvent.click(await screen.findByRole("menuitem", { name: what }))
}

describe("settling an issue from its own page", () => {
  test("closes it as completed, which is the press without a decision in it", async () => {
    const ask = asking()
    render(<Settle {...open} onSettle={ask.onSettle} />)

    await chose(/completed/)

    await waitFor(() => expect(ask.said()).toEqual({ as: "completed" }))
  })

  test("closes it as not planned, which is the answer the word Closed hides", async () => {
    const ask = asking()
    render(<Settle {...open} onSettle={ask.onSettle} />)

    await chose(/not planned/)

    await waitFor(() => expect(ask.said()).toEqual({ as: "discarded" }))
  })

  test("puts a closed one back, which is one press and no menu", async () => {
    let reopened = 0
    render(<Settle {...closed} onReopen={() => Effect.sync(() => void (reopened += 1))} />)

    await userEvent.click(screen.getByRole("button", { name: "Reopen issue" }))

    await waitFor(() => expect(reopened).toBe(1))
  })

  /*
   * GitHub says who may act, and it is not guessable from authorship: a triager closes
   * issues they did not raise, and an archived repository refuses everyone. A control that
   * throws when it is used is worse than no control.
   */
  test("offers nothing where GitHub says this reader may not", () => {
    render(
      <Settle
        state="open"
        where={where}
        allowed={{ close: false, reopen: false }}
        onSettle={() => Effect.void}
      />
    )

    expect(screen.queryByRole("button")).toBeNull()
  })

  test("offers nothing where nothing is wired up to it", () => {
    render(<Settle {...open} />)

    expect(screen.queryByRole("button")).toBeNull()
  })

  /**
   * The duplicate, which is the one close that needs a second issue named.
   *
   * A field rather than their sub-menu of search results, because the reader closing a
   * duplicate has the other issue open in a tab and what they hold is its address.
   */
  describe("closing it as a duplicate of another", () => {
    test("asks which issue rather than closing on the press", async () => {
      const ask = asking()
      render(<Settle {...open} onSettle={ask.onSettle} />)

      await chose(/duplicate/)

      expect(screen.getByLabelText(/Which issue is this a duplicate of/)).toBeDefined()
      expect(ask.said()).toBeUndefined()
    })

    test("takes a number and reads it as an issue in this repository", async () => {
      const ask = asking()
      render(<Settle {...open} onSettle={ask.onSettle} />)

      await chose(/duplicate/)
      await userEvent.type(screen.getByLabelText(/Which issue is this a duplicate of/), "#78")
      await userEvent.click(screen.getByRole("button", { name: "Close as duplicate" }))

      await waitFor(() =>
        expect(ask.said()).toEqual({ as: "duplicate", of: { ...where, number: 78 } })
      )
    })

    test("takes another repository's issue, which is where a duplicate often is", async () => {
      const ask = asking()
      render(<Settle {...open} onSettle={ask.onSettle} />)

      await chose(/duplicate/)
      await userEvent.type(
        screen.getByLabelText(/Which issue is this a duplicate of/),
        "https://github.com/oven-sh/bun/issues/1234"
      )
      await userEvent.click(screen.getByRole("button", { name: "Close as duplicate" }))

      await waitFor(() =>
        expect(ask.said()).toEqual({
          as: "duplicate",
          of: { owner: "oven-sh", repo: "bun", number: 1234 }
        })
      )
    })

    test("says back the issue it understood, which a number alone does not", async () => {
      render(<Settle {...open} onSettle={() => Effect.void} />)

      await chose(/duplicate/)
      await userEvent.type(screen.getByLabelText(/Which issue is this a duplicate of/), "78")

      expect(await screen.findByText("flazouh/stack-probe#78")).toBeTruthy()
    })

    test("will not send a field that names no issue", async () => {
      const ask = asking()
      render(<Settle {...open} onSettle={ask.onSettle} />)

      await chose(/duplicate/)
      await userEvent.type(
        screen.getByLabelText(/Which issue is this a duplicate of/),
        "the login one"
      )
      await userEvent.click(screen.getByRole("button", { name: "Close as duplicate" }))

      expect(ask.said()).toBeUndefined()
    })
  })
})
