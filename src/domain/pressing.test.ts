import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { PullRequestState, Seat, Stack } from "./PullRequest"
import { aroundHere, holdingItUp, whichLayer, wouldLand } from "./pressing"

const layer = (number: number, seat: Seat, state: PullRequestState = "open") => ({
  reference: { owner: "flazouh", repo: "stack-probe", number },
  title: `layer ${number}`,
  headBranch: `feat-${number}`,
  state,
  seat
})

/** Nothing here asks what the stack lands on, only which layers do. */
const stack = (...layers: ReadonlyArray<ReturnType<typeof layer>>): Stack => ({
  number: 11,
  layers,
  floor: Option.none()
})

/** Three layers, read from the middle one. */
const fromTheMiddle = stack(layer(8, "below"), layer(9, "here"), layer(10, "above"))

describe("what one press of merge would land", () => {
  test("takes the layer being read and everything under it", () => {
    expect(wouldLand(fromTheMiddle).map((one) => one.reference.number)).toEqual([8, 9])
  })

  test("leaves what is stacked on top of it open", () => {
    expect(wouldLand(fromTheMiddle).some((one) => one.seat === "above")).toBe(false)
  })

  test("is the pull request alone at the foundation", () => {
    const bottom = stack(layer(8, "here"), layer(9, "above"), layer(10, "above"))

    expect(wouldLand(bottom).map((one) => one.reference.number)).toEqual([8])
  })

  test("is the whole stack from the top", () => {
    const top = stack(layer(8, "below"), layer(9, "below"), layer(10, "here"))

    expect(wouldLand(top).map((one) => one.reference.number)).toEqual([8, 9, 10])
  })

  test("counts out a layer that has already landed", () => {
    // Part of a stack may be merged and the rest left open, at which point the
    // layers underneath are in the base branch already. Counting one of those
    // into the press would tell a reader they are landing four pull requests
    // when three of them went in yesterday.
    const half = stack(layer(8, "below", "merged"), layer(9, "here"), layer(10, "above"))

    expect(wouldLand(half).map((one) => one.reference.number)).toEqual([9])
  })
})

describe("what is holding the press up", () => {
  test("is nothing when every layer that would land is ready", () => {
    expect(holdingItUp(fromTheMiddle)).toEqual([])
  })

  test("names a draft underneath, which GitHub's own merge state does not", () => {
    // The whole reason this exists. GitHub answers `MERGEABLE` on the layer
    // being read while a draft sits below it, because that answer is about that
    // one pull request — and the press does not land that one pull request.
    const overADraft = stack(layer(8, "below"), layer(9, "below", "draft"), layer(10, "here"))

    expect(holdingItUp(overADraft).map((one) => one.reference.number)).toEqual([9])
  })

  test("says nothing about a draft stacked on top, which the press does not touch", () => {
    const underADraft = stack(layer(8, "below"), layer(9, "here"), layer(10, "above", "draft"))

    expect(holdingItUp(underADraft)).toEqual([])
  })
})

describe("which layer of the stack is being read", () => {
  test("counts from the foundation, which is where the stack is counted from", () => {
    expect(whichLayer(fromTheMiddle)).toEqual(Option.some({ at: 2, of: 3 }))
  })

  test("is the first layer at the foundation and the last at the top", () => {
    const bottom = stack(layer(8, "here"), layer(9, "above"), layer(10, "above"))
    const top = stack(layer(8, "below"), layer(9, "below"), layer(10, "here"))

    expect(whichLayer(bottom)).toEqual(Option.some({ at: 1, of: 3 }))
    expect(whichLayer(top)).toEqual(Option.some({ at: 3, of: 3 }))
  })

  test("counts a merged layer in, the chain being longer than what is left of it", () => {
    // Not `wouldLand`, which leaves out what has already gone in. A reader on
    // the third of four wants to know they are on the third of four, whatever
    // pressing merge now happens to land.
    const half = stack(layer(8, "below", "merged"), layer(9, "here"), layer(10, "above"))

    expect(whichLayer(half)).toEqual(Option.some({ at: 2, of: 3 }))
  })

  test("is nothing at all when no layer claims the seat", () => {
    // GitHub always marks one entry CURRENT, so this is the shape of a payload
    // that changed under us rather than a state anybody can reach. Returning a
    // layer 0 of 3 would put that in front of a reader as a fact.
    expect(whichLayer(stack(layer(8, "below"), layer(9, "below")))).toEqual(Option.none())
  })
})

describe("the part of a deep stack worth drawing", () => {
  /** A stack of `deep` layers, read from `at` counted from the foundation. */
  const deep = (howMany: number, at: number) =>
    stack(
      ...Array.from({ length: howMany }, (_, index) =>
        layer(index + 1, index === at ? "here" : index < at ? "below" : "above")
      )
    )

  const numbered = (found: ReturnType<typeof aroundHere>) =>
    found.layers.map((one) => one.reference.number)

  test("is all of a stack that already fits", () => {
    const found = aroundHere(deep(3, 1), 7)

    expect(numbered(found)).toEqual([1, 2, 3])
    expect([found.under, found.over]).toEqual([0, 0])
  })

  test("is a window on the layer being read, so the reader never scrolls to find it", () => {
    // Gerrit's rule, and the one thing its panel does that nobody else does:
    // the window centres on the current change rather than starting at one end,
    // so a reader deep in a long chain still lands on their own row.
    const found = aroundHere(deep(12, 6), 5)

    expect(numbered(found)).toEqual([5, 6, 7, 8, 9])
    expect([found.under, found.over]).toEqual([4, 3])
  })

  test("gives the spare room back at the foundation, rather than leaving a gap", () => {
    const found = aroundHere(deep(12, 0), 5)

    expect(numbered(found)).toEqual([1, 2, 3, 4, 5])
    expect([found.under, found.over]).toEqual([0, 7])
  })

  test("and at the top, which is the seat a whole stack is merged from", () => {
    const found = aroundHere(deep(12, 11), 5)

    expect(numbered(found)).toEqual([8, 9, 10, 11, 12])
    expect([found.under, found.over]).toEqual([7, 0])
  })

  test("keeps the top in view when no layer claims the seat", () => {
    // The payload always marks one. Falling back to the foundation would put a
    // reader at the far end of a chain from wherever they actually are.
    const found = aroundHere(stack(...[1, 2, 3, 4].map((n) => layer(n, "above"))), 2)

    expect(numbered(found)).toEqual([3, 4])
  })
})
