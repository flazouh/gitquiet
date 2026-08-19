import { beforeEach, describe, expect, it } from "bun:test"
import { nowShowing, openCard, openTheList, watchShowing } from "./showing"

const A_CARD = { owner: "citrolabs", repo: "ego-lite", number: 193 }

/** How many times the window would have been told to draw again. */
const counting = () => {
  const told = { times: 0 }
  const stop = watchShowing(() => {
    told.times += 1
  })
  return { told, stop }
}

beforeEach(() => {
  openTheList()
})

describe("what the window is showing", () => {
  it("starts on the list", () => {
    expect(nowShowing()).toEqual({ at: "list" })
  })

  it("becomes a card, and says so once", () => {
    const { told, stop } = counting()

    openCard(A_CARD)

    expect(nowShowing()).toEqual({ at: "card", reference: A_CARD })
    expect(told.times).toBe(1)
    stop()
  })

  /*
   * The guard the card's own state depends on. A reference read off a link is a new
   * object every press, and a new value tears the card down and asks GitHub for it
   * again — so a press on a link to the pull request already on the screen took the
   * reader's place in the file they were reading away from them.
   */
  it("does not open the card it is already showing, whatever object the press carries", () => {
    openCard(A_CARD)
    const { told, stop } = counting()

    openCard({ owner: "citrolabs", repo: "ego-lite", number: 193 })

    expect(told.times).toBe(0)
    stop()
  })

  it("does open a different pull request of the same repository", () => {
    openCard(A_CARD)
    const { told, stop } = counting()

    openCard({ ...A_CARD, number: 194 })

    expect(nowShowing()).toEqual({ at: "card", reference: { ...A_CARD, number: 194 } })
    expect(told.times).toBe(1)
    stop()
  })

  it("goes back to the list, and does not say so twice", () => {
    openCard(A_CARD)
    const { told, stop } = counting()

    openTheList()
    openTheList()

    expect(nowShowing()).toEqual({ at: "list" })
    expect(told.times).toBe(1)
    stop()
  })

  it("stops telling whoever has stopped watching", () => {
    const { told, stop } = counting()
    stop()

    openCard(A_CARD)

    expect(told.times).toBe(0)
  })
})
