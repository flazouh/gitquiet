import { describe, expect, test } from "bun:test"
import type { PullRequestState } from "./PullRequest"
import { type Shelf, courtOf, SHELVES } from "./workingSet"

const weighing = (
  shelf: Shelf,
  state: PullRequestState = "open",
  standsOnUnlanded = false
) => ({ shelf, state, standsOnUnlanded })

describe("which Court a pull request of the Working Set sits in", () => {
  test("GitHub's own three action shelves are Your Move", () => {
    // The whole reason this reads a shelf rather than working the Court out from
    // checks and reviews: GitHub has already decided, for every pull request the
    // Participant is involved in, and it decided server-side in one request.
    expect(courtOf(weighing("needs-action"))).toBe("your-move")
    expect(courtOf(weighing("ready-to-merge"))).toBe("your-move")
    expect(courtOf(weighing("team-review-requested"))).toBe("your-move")
  })

  test("a draft of the Participant's own is theirs to finish", () => {
    expect(courtOf(weighing("your-drafts"))).toBe("your-move")
  })

  test("waiting for someone else's review is Waiting On Others", () => {
    expect(courtOf(weighing("waiting-for-review"))).toBe("waiting-on-others")
  })

  test("one GitHub is already landing is Waiting On Others, not Your Move", () => {
    // A merge queue is GitHub testing it against whatever is ahead of it. There
    // is nothing for the Participant to do but wait, and a row that says Your
    // Move is a row they will open to find no button worth pressing.
    expect(courtOf(weighing("merge-queue"))).toBe("waiting-on-others")
  })

  test("merged and closed are Settled whatever shelf they arrived on", () => {
    // The shelf is a snapshot of a moment and the state outlives it: a pull
    // request read as ready-to-merge and merged a second later must not keep
    // asking to be merged.
    for (const shelf of SHELVES) {
      expect(courtOf(weighing(shelf, "merged"))).toBe("settled")
      expect(courtOf(weighing(shelf, "closed"))).toBe("settled")
    }
  })

  test("one ready to land above a pull request that has not landed is Waiting On Others", () => {
    // The stack rule, and the one place this improves on GitHub's own answer:
    // `category` is computed per pull request, so GitHub calls the top of a
    // stack ready to merge while the foundation underneath it is still in
    // review. It cannot land, and it is not the Participant's move.
    expect(courtOf(weighing("ready-to-merge", "open", true))).toBe("waiting-on-others")
  })

  test("a stack does not excuse the Participant from what is broken", () => {
    // Demoting on the stack applies to landing and nothing else. Failing checks
    // on a child are still the Participant's to fix, and they can be fixed now,
    // before the foundation lands.
    expect(courtOf(weighing("needs-action", "open", true))).toBe("your-move")
    expect(courtOf(weighing("your-drafts", "open", true))).toBe("your-move")
  })

  test("every shelf lands in some Court", () => {
    // Total by construction. An unhandled shelf that fell through to undefined
    // would leave rows out of every group and so off the screen entirely.
    for (const shelf of SHELVES) {
      expect(["your-move", "waiting-on-others", "settled"]).toContain(courtOf(weighing(shelf)))
    }
  })
})
