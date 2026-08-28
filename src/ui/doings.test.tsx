import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { RowDoing } from "../domain/doable"
import { sittingsIn } from "../domain/sittings"
import type { PullRequestState } from "../domain/PullRequest"
import type { InvolvedPullRequest, Shelf } from "../domain/workingSet"
import { DEFAULT_KEYS, type Keys } from "../keys/commands"
import type { Asking } from "./Doings"
import { Toasts } from "./Toasts"
import { WorkingSet } from "./WorkingSet"

afterEach(cleanup)

const involved = (state: PullRequestState = "open"): InvolvedPullRequest => ({
  reference: { owner: "flazouh", repo: "octo-repo", number: 12 },
  id: 12000,
  title: "teach the reader to close a pull request",
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state,
  shelf: Option.some<Shelf>("needs-action"),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-01T00:00:00Z",
  headSha: "sha12",
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none()
})

/** What the row asked for, in the order it asked. */
type Asked = { readonly doing: RowDoing; readonly reference: PullRequestRef }

const listing = (
  state: PullRequestState,
  answer: (doing: RowDoing) => Effect.Effect<void, unknown> = () => Effect.void,
  keys: Keys = DEFAULT_KEYS
) => {
  const asked: Array<Asked> = []
  const asking: Asking = {
    ask: (doing, reference) => {
      asked.push({ doing, reference })
      return answer(doing)
    }
  }

  render(
    <>
      <WorkingSet
        sittings={sittingsIn([involved(state)], () => Option.none())}
        onOpen={() => {}}
        asking={asking}
        keys={keys}
      />
      {/* Where a refusal lands, now that the menu is not there to hold one. */}
      <Toasts />
    </>
  )

  return { asked }
}

const openTheMenu = async () => {
  await userEvent.click(screen.getByLabelText("What to do with #12"))
}

