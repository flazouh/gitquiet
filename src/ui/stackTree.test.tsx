import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Option } from "effect"
import type { Chain, PullRequestState, Seat } from "../domain/PullRequest"
import { StackTree } from "./StackTree"

afterEach(cleanup)

const layer = (number: number, seat: Seat, state: PullRequestState = "open") => ({
  reference: { owner: "flazouh", repo: "stack-probe", number },
  title: `module ${number}`,
  headBranch: `feat-${number}`,
  state,
  seat
})

const chain = (...layers: ReadonlyArray<ReturnType<typeof layer>>): Chain => ({
  layers,
  floor: Option.some("main")
})

/** The same chain, read from a server that did not name the branch it lands on. */
const unfloored = (built: Chain): Chain => ({ ...built, floor: Option.none() })

/** Twelve layers, read from `at` counted from the foundation. */
const deep = (at: number): Chain =>
  chain(
    ...Array.from({ length: 12 }, (_, index) =>
      layer(index + 1, index === at ? "here" : index < at ? "below" : "above")
    )
  )

const fromTheTop = chain(layer(8, "below"), layer(9, "below"), layer(10, "here"))
const fromTheBottom = chain(layer(8, "here"), layer(9, "above"), layer(10, "above"))

const rows = () => screen.getAllByRole("listitem").map((row) => row.textContent ?? "")

