import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { InvolvedPullRequest, Shelf } from "./workingSet"
import { afterDoing, sittingsIn, worthAskingForBranches } from "./sittings"

const involved = (
  number: number,
  over: Partial<InvolvedPullRequest> = {}
): InvolvedPullRequest => ({
  reference: { owner: "flazouh", repo: "octo-repo", number },
  id: String(number * 1000),
  title: `pull request ${number}`,
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.some<Shelf>("waiting-for-review"),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-01T00:00:00Z",
  headSha: `sha${number}`,
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none(),
  ...over
})

const on = (shelf: Shelf, number: number, over: Partial<InvolvedPullRequest> = {}) =>
  involved(number, { shelf: Option.some(shelf), ...over })

/** Nothing knows any branches, which is the state the first paint is in. */
const noBranches = () => Option.none()

const branchesFrom = (known: Record<number, [string, string]>) =>
  (one: InvolvedPullRequest) => {
    const found = known[one.reference.number]
    return found === undefined
      ? Option.none()
      : Option.some({ baseBranch: found[0], headBranch: found[1] })
  }

describe("arranging the Working Set into Courts", () => {
  test("puts each pull request in the Court its shelf implies", () => {
    // A draft is Needs You, not settled — it is the Author's to finish. Settled
    // is what landing or closing makes a pull request.
    const sittings = sittingsIn(
      [
        on("needs-action", 1),
        on("waiting-for-review", 2),
        on("ready-to-merge", 3, { state: "merged" })
      ],
      noBranches
    )

    expect(sittings.map((sitting) => sitting.court)).toEqual([
      "needs-you",
      "waiting",
      "settled"
    ])
  })

  test("reads in the order the Courts matter", () => {
    // Needs You first, always. It is the only one of the three that is a request.
    const sittings = sittingsIn(
      [on("waiting-for-review", 1, { state: "closed" }), on("needs-action", 2)],
      noBranches
    )

    expect(sittings.map((sitting) => sitting.court)).toEqual(["needs-you", "settled"])
  })

  test("leaves out a Court with nothing in it", () => {
    // An empty heading is a heading that costs a line and says nothing. GitHub
    // draws six shelves whether or not they have anything on them.
    const sittings = sittingsIn([on("needs-action", 1)], noBranches)

    expect(sittings).toHaveLength(1)
  })

  test("shows a pull request once, in the more urgent of the two Courts", () => {
    // The shelves overlap: the same pull request can be waiting for review and
    // ready to merge. Drawn twice it would be acted on twice.
    const sittings = sittingsIn(
      [on("waiting-for-review", 7), on("ready-to-merge", 7)],
      noBranches
    )

    expect(sittings.map((sitting) => sitting.court)).toEqual(["needs-you"])
    expect(sittings[0]?.count).toBe(1)
  })

  test("puts the most recently changed first within a Court", () => {
    const sittings = sittingsIn(
      [
        on("needs-action", 1, { changedAt: "2026-07-01T00:00:00Z" }),
        on("needs-action", 2, { changedAt: "2026-07-20T00:00:00Z" }),
        on("needs-action", 3, { changedAt: "2026-07-10T00:00:00Z" })
      ],
      noBranches
    )

    expect(sittings[0]?.piles.map((pile) => pile.one.reference.number)).toEqual([2, 3, 1])
  })

  test("draws a pull request whose branches nobody knows on its own", () => {
    // The first paint has two requests' worth of rows and no branches at all.
    // Every row is still a row; none of them is yet known to be in a stack.
    const sittings = sittingsIn([on("needs-action", 1), on("needs-action", 2)], noBranches)

    expect(sittings[0]?.piles).toHaveLength(2)
    expect(sittings[0]?.piles.every((pile) => pile.above.length === 0)).toBe(true)
  })
})

describe("a stack in the Working Set", () => {
  const chain = [
    on("needs-action", 1, { changedAt: "2026-07-01T00:00:00Z" }),
    on("ready-to-merge", 2, { changedAt: "2026-07-02T00:00:00Z" }),
    on("ready-to-merge", 3, { changedAt: "2026-07-03T00:00:00Z" })
  ]

  const branches = branchesFrom({
    1: ["main", "stack-1"],
    2: ["stack-1", "stack-2"],
    3: ["stack-2", "stack-3"]
  })

  test("draws as one pile, with the pull request nearest trunk at the bottom", () => {
    const sittings = sittingsIn(chain, branches)

    expect(sittings).toHaveLength(1)
    expect(sittings[0]?.piles).toHaveLength(1)
    expect(sittings[0]?.piles[0]?.one.reference.number).toBe(1)
    expect(sittings[0]?.piles[0]?.above[0]?.one.reference.number).toBe(2)
    expect(sittings[0]?.piles[0]?.above[0]?.above[0]?.one.reference.number).toBe(3)
  })

  test("sits in the Court of its foundation, because nothing above it can land first", () => {
    // Two of the three say ready-to-merge. Neither is: the one underneath them
    // needs work, and until it lands they cannot. Filing them under Needs You
    // would ask the reader to merge something GitHub would refuse.
    const sittings = sittingsIn(chain, branches)

    expect(sittings.map((sitting) => sitting.court)).toEqual(["needs-you"])
  })

  test("counts everything in it, not just the pile it draws as", () => {
    const sittings = sittingsIn(chain, branches)

    expect(sittings[0]?.count).toBe(3)
  })

  test("says of each pull request above that it is waiting, whatever its shelf said", () => {
    // `ready-to-merge` is GitHub's answer about one pull request in isolation.
    // Read as part of a stack it is wrong, and the row should not claim it.
    const sittings = sittingsIn(chain, branches)
    const above = sittings[0]?.piles[0]?.above[0]

    expect(above?.one.shelf).toEqual(Option.some("ready-to-merge"))
    expect(above?.court).toBe("waiting")
  })

  test("stops waiting once what it stands on has landed", () => {
    const landed = [
      on("needs-action", 1, { state: "merged" }),
      on("ready-to-merge", 2)
    ]

    const sittings = sittingsIn(landed, branchesFrom({ 1: ["main", "stack-1"], 2: ["stack-1", "stack-2"] }))
    const above = sittings[0]?.piles[0]?.above[0]

    expect(above?.court).toBe("needs-you")
  })

  test("does not stack pull requests that only share branch names across repositories", () => {
    // Every repository has a `main`. Matching across them would file an entire
    // Working Set into one stack that does not exist.
    const elsewhere = involved(9, {
      shelf: Option.some<Shelf>("needs-action"),
      reference: { owner: "flazouh", repo: "other", number: 9 }
    })

    const sittings = sittingsIn(
      [on("needs-action", 1), elsewhere],
      (one) =>
        Option.some(
          one.reference.repo === "other"
            ? { baseBranch: "stack-1", headBranch: "stack-2" }
            : { baseBranch: "main", headBranch: "stack-1" }
        )
    )

    expect(sittings[0]?.piles).toHaveLength(2)
  })
})

