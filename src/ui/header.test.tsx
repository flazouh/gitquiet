import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Option } from "effect"
import { AUTHOR, aMergeState, aSnapshot } from "../../tests/snapshots"
import type { Seat } from "../domain/PullRequest"
import { Header } from "./Header"

afterEach(cleanup)

/** Long enough ago that ages are printed as dates, so the clock cannot move them. */
const OPENED = "2024-02-28T09:00:00Z"
const ENDED = "2024-03-02T10:00:00Z"

describe("the badge that says where a pull request stands", () => {
  test("says when it landed, beside the word", () => {
    // "Merged" on its own answers half the question a reader arriving at a
    // pull request has. Merged an hour ago and merged in March are different
    // situations, and the moment is already in a payload the card reads.
    render(
      <Header
        snapshot={aSnapshot({
          state: "merged",
          openedAt: Option.some(OPENED),
          closedAt: Option.some(ENDED),
          mergedAt: Option.some(ENDED)
        })}
      />
    )

    const badge = screen.getByLabelText("Merged 2 Mar")
    expect(badge.textContent).toContain("Merged")
    expect(badge.textContent).toContain("2 Mar")
  })

  test("says when it was opened, on one that is still open", () => {
    render(<Header snapshot={aSnapshot({ state: "open", openedAt: Option.some(OPENED) })} />)

    const badge = screen.getByLabelText("Open 28 Feb")
    expect(badge.textContent).toContain("Open")
    expect(badge.textContent).toContain("28 Feb")
  })

  test("says when it was opened, on a draft, since that is when it began", () => {
    render(<Header snapshot={aSnapshot({ state: "draft", openedAt: Option.some(OPENED) })} />)

    expect(screen.getByLabelText("Draft 28 Feb").textContent).toContain("28 Feb")
  })

  test("says when it closed, on a closed one, rather than when it opened", () => {
    // The moment the badge carries is the moment the badge is about: how long
    // it was open before it was abandoned is a different question, and the
    // opening date under the word "Closed" would read as the closing date.
    render(
      <Header
        snapshot={aSnapshot({
          state: "closed",
          openedAt: Option.some(OPENED),
          closedAt: Option.some(ENDED)
        })}
      />
    )

    expect(screen.getByLabelText("Closed 2 Mar").textContent).toContain("2 Mar")
  })

  test("carries the whole timestamp and the verb for the hover, since the age is a rounding", () => {
    render(<Header snapshot={aSnapshot({ state: "open", openedAt: Option.some(OPENED) })} />)

    // Read for what it carries rather than character by character. Whether the
    // date and the time are joined by "at" or a comma is ICU's decision, and it
    // is made differently by the version on a Mac and the one on a build runner.
    const hover = screen.getByLabelText("Open 28 Feb").title
    expect(hover).toContain("Opened")
    expect(hover).toContain("28 Feb 2024")
    expect(hover).toContain("09:00")
  })

  test("says the word alone where GitHub sends no moment for it", () => {
    // A payload that stopped carrying the moment costs the age, not the badge.
    render(<Header snapshot={aSnapshot({ state: "open" })} />)

    const badge = screen.getByLabelText("Open")
    expect(badge.textContent).toBe("Open")
    expect(badge.title).toBe("")
  })
})

describe("the number that names the pull request", () => {
  /** The element holding `#7`, wherever on the card it ended up. */
  const number = (): HTMLElement => {
    const found = screen.getByText("#7")
    expect(found).toBeDefined()
    return found
  }

  test("stands outside the heading, so a long title cannot cut it", () => {
    // It rode at the end of the heading once, inside the same `truncate`, and on a long title the
    // one fact a reader says out loud was the first character to go: "#2…".
    render(<Header snapshot={aSnapshot({ state: "open", title: "A".repeat(400) })} />)

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.contains(number())).toBe(false)
    expect(number().className).not.toContain("truncate")
  })

  test("reads as the first word of the heading rather than as a thing beside it", () => {
    // In a box of its own with the title, at that box's smaller gap, so the two are one heading with
    // a space in it rather than two objects on a row. Sharing the row was not enough: at the row's
    // gap the number stood as far from the title as the badge stands from the number.
    render(<Header snapshot={aSnapshot({ state: "open" })} />)

    const heading = screen.getByRole("heading", { level: 1 })
    const badge = screen.getByLabelText("Open")
    const held = number().parentElement

    expect(number().nextElementSibling).toBe(heading)
    expect(held?.contains(heading)).toBe(true)
    expect(held?.contains(badge)).toBe(false)
  })

  test("carries no fill and no ink of its own, because the title is what this row is for", () => {
    // A filled chip at the title's own size made the row read badge, badge, title, and the second
    // heaviest thing on the card was a number. Nothing else in this interface draws a box it does
    // not need: see `dress.ts`. Muted so the name of the pull request stays the brightest thing on
    // its own heading.
    render(<Header snapshot={aSnapshot({ state: "open" })} />)

    const dressed = number().className.split(/\s+/)
    expect(dressed.filter((one) => one.startsWith("bg-"))).toEqual([])
    expect(dressed).toContain("text-ink-muted")
  })
})

