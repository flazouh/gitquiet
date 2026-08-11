import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Says } from "./says"

afterEach(cleanup)

/** The four things the merge card's own button says, in the order a press says them. */
const ORDER = ["Squash and merge", "Confirm", "Merging…", "Merged"]

const words = () => [...document.querySelectorAll(".t-say")]
const spoken = () => words().filter((word) => !word.hasAttribute("aria-hidden"))
const wordFor = (word: string) => words().find((one) => one.textContent === word)

describe("what a button says", () => {
  test("holds every word it can say, whichever one it is saying", () => {
    /*
     * The whole of why this exists. A button whose label is swapped for another
     * one is a button that changes width mid-press, and the thing changing width
     * is the target under the reader's pointer. Every word stands in one cell, so
     * the box is as wide as the widest of them from the first frame.
     */
    render(<Says among={ORDER} said="Squash and merge" waiting="Merging…" />)

    expect(words().map((word) => word.textContent)).toEqual(ORDER)
  })

  test("announces the one it is saying and no other", () => {
    render(<Says among={ORDER} said="Merging…" waiting="Merging…" />)

    expect(spoken().map((word) => word.textContent)).toEqual(["Merging…"])
  })

  test("is called by the word it is saying, and not by the circle", () => {
    // The circle carries an accessible name of its own — it is drawn for a
    // running check, where nothing else says so — and on a button the word has
    // already said it. Two names on one control is a button called "Running
    // Merging…".
    render(
      <button type="button">
        <Says among={ORDER} said="Merging…" waiting="Merging…" />
      </button>
    )

    expect(screen.getByRole("button", { name: "Merging…" })).toBeDefined()
  })

  test("turns a circle in front of the word that means GitHub is being asked", () => {
    render(<Says among={ORDER} said="Merging…" waiting="Merging…" />)

    expect(wordFor("Merging…")?.querySelector(".t-rotate")).not.toBeNull()
  })

  test("holds the circle's room in that word while it is not being said", () => {
    /*
     * The room and the circle are separate. Held by the waiting word itself
     * rather than by every word, so the resting button carries no gap in front
     * of its verb, and the circle arrives into space the cell was already as
     * wide as. Nothing turns until it is the word being said: an invisible
     * spinner on each of nine buttons is nine animations nobody asked for.
     */
    render(<Says among={ORDER} said="Squash and merge" waiting="Merging…" />)

    expect(wordFor("Merging…")?.querySelector("[data-room]")).not.toBeNull()
    expect(document.querySelector(".t-rotate")).toBeNull()
  })

  test("turns nothing on a button where none of the words is a wait", () => {
    render(<Says among={["Star", "Starred"]} said="Star" />)

    expect(document.querySelector(".t-rotate")).toBeNull()
    expect(document.querySelector("[data-room]")).toBeNull()
  })

  test("marks the words it has already said, which is the way they leave", () => {
    // A word that has been passed leaves upward and the next one arrives from
    // below, so a press reads as one carousel rather than as words appearing.
    render(<Says among={ORDER} said="Merging…" waiting="Merging…" />)

    expect(wordFor("Squash and merge")?.hasAttribute("data-past")).toBe(true)
    expect(wordFor("Confirm")?.hasAttribute("data-past")).toBe(true)
    expect(wordFor("Merged")?.hasAttribute("data-past")).toBe(false)
  })
})