describe("what the list looks like the instant a verb lands", () => {
  test("moves a closed one into Settled, without waiting to be told", () => {
    const sittings = sittingsIn([on("needs-action", 1), on("waiting-for-review", 2)], noBranches)

    const after = afterDoing(sittings, "close", {
      owner: "flazouh",
      repo: "octo-repo",
      number: 1
    })

    expect(after.map((sitting) => [sitting.court, sitting.count])).toEqual([
      ["waiting", 1],
      ["settled", 1]
    ])
  })

  test("empties a Court it was the last one in", () => {
    const sittings = sittingsIn([on("needs-action", 1)], noBranches)

    const after = afterDoing(sittings, "merge", { owner: "flazouh", repo: "octo-repo", number: 1 })

    expect(after.map((sitting) => sitting.court)).toEqual(["settled"])
  })

  test("wears the state each verb leads to", () => {
    const sittings = sittingsIn([on("your-drafts", 1, { state: "draft" })], noBranches)

    const ready = afterDoing(sittings, "markReady", {
      owner: "flazouh",
      repo: "octo-repo",
      number: 1
    })

    expect(ready[0]?.piles[0]?.one.state).toBe("open")

    const back = afterDoing(ready, "toDraft", { owner: "flazouh", repo: "octo-repo", number: 1 })

    expect(back[0]?.piles[0]?.one.state).toBe("draft")
  })

  test("frees what was standing on it once the foundation lands", () => {
    /*
     * The reason this cannot be a patch to one row. A pull request that is ready
     * to merge but sitting on an unlanded one is Waiting on Others, and the
     * moment the foundation lands it is the reader's move — so a merge changes
     * the Court of a row nobody pressed anything on.
     */
    const sittings = sittingsIn(
      [
        on("ready-to-merge", 1),
        on("ready-to-merge", 2, { changedAt: "2026-07-02T00:00:00Z" })
      ],
      branchesFrom({ 1: ["main", "one"], 2: ["one", "two"] })
    )

    expect(sittings.map((sitting) => sitting.court)).toEqual(["needs-you"])
    expect(sittings[0]?.piles[0]?.above[0]?.court).toBe("waiting")

    const after = afterDoing(sittings, "merge", { owner: "flazouh", repo: "octo-repo", number: 1 })

    expect(after[0]?.piles[0]?.above[0]?.court).toBe("needs-you")
  })

  test("leaves a list it cannot find the row in exactly as it was", () => {
    const sittings = sittingsIn([on("needs-action", 1)], noBranches)

    const after = afterDoing(sittings, "close", { owner: "flazouh", repo: "other", number: 1 })

    expect(after).toBe(sittings)
  })
})

describe("which pull requests are worth asking branches for", () => {
  test("asks nothing about a repository holding only one", () => {
    // A stack needs two pull requests in the same repository. One row cannot be
    // stacked on anything the reader can see, so the request would buy nothing.
    expect(worthAskingForBranches([involved(1)])).toEqual([])
  })

  test("asks about both when a repository holds two", () => {
    expect(worthAskingForBranches([involved(1), involved(2)]).map((one) => one.number)).toEqual([
      1, 2
    ])
  })

  test("asks only about the crowded repositories", () => {
    const alone = involved(5, { reference: { owner: "flazouh", repo: "alone", number: 5 } })

    const asked = worthAskingForBranches([involved(1), involved(2), alone])

    expect(asked.map((one) => `${one.repo}#${one.number}`)).toEqual(["octo-repo#1", "octo-repo#2"])
  })

  test("does not ask twice about a pull request that came from two shelves", () => {
    const asked = worthAskingForBranches([
      on("waiting-for-review", 1),
      on("ready-to-merge", 1),
      involved(2)
    ])

    expect(asked.map((one) => one.number)).toEqual([1, 2])
  })
})