describe("what a row offers to do", () => {
  test("nothing at all where the surface cannot write", () => {
    render(
      <WorkingSet
        sittings={sittingsIn([involved("open")], () => Option.none())}
        onOpen={() => {}}
      />
    )

    expect(screen.queryByLabelText("What to do with #12")).toBeNull()
  })

  test("no button on a merged row, every verb being past", () => {
    listing("merged")

    expect(screen.queryByLabelText("What to do with #12")).toBeNull()
  })

  /*
   * "Why does this appear on hover? Hover is terrible UX for discoverability" — eleven
   * readers of the same complaint, and the one thing a person who has never found a feature
   * cannot do is hover over the place it would have been.
   */
  test("stands on the row rather than waiting for the pointer to find it", () => {
    listing("open")

    const button = screen.getByLabelText("What to do with #12")

    // Never invisible. The pointer may raise it from dim to full — that is emphasis, and
    // emphasis on something already on the screen is not what the complaint was about.
    expect(button.className).not.toContain("opacity-0 ")
    expect(button.className).not.toMatch(/opacity-0$/)
    expect(button.className).toContain("opacity-60")
  })

  test("merging, drafting and closing, for one that is open", async () => {
    listing("open")
    await openTheMenu()

    expect(screen.getByText("Squash and merge")).toBeDefined()
    expect(screen.getByText("Convert to draft")).toBeDefined()
    expect(screen.getByText("Close")).toBeDefined()
    expect(screen.queryByText("Mark ready for review")).toBeNull()
  })

  test("marking ready rather than drafting, for a draft", async () => {
    listing("draft")
    await openTheMenu()

    expect(screen.getByText("Mark ready for review")).toBeDefined()
    expect(screen.queryByText("Squash and merge")).toBeNull()
  })

  test("reopening a closed one, which the merge card has never offered", async () => {
    const { asked } = listing("closed")
    await openTheMenu()
    await userEvent.click(screen.getByText("Reopen"))
    await userEvent.click(screen.getByText("Confirm"))

    expect(asked).toEqual([{ doing: "reopen", reference: { owner: "flazouh", repo: "octo-repo", number: 12 } }])
    // The menu goes with the press, because the change is already on the list
    // behind it. Watching a spinner over the result is not watching the result.
    expect(screen.queryByText("Reopen")).toBeNull()
  })

  test("asks before every one of them, not only the two that cannot be undone", async () => {
    /*
     * Closing and merging were the two worth a second press when the second
     * press was the only thing to look at. A row is not a card, though: this
     * menu is one press away from a list somebody is reading, on a control that
     * appears under the pointer, and marking a colleague's pull request ready
     * for review by brushing past it is a message they get either way.
     *
     * So all five ask, and the asking costs a press rather than a dialogue.
     */
    const { asked } = listing("draft")
    await openTheMenu()
    await userEvent.click(screen.getByText("Mark ready for review"))

    expect(asked).toEqual([])

    await userEvent.click(screen.getByText("Confirm"))

    expect(asked.map((one) => one.doing)).toEqual(["markReady"])
  })

  test("asks twice before closing, as the card does", async () => {
    const { asked } = listing("open")
    await openTheMenu()
    await userEvent.click(screen.getByText("Close"))

    // The first press arms it and says so; nothing has been asked of GitHub.
    expect(asked).toEqual([])

    await userEvent.click(screen.getByText("Confirm"))

    expect(asked.map((one) => one.doing)).toEqual(["close"])
  })

  test("wears the state each verb leads to, and fills once it is armed", async () => {
    // Colour carrying meaning rather than decoration: the glyph beside Close is
    // the closed pull request the row is about to become, in the red the list
    // already draws that state in. Armed, the whole item takes the fill, which
    // is what the merge card does with the same press.
    listing("open")
    await openTheMenu()

    const closing = screen.getByText("Close").closest('[role="menuitem"]')

    expect(closing?.querySelector(".text-fail")).not.toBeNull()

    await userEvent.click(screen.getByText("Close"))

    expect(
      screen.getByText("Confirm").closest('[role="menuitem"]')?.className
    ).toContain("bg-fail-emphasis")
  })

  test("keeps that fill under the pointer, where the highlight used to grey it out", async () => {
    /*
     * The fault this guards: every item carried the menu's neutral highlight, so
     * the pointer that armed the item immediately painted over the red it had
     * just turned. The reader pressed Close, saw grey, and had no way to tell an
     * armed item from any other one they happened to be hovering.
     *
     * The card is the precedent. Its buttons take the tone of what they are
     * about to do and hold it — hover changes nothing on a filled button there,
     * because the fill is the sentence.
     */
    listing("open")
    await openTheMenu()
    await userEvent.click(screen.getByText("Close"))

    const armed = screen.getByText("Confirm").closest('[role="menuitem"]')

    expect(armed?.className).toContain("bg-fail-emphasis")
    expect(armed?.className).not.toContain("data-[highlighted]:bg-hover")
  })

  test("offers the way back out that the card's cross offers", async () => {
    /*
     * An armed item used to have two ways out and neither was visible: press
     * something else, or close the whole menu and lose your place. The card puts
     * a cross beside the button it has just filled, so the reader who changes
     * their mind can say so in the place they said yes.
     */
    const { asked } = listing("open")
    await openTheMenu()
    await userEvent.click(screen.getByText("Close"))

    await userEvent.click(screen.getByLabelText("Do not close"))

    expect(screen.queryByText("Confirm")).toBeNull()
    expect(screen.getByText("Close")).toBeDefined()
    // The way out is a way out, not a quiet way through.
    expect(asked).toEqual([])
  })

  test("turns no circle, being the one control here that does not wait in place", async () => {
    /*
     * Written down because the menu held the other half of this for a long time
     * after it stopped being reachable: a step called `working`, a spinner in
     * place of the verb's glyph, and an item saying "Asking GitHub…". The press
     * closes the menu now. The list has already moved the pull request into its
     * new Court, a toast carries whatever GitHub says, and there is no control
     * left on the screen for a circle to turn on.
     *
     * Which is the other right answer to a wait, beside the one every button in
     * `Says` gives: a control that gets out of the way owes the reader a sentence
     * where they are looking, not a spinner where they are not.
     */
    listing("open", () => Effect.never)
    await openTheMenu()
    await userEvent.click(screen.getByText("Close"))
    await userEvent.click(screen.getByText("Confirm"))

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
    expect(screen.queryAllByRole("menuitem")).toEqual([])
    expect(screen.queryByText("Asking GitHub…")).toBeNull()
  })

  test("carries GitHub's refusal to a toast, the menu having gone with the press", async () => {
    /*
     * It used to be a line inside the menu, under the item that was pressed,
     * which was the right place while the menu was still open to hold it. The
     * press closes the menu now — the row moved, and that is what the reader is
     * looking at — so the sentence goes where a reader looking at a list will
     * see it arrive.
     */
    listing("closed", () => Effect.fail({ detail: "The head branch has been deleted" }))
    await openTheMenu()
    await userEvent.click(screen.getByText("Reopen"))
    await userEvent.click(screen.getByText("Confirm"))

    await waitFor(() =>
      expect(screen.getByText("The head branch has been deleted")).toBeDefined()
    )
  })

  test("says what landed, with the way back on the sentence that says it", async () => {
    /*
     * The other half of a list that moves before GitHub has answered. A refusal
     * puts the row back and says why; a verb that worked moved the row on and
     * said nothing at all, so the reader who meant the item above it had to
     * work out what they had done and then find the verb that undoes it.
     */
    const { asked } = listing("open")
    await openTheMenu()
    await userEvent.click(screen.getByText("Close"))
    await userEvent.click(screen.getByText("Confirm"))

    await waitFor(() => expect(screen.getByText("flazouh/octo-repo#12 closed")).toBeDefined())

    await userEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(asked.map((one) => one.doing)).toEqual(["close", "reopen"])
  })

  test("offers no way back out of a merge, GitHub having no verb for it", async () => {
    listing("open")
    await openTheMenu()
    await userEvent.click(screen.getByText("Squash and merge"))
    await userEvent.click(screen.getByText("Confirm"))

    await waitFor(() => expect(screen.getByText("flazouh/octo-repo#12 merged")).toBeDefined())

    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
  })

  test("puts the address on the clipboard, which is what half these presses are for", async () => {
    const copied: Array<string> = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          copied.push(text)
          return Promise.resolve()
        }
      }
    })

    listing("open")
    await openTheMenu()
    await userEvent.click(screen.getByText("Copy link"))

    expect(copied).toEqual(["https://github.com/flazouh/octo-repo/pull/12"])
  })
})

