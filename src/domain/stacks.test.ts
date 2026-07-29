import { describe, expect, test } from "bun:test"
import { type Placed, stacksIn } from "./stacks"

const at = (repo: string, number: number, headBranch: string, baseBranch: string): Placed => ({
  reference: { owner: "acme", repo, number },
  headBranch,
  baseBranch
})

/** The shape of a grown stack, as branch names, which is what the edges are made of. */
const outline = (
  stacks: ReadonlyArray<{ readonly member: Placed; readonly above: ReadonlyArray<unknown> }>
): unknown =>
  stacks.map((stack) => ({
    head: stack.member.headBranch,
    above: outline(
      stack.above as ReadonlyArray<{ member: Placed; above: ReadonlyArray<unknown> }>
    )
  }))

describe("finding the stacks among a set of pull requests", () => {
  test("one based on trunk stands on its own", () => {
    expect(outline(stacksIn([at("ori", 1, "feature", "main")]))).toEqual([
      { head: "feature", above: [] }
    ])
  })

  test("one based on another's branch sits above it", () => {
    // The whole edge rule: a child merges into the parent's branch, so the
    // parent's head is the child's base. Nothing else says they are related —
    // there is no stack identifier in any payload GitHub serves.
    const stacks = stacksIn([at("ori", 2, "second", "first"), at("ori", 1, "first", "main")])

    expect(outline(stacks)).toEqual([
      { head: "first", above: [{ head: "second", above: [] }] }
    ])
  })

  test("a chain of three nests all the way down", () => {
    const stacks = stacksIn([
      at("ori", 3, "third", "second"),
      at("ori", 1, "first", "main"),
      at("ori", 2, "second", "first")
    ])

    expect(outline(stacks)).toEqual([
      { head: "first", above: [{ head: "second", above: [{ head: "third", above: [] }] }] }
    ])
  })

  test("branches of the same name in different repositories never join", () => {
    // Every repository has a `main`, and most have a `develop`. Matching on the
    // branch name alone would file the whole Working Set into one false stack,
    // which is the first thing this had to be proof against.
    const stacks = stacksIn([at("ori", 1, "main", "trunk"), at("fluentai", 2, "trunk", "main")])

    expect(outline(stacks)).toEqual([
      { head: "trunk", above: [] },
      { head: "main", above: [] }
    ])
  })

  test("two roots come back as two stacks, in number order", () => {
    const stacks = stacksIn([
      at("ori", 7, "seven", "main"),
      at("ori", 3, "three", "main"),
      at("ori", 8, "eight", "seven")
    ])

    expect(outline(stacks)).toEqual([
      { head: "three", above: [] },
      { head: "seven", above: [{ head: "eight", above: [] }] }
    ])
  })

  test("siblings on the same parent come back in number order", () => {
    const stacks = stacksIn([
      at("ori", 1, "first", "main"),
      at("ori", 9, "late", "first"),
      at("ori", 4, "early", "first")
    ])

    expect(outline(stacks)).toEqual([
      {
        head: "first",
        above: [
          { head: "early", above: [] },
          { head: "late", above: [] }
        ]
      }
    ])
  })

  test("one whose base has no pull request of its own is a root", () => {
    // The ordinary way a stack ends: the parent was merged and its pull request
    // is no longer in the Working Set, while the child still points at a branch
    // that outlived it.
    expect(outline(stacksIn([at("ori", 2, "second", "first")]))).toEqual([
      { head: "second", above: [] }
    ])
  })

  test("a cycle neither hangs nor loses a member", () => {
    // Two pull requests each based on the other cannot happen in git, but a
    // payload is not git: a stale read of one and a fresh read of the other is
    // enough. A tree walk with no guard against this recurses until the stack
    // runs out, and it takes the whole interface with it.
    const stacks = stacksIn([at("ori", 1, "first", "second"), at("ori", 2, "second", "first")])

    const heads: Array<string> = []
    const walk = (nodes: ReadonlyArray<{ member: Placed; above: ReadonlyArray<unknown> }>): void => {
      for (const node of nodes) {
        heads.push(node.member.headBranch)
        walk(node.above as ReadonlyArray<{ member: Placed; above: ReadonlyArray<unknown> }>)
      }
    }
    walk(stacks as ReadonlyArray<{ member: Placed; above: ReadonlyArray<unknown> }>)

    expect(heads.toSorted()).toEqual(["first", "second"])
  })

  test("nothing in gives nothing back", () => {
    expect(stacksIn([])).toEqual([])
  })

  test("the branch names GitHub really returns for a real stack", () => {
    // Read off flazouh/stack-probe, three pull requests chained main <- 1 <- 2
    // <- 3, through the merge_box route the gateway already fetches. Recorded
    // here because the same probe established that `stackPosition` and
    // `stackSize` come back null for a stack built this way, so these two
    // branch names are the only evidence a stack exists at all.
    const stacks = stacksIn([
      { reference: { owner: "flazouh", repo: "stack-probe", number: 1 }, baseBranch: "main", headBranch: "stack-1" },
      { reference: { owner: "flazouh", repo: "stack-probe", number: 2 }, baseBranch: "stack-1", headBranch: "stack-2" },
      { reference: { owner: "flazouh", repo: "stack-probe", number: 3 }, baseBranch: "stack-2", headBranch: "stack-3" }
    ])

    expect(outline(stacks)).toEqual([
      { head: "stack-1", above: [{ head: "stack-2", above: [{ head: "stack-3", above: [] }] }] }
    ])
  })

  test("every member appears exactly once, whatever the shape", () => {
    // The invariant the Working Set view depends on: a row rendered twice is a
    // pull request the reader acts on twice, and a row lost is one they never
    // see at all.
    const members = [
      at("ori", 1, "first", "main"),
      at("ori", 2, "second", "first"),
      at("ori", 3, "third", "second"),
      at("ori", 4, "loop-a", "loop-b"),
      at("ori", 5, "loop-b", "loop-a"),
      at("fluentai", 6, "first", "main"),
      at("ori", 7, "orphan", "long-gone")
    ]

    const seen: Array<number> = []
    const walk = (nodes: ReadonlyArray<{ member: Placed; above: ReadonlyArray<unknown> }>): void => {
      for (const node of nodes) {
        seen.push(node.member.reference.number)
        walk(node.above as ReadonlyArray<{ member: Placed; above: ReadonlyArray<unknown> }>)
      }
    }
    walk(stacksIn(members) as ReadonlyArray<{ member: Placed; above: ReadonlyArray<unknown> }>)

    expect(seen.toSorted((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