describe("the chain, drawn as a tree over the branch it would land on", () => {
  test("puts the trunk at the head and the newest layer under all of it", () => {
    // The same way up as a pile in the Working Set, and as every other nesting a
    // reader meets: the thing above and to the left, the things that stand on it
    // under it and stepped in.
    render(<StackTree chain={fromTheBottom} />)

    expect(rows().map((text) => text.match(/#\d+/)?.[0] ?? text.trim())).toEqual([
      "main",
      "#8",
      "#9",
      "#10"
    ])
  })

  test("steps each layer in from the one it sits on, deepest at the foot", () => {
    // The tier is a number on the row rather than a nesting, because the strip
    // knows a stack is linear and has no branching to carry. See `stack.css`.
    render(<StackTree chain={fromTheBottom} />)

    const tiers = screen
      .getAllByRole("listitem")
      .map((row) => row.style.getPropertyValue("--stack-tier"))

    expect(tiers).toEqual(["0", "1", "2", "3"])
  })

  test("points each row at what it sits on, the trunk sitting on nothing", () => {
    render(<StackTree chain={fromTheBottom} />)

    const marked = screen
      .getAllByRole("listitem")
      .map((row) => row.querySelector(".t-stack-mark") !== null)

    expect(marked).toEqual([false, true, true, true])
  })

  test("points the foundation at nothing where the trunk is not drawn", () => {
    // Without a trunk row the first layer drawn has nothing above it to point at.
    render(<StackTree chain={unfloored(fromTheTop)} />)

    const marked = screen
      .getAllByRole("listitem")
      .map((row) => row.querySelector(".t-stack-mark") !== null)

    expect(marked).toEqual([false, true, true])
  })

  test("runs down to the trunk from the top of the chain as well as from the foundation", () => {
    // The seat the chain is usually read from. A reader here is three branches
    // away from the thing that lands, and a chain that stops at `#8` says the
    // stack ends there.
    render(<StackTree chain={fromTheTop} />)

    expect(rows().map((text) => text.match(/#\d+/)?.[0] ?? text.trim())).toEqual([
      "main",
      "#8",
      "#9",
      "#10"
    ])
  })

  test("keeps every row out of the gutter, mark or no mark", () => {
    // The gutter is one glyph wide. A row with no mark flows into it unless it
    // is placed by hand, and the whole title goes with it. See `stack.css`.
    render(<StackTree chain={fromTheBottom} />)

    for (const row of screen.getAllByRole("listitem")) {
      expect(row.querySelector(".t-stack-row")).not.toBeNull()
    }
  })

  test("says which layer the reader is standing on", () => {
    render(<StackTree chain={fromTheTop} />)

    expect(screen.getByRole("listitem", { current: true }).textContent).toContain("#10")
  })

  test("names itself with the count, and leaves the word stack to the strip around it", () => {
    // The one place this is drawn is a region named "Proposed stack", so a list
    // saying the same two words is that name read out twice — and the count is
    // the one fact the shape carries that a reader being read to would miss.
    render(<StackTree chain={fromTheTop} />)

    expect(screen.getByRole("list", { name: "Layer 3 of 3" })).toBeTruthy()
  })

  test("makes every other layer a link, and leaves the one being read alone", () => {
    render(<StackTree chain={fromTheTop} />)

    expect(screen.getByRole("link", { name: /module 8/ }).getAttribute("href")).toBe(
      "/flazouh/stack-probe/pull/8"
    )
    expect(screen.queryByRole("link", { name: /module 10/ })).toBeNull()
  })

  test("is not drawn for a chain of one, there being no links in it", () => {
    render(<StackTree chain={chain(layer(8, "here"))} />)

    expect(screen.queryByRole("list")).toBeNull()
  })

  test("draws no trunk row where the payload never named the branch", () => {
    // A server that does not send the stack's own base leaves a seat above the
    // foundation with nothing but the layer underneath it, and a trunk row
    // holding that would say the stack lands on itself. See `Stack.floor`.
    render(<StackTree chain={unfloored(fromTheTop)} />)

    expect(rows()).toHaveLength(3)
    expect(screen.queryByText("main")).toBeNull()
  })
})

describe("a chain nobody has made, which is the claim rather than a report", () => {
  test("colours no row as landing, there being no press to land it", () => {
    // A chain nobody has made lands nothing. Green on a row would say a press
    // of merge takes that layer with it, and here there is no such press.
    const { container } = render(<StackTree chain={fromTheTop} />)

    expect(container.querySelectorAll(".text-pass")).toHaveLength(0)
  })

  test("dims no row for being left out of a press", () => {
    const { container } = render(<StackTree chain={fromTheBottom} />)

    expect(container.querySelectorAll(".opacity-60")).toHaveLength(0)
  })

  test("links its layers up as it arrives", () => {
    render(<StackTree chain={fromTheTop} />)

    expect(screen.getByRole("list").classList.contains("t-stack-linking")).toBe(true)
  })
})

describe("how big each layer of a chain is", () => {
  const counted = new Map([
    [8, { added: 120, deleted: 8 }],
    [9, { added: 4, deleted: 0 }]
  ])

  const rowFor = (number: number) => screen.getByRole("link", { name: new RegExp(`module ${number}`) })

  test("puts the two counts on the row of the layer they are about", () => {
    render(<StackTree chain={fromTheTop} sizes={counted} />)

    expect(rowFor(8).textContent).toContain("+120")
    expect(rowFor(8).textContent).toContain("−8")
    expect(rowFor(9).textContent).toContain("+4")
  })

  test("wears the green and the red every diff in this interface wears", () => {
    render(<StackTree chain={fromTheTop} sizes={counted} />)

    expect(rowFor(8).querySelector(".text-pass")?.textContent).toBe("+120")
    expect(rowFor(8).querySelector(".text-fail")?.textContent).toBe("−8")
  })

  test("writes the removed count with a minus sign and not a hyphen", () => {
    // The header's own pair does, and a hyphen beside a plus reads as a dash
    // between two numbers rather than as a count taken away.
    render(<StackTree chain={fromTheTop} sizes={counted} />)

    expect(rowFor(8).textContent).toContain("−8")
    expect(rowFor(8).textContent).not.toContain("-8")
  })

  test("says the pair in words for a reader who is being read to", () => {
    render(<StackTree chain={fromTheTop} sizes={counted} />)

    expect(screen.getByLabelText("120 added, 8 removed")).toBeTruthy()
  })

  test("leaves a layer nobody has counted exactly as it was", () => {
    // Every row looks like this for the first second, and one whose read failed
    // looks like it for good. A row labelled `+0 −0` would be a four thousand
    // line change called nothing.
    render(<StackTree chain={fromTheTop} sizes={new Map([[8, { added: 120, deleted: 8 }]])} />)

    expect(rowFor(9).textContent).not.toContain("+")
    expect(rowFor(9).querySelector(".text-pass")).toBeNull()
  })

  test("holds no space for a count, so a row that gets one is the only row that changes", () => {
    // The rows link up as they arrive and the counts land in the middle of that
    // run. Everything a row says stands at its leading edge and the row is only
    // as wide as it needs to be, so a count arrives into space nothing was
    // using — where a space held for one would be eighty pixels of empty row on
    // every layer for as long as GitHub takes to answer.
    const { container, rerender } = render(<StackTree chain={fromTheTop} sizes={new Map()} />)
    const waiting = container.innerHTML

    rerender(<StackTree chain={fromTheTop} />)

    expect(container.innerHTML).toBe(waiting)
  })

  test("counts nothing at all where nobody handed it a count", () => {
    render(<StackTree chain={fromTheTop} />)

    expect(screen.queryByText(/^\+/)).toBeNull()
  })
})

describe("a chain too deep to draw whole", () => {
  test("keeps the layer being read in the window, whatever end it is near", () => {
    render(<StackTree chain={deep(6)} most={5} />)

    expect(screen.getByRole("listitem", { current: true }).textContent).toContain("#7")
  })

  test("says how many it left out at each end, rather than cutting silently", () => {
    // "Earlier" and "later", because the chain is drawn in the order it lands, so
    // a seat word would put "4 more below" above everything it is counting.
    render(<StackTree chain={deep(6)} most={5} />)

    expect(screen.getByText("4 earlier layers")).toBeTruthy()
    expect(screen.getByText("3 later layers")).toBeTruthy()
  })

  test("puts what it cut nearer the foundation above the rows, where that end is", () => {
    render(<StackTree chain={deep(6)} most={5} />)

    expect(rows()[0]).toBe("4 earlier layers")
    expect(rows()[rows().length - 1]).toBe("3 later layers")
  })

  test("says nothing about an end it did not cut", () => {
    render(<StackTree chain={deep(11)} most={5} />)

    expect(screen.queryByText(/later layer/)).toBeNull()
    expect(screen.getByText("7 earlier layers")).toBeTruthy()
  })

  test("counts the whole chain in its name, not the part it drew", () => {
    render(<StackTree chain={deep(6)} most={5} />)

    expect(screen.getByRole("list", { name: "Layer 7 of 12" })).toBeTruthy()
  })

  test("holds the trunk back while the window is short of the foundation", () => {
    // The trunk row says what the row under it sits on, and four layers of this
    // one are hidden. Drawn there it would name a branch the first visible layer
    // does not go into, and the count above it already says the chain carries on.
    render(<StackTree chain={deep(6)} most={5} />)

    expect(screen.queryByText("main")).toBeNull()
  })

  test("draws it again as soon as the window reaches the foundation", () => {
    render(<StackTree chain={deep(1)} most={5} />)

    expect(screen.queryByText(/earlier layer/)).toBeNull()
    expect(screen.getByText("main")).toBeTruthy()
  })
})