describe("the letters an open menu answers to", () => {
  test("wears each one on the item it belongs to, a shortcut nobody is told about being unused", async () => {
    listing("open")
    await openTheMenu()

    const capOn = (word: string) =>
      screen.getByText(word).closest('[role="menuitem"]')?.querySelector("kbd")?.textContent

    expect(capOn("Squash and merge")).toBe("m")
    expect(capOn("Convert to draft")).toBe("d")
    expect(capOn("Close")).toBe("c")
    expect(capOn("Copy link")).toBe("y")
  })

  test("a draft wears the same letter on the door that goes the other way", async () => {
    listing("draft")
    await openTheMenu()

    expect(
      screen
        .getByText("Mark ready for review")
        .closest('[role="menuitem"]')
        ?.querySelector("kbd")?.textContent
    ).toBe("r")
  })

  test("goes on the one press, the letter being the deliberate act a click is not", async () => {
    /*
     * A click can be a brush past: the button appears under the pointer in a
     * list being scrolled, which is why it asks twice. Typing the verb's own
     * letter cannot happen by accident — the reader had to know it — so the
     * second press is spent on the way back instead, in the toast.
     */
    const { asked } = listing("open")
    await openTheMenu()
    await userEvent.keyboard("c")

    expect(asked.map((one) => one.doing)).toEqual(["close"])
    // The menu goes with the press, exactly as it does when the item is clicked.
    expect(screen.queryByText("Close")).toBeNull()

    await waitFor(() => expect(screen.getByText("flazouh/octo-repo#12 closed")).toBeDefined())
  })

  test("asks twice for the merge, which is the one that cannot be taken back", async () => {
    const { asked } = listing("open")
    await openTheMenu()
    await userEvent.keyboard("m")

    expect(asked).toEqual([])
    expect(screen.getByText("Confirm")).toBeDefined()

    await userEvent.keyboard("m")

    expect(asked.map((one) => one.doing)).toEqual(["merge"])
  })

  test("nothing for a verb this pull request is not offered", async () => {
    // `r` is reopening on a closed one and marking ready on a draft. On one that
    // is open it is neither, and a letter with nothing behind it does nothing.
    const { asked } = listing("open")
    await openTheMenu()
    await userEvent.keyboard("r")

    expect(asked).toEqual([])
  })

  test("nothing at all for a reader who turned the keyboard off", async () => {
    const { asked } = listing("open", () => Effect.void, { profile: "off", bound: {} })
    await openTheMenu()
    await userEvent.keyboard("c")

    expect(asked).toEqual([])
    // Nor a cap promising a key that would not answer.
    expect(screen.getByText("Close").closest('[role="menuitem"]')?.querySelector("kbd")).toBeNull()
  })
})

describe("shutting a row's menu", () => {
  test("is marked to go at once the moment a letter is typed at it", async () => {
    // `m` arms the merge and leaves the menu standing, which is the one keyboard press this
    // mark can be read on: the presses that shut it take the element with them. What the mark
    // buys is on the second `m` — the menu goes, and the toast answering the merge no longer
    // arrives underneath a menu that is still leaving. A keypress is not a hand travelling
    // away from anything. The rule it turns off lives in `motion.css`.
    listing("open")
    await openTheMenu()

    await userEvent.keyboard("m")

    expect(document.querySelector(".t-dropdown")?.getAttribute("data-snap")).toBe("")
  })

  test("puts the confirm cross there rather than sliding it in, for a letter", async () => {
    // The cross is the target for Escape or a second `m`. One that is still arriving is one the
    // next keypress can miss, and the reader who typed the first letter is already pressing.
    listing("open")
    await openTheMenu()

    await userEvent.keyboard("m")

    expect(document.querySelector(".t-doing-out")?.getAttribute("data-snap")).toBe("")
  })

  test("keeps its leaving for a press elsewhere", async () => {
    listing("open")
    await openTheMenu()

    await userEvent.keyboard("{Escape}")
    await openTheMenu()

    // Reopened by pointer: the mark from the keypress is gone, so the menu animates again.
    expect(document.querySelector(".t-dropdown")?.getAttribute("data-snap")).toBeNull()
  })
})
