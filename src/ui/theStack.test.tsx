import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Option } from "effect"
import type { PullRequestState, Seat, Stack } from "../domain/PullRequest"
import { TheStack } from "./TheStack"

afterEach(cleanup)

const layer = (number: number, seat: Seat, state: PullRequestState = "open") => ({
  reference: { owner: "flazouh", repo: "stack-probe", number },
  title: `module ${number}`,
  headBranch: `feat-${number}`,
  state,
  seat
})

const stack = (...layers: ReadonlyArray<ReturnType<typeof layer>>): Stack => ({
  number: 11,
  layers,
  // One branch for the whole stack, which the payload names from every seat in
  // it. See `Stack.floor`.
  floor: Option.some("main")
})

/** The same stack, read from a server that did not name the branch it lands on. */
const unfloored = (built: Stack): Stack => ({ ...built, floor: Option.none() })

/** Three layers, read from the top, which is the seat that lands all of them. */
const fromTheTop = stack(layer(8, "below"), layer(9, "below"), layer(10, "here"))

/** The same three read from the middle, where a press leaves the top open. */
const fromTheMiddle = stack(layer(8, "below"), layer(9, "here"), layer(10, "above"))

/** And from the foundation, the seat a press lands the least from. */
const fromTheBottom = stack(layer(8, "here"), layer(9, "above"), layer(10, "above"))

const rows = () => screen.getAllByRole("listitem").map((row) => row.textContent ?? "")

describe("the stack a pull request is one layer of", () => {
  test("draws every layer of it", () => {
    render(<TheStack stack={fromTheTop} />)

    expect(rows()).toHaveLength(3)
  })

  test("draws the branch the whole thing lands on, under the foundation", () => {
    render(<TheStack stack={fromTheBottom} />)

    expect(screen.getByText("main")).toBeTruthy()
  })

  test("says which way the trunk row goes in a word, not in a mark", () => {
    // The mark belongs on the row that sits on something, which here is the
    // foundation above. This list has no gutter to hang it in, so on the trunk's
    // own row it pointed the opposite way to every mark in the header's tree.
    render(<TheStack stack={fromTheBottom} />)

    expect(screen.getByText(/onto/).textContent).toContain("main")
  })

  test("is not drawn at all for a stack of one, there being no chain to read", () => {
    // GitHub keeps a stack of one and lands it through the stack route, so the
    // fact is real; it is just not worth a panel. A list with one row in it and
    // a sentence saying the press lands that one row is the whole merge card
    // said twice.
    render(<TheStack stack={stack(layer(8, "here"))} />)

    expect(screen.queryByRole("listitem")).toBeNull()
    expect(screen.queryByText(/This press lands/)).toBeNull()
  })

  test("names it from the top of the stack too, where a press lands the whole chain", () => {
    // The seat this panel matters most on: one press here lands three pull
    // requests into a branch nothing else on the card names.
    render(<TheStack stack={fromTheTop} />)

    expect(screen.getByText(/onto/).textContent).toContain("main")
  })

  test("draws no floor where the decoder could not name one", () => {
    // A server that does not send the stack's own base leaves a seat above the
    // foundation with the layer directly underneath and nothing else — see
    // `Stack.floor`. An empty space says less than a wrong branch does.
    render(<TheStack stack={unfloored(fromTheTop)} />)

    expect(screen.queryByText("main")).toBeNull()
  })

  test("draws the foundation first, in the order the layers land", () => {
    // The way up the Working Set draws a pile and the way up the tree at the top
    // of this screen draws the same chain. Two drawings of one stack running
    // opposite ways on one screen is a reader having to notice the disagreement
    // before reading either.
    render(<TheStack stack={fromTheTop} />)

    expect(rows().map((text) => text.match(/#\d+/)?.[0])).toEqual(["#8", "#9", "#10"])
  })

  test("numbers each row with its place in the chain, counted from the foundation", () => {
    // The count the header's chip carries, findable on the rows themselves: a
    // reader six layers up sees at a glance which layer of the list they are
    // reading without counting rows.
    render(<TheStack stack={fromTheTop} />)

    expect(rows()).toEqual(["1#8module 8", "2#9module 9", "3#10module 10"])
  })

  test("says which layer the reader is standing on", () => {
    render(<TheStack stack={fromTheMiddle} />)

    const here = screen.getByRole("listitem", { current: true })

    expect(here.textContent).toContain("#9")
  })

  test("says how many pull requests one press would land", () => {
    render(<TheStack stack={fromTheTop} />)

    expect(screen.getByText("This press lands all 3 layers")).toBeTruthy()
  })

  test("says both rather than all 2, a stack of two being the commonest one", () => {
    render(<TheStack stack={stack(layer(8, "below"), layer(9, "here"))} />)

    expect(screen.getByText("This press lands both layers")).toBeTruthy()
  })

  test("counts only down to here, and says what stays open", () => {
    render(<TheStack stack={fromTheMiddle} />)

    expect(screen.getByText("This press lands 2 of 3 layers")).toBeTruthy()
    expect(screen.getByText("1 above stays open")).toBeTruthy()
  })

  test("names a draft in the way, which is what makes the press impossible", () => {
    const overADraft = stack(layer(8, "below"), layer(9, "below", "draft"), layer(10, "here"))

    render(<TheStack stack={overADraft} />)

    expect(screen.getByText("#9 is a draft")).toBeTruthy()
    expect(screen.getByText(/Mark it ready first/)).toBeTruthy()
  })

  test("reads two of them as a sentence rather than as a joined list", () => {
    const overTwo = stack(layer(8, "below", "draft"), layer(9, "below", "draft"), layer(10, "here"))

    render(<TheStack stack={overTwo} />)

    expect(screen.getByText("#8 and #9 are drafts")).toBeTruthy()
    expect(screen.getByText(/Mark them ready first/)).toBeTruthy()
  })

  test("marks the holding row itself, not only the sentence under the list", () => {
    // The research finding worth acting on: a reader who cannot see why the
    // button is grey takes the pull request out of the stack to escape it. A
    // grey Draft says what a layer is; a red one says it is the hold-up.
    const overADraft = stack(layer(8, "below"), layer(9, "below", "draft"), layer(10, "here"))

    render(<TheStack stack={overADraft} />)

    expect(screen.getByText("Draft").className).toContain("text-fail")
  })

  test("says nothing about a draft above, which the press does not touch", () => {
    const underADraft = stack(layer(8, "below"), layer(9, "here"), layer(10, "above", "draft"))

    render(<TheStack stack={underADraft} />)

    expect(screen.queryByText(/is a draft/i)).toBeNull()
    expect(screen.getByText("Draft").className).not.toContain("text-fail")
  })

  test("makes every other layer a link, which the screen answers without a document", () => {
    // A link rather than a handler, so a copied address, a middle click and the
    // back button all keep working; `going.ts` catches the press because the
    // page it names is one this extension draws.
    render(<TheStack stack={fromTheMiddle} />)

    expect(screen.getByRole("link", { name: /module 8/ }).getAttribute("href")).toBe(
      "/flazouh/stack-probe/pull/8"
    )
  })

  test("leaves the layer being read unpressable, the reader being on it", () => {
    render(<TheStack stack={fromTheMiddle} />)

    expect(screen.queryByRole("link", { name: /module 9/ })).toBeNull()
  })
})