describe("the line that says who wants to merge what", () => {
  test("puts the author's face beside their login", () => {
    // A login is read letter by letter; a face is recognised. The same face
    // this reader already knows from the list they arrived from.
    render(<Header snapshot={aSnapshot({ state: "open" })} />)

    expect(screen.getByRole("img", { name: AUTHOR })).toBeDefined()
  })
})

describe("a pull request that is one layer of a stack", () => {
  const inAStack = (seats: ReadonlyArray<Seat>) =>
    aSnapshot({
      state: "open",
      headBranch: "feat-c",
      baseBranch: "feat-b",
      merge: aMergeState({
        stack: Option.some({
          number: 11,
          floor: Option.none(),
          layers: seats.map((seat, index) => ({
            reference: { owner: "acme", repo: "widgets", number: 8 + index },
            title: `module ${8 + index}`,
            headBranch: `feat-${index}`,
            state: "open" as const,
            seat
          }))
        })
      })
    })

  test("says which layer it is, beside the branches that are the reason to ask", () => {
    // Both branches on a stacked pull request are feature branches, and nothing
    // about `feat-c` going into `feat-b` says whether one more of these follows
    // or eleven do. This is the fact GitHub's preview readers said they lost.
    render(<Header snapshot={inAStack(["below", "below", "here"])} />)

    const said = screen.getByLabelText("Layer 3 of 3 in a stack")

    expect(said.textContent).toContain("3 of 3")
    expect(said.previousElementSibling?.textContent).toBe("feat-b")
  })

  test("counts from the foundation, so the bottom layer is the first", () => {
    render(<Header snapshot={inAStack(["here", "above", "above"])} />)

    expect(screen.getByLabelText("Layer 1 of 3 in a stack").textContent).toContain("1 of 3")
  })

  test("says nothing on a pull request standing on its own", () => {
    render(<Header snapshot={aSnapshot({ state: "open" })} />)

    expect(screen.queryByText(/of 3/)).toBeNull()
  })

  test("says nothing about a stack of one, which is a chain with no links", () => {
    render(<Header snapshot={inAStack(["here"])} />)

    expect(screen.queryByText(/1 of 1/)).toBeNull()
    expect(screen.queryByRole("list", { name: /Stack/ })).toBeNull()
  })

  test("draws the chain under the branches, trunk first and newest last", () => {
    // The count says which layer of how many. It cannot say what the other
    // layers are, nor which way the chain is going, and both are why a reader
    // opens the stack at all.
    render(<Header snapshot={inAStack(["below", "below", "here"])} />)

    const drawn = screen.getByRole("list", { name: "Stack, layer 3 of 3" })

    expect([...drawn.querySelectorAll("li")].map((row) => row.textContent)).toEqual([
      "#8module 8",
      "#9module 9",
      "#10module 10"
    ])
  })

  test("draws no chain on a pull request standing on its own", () => {
    render(<Header snapshot={aSnapshot({ state: "open" })} />)

    expect(screen.queryByRole("list", { name: /Stack/ })).toBeNull()
  })

  test("counts no lines on the rows of a chain that exists", () => {
    // The proposal strip counts its rows and this tree does not. A reader here
    // is standing in a chain GitHub already holds, one layer at a time: the
    // well directly above this list carries the counts for the layer they are
    // on, and every other layer is a page this extension draws, whose own
    // header counts its lines when they get there. Each count is also a request
    // of its own, and this tree is drawn on every layer of every stack.
    render(<Header snapshot={inAStack(["below", "below", "here"])} />)

    const drawn = screen.getByRole("list", { name: "Stack, layer 3 of 3" })

    expect(drawn.textContent).not.toMatch(/[+\u2212]\d/)
  })
})
