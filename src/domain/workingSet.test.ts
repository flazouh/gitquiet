import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { PullRequestState } from "./PullRequest"
import { type CheckRollup, type Opinion, type Shelf, type Weighing, courtOf, SHELVES } from "./workingSet"

/** What the deferred read says, for the two facts the Court now reads. */
type Read = Partial<Pick<Weighing, "checks" | "reviewed">>

const weighing = (
  shelf: Shelf,
  state: PullRequestState = "open",
  standsOnUnlanded = false,
  read: Read = {}
): Weighing => ({
  shelf: Option.some(shelf),
  state,
  standsOnUnlanded,
  // Absent rather than empty, which is what a row looks like before the deferred
  // read answers about it — see the first-paint case below.
  checks: Option.none(),
  reviewed: Option.none(),
  ...read
})

/** A pull request on none of the reader's shelves, as a repository's list is full of. */
const stranger = (state: PullRequestState = "open", standsOnUnlanded = false): Weighing => ({
  shelf: Option.none<Shelf>(),
  state,
  standsOnUnlanded,
  checks: Option.none(),
  reviewed: Option.none()
})

const checks = (state: CheckRollup["state"], passed = 13): Option.Option<CheckRollup> =>
  Option.some({ state, total: 13, passed })

const opinion = (what: Opinion): Option.Option<Opinion> => Option.some(what)

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

  test("one a person has yet to answer about is Waiting", () => {
    expect(
      courtOf(weighing("waiting-for-review", "open", false, { reviewed: opinion("review-required") }))
    ).toBe("waiting")
  })

  test("green with nobody required to look is the Participant's to land", () => {
    // The shelf says waiting-for-review because nobody has answered, and GitHub's
    // own dashboard leaves it there. But `reviewDecision` came back null, which is
    // GitHub saying no rule demands an approval, and the checks came back passing.
    // The merge button is live and the press is the Participant's: a heading that
    // says somebody else owes the next step is a heading that hides the one row on
    // the page that could land today.
    expect(courtOf(weighing("waiting-for-review", "open", false, { checks: checks("passing") }))).toBe(
      "your-move"
    )
  })

  test("green but standing on something unlanded is still Waiting", () => {
    // Nothing above a foundation can land until the foundation does, so the merge
    // button GitHub would offer here is one it would then refuse.
    expect(
      courtOf(weighing("waiting-for-review", "open", true, { checks: checks("passing") }))
    ).toBe("waiting")
  })

  test("checks still running is Running, whoever is waiting for them", () => {
    // Nothing for a person to do at either end. The Participant cannot land it and
    // a reviewer reading it now may be reading a run that fails in a minute.
    expect(courtOf(weighing("waiting-for-review", "open", false, { checks: checks("running", 7) }))).toBe(
      "running"
    )
    expect(
      courtOf(
        weighing("ready-to-merge", "open", false, {
          checks: checks("running", 7),
          reviewed: opinion("approved")
        })
      )
    ).toBe("running")
  })

  test("a run against something to fix is still the Participant's to fix", () => {
    // Running demotes the two shelves that have nothing to do but wait. A review
    // asked of the Participant is answerable now, whatever the build is doing.
    expect(courtOf(weighing("needs-action", "open", false, { checks: checks("running", 7) }))).toBe(
      "your-move"
    )
    expect(
      courtOf(weighing("team-review-requested", "open", false, { checks: checks("running", 7) }))
    ).toBe("your-move")
  })

  test("one GitHub is already landing is Running", () => {
    // A merge queue is GitHub testing it against whatever is ahead of it. There is
    // nothing for the Participant to do but wait, and nobody owes them an answer
    // either: the next step is a machine's.
    expect(courtOf(weighing("merge-queue"))).toBe("running")
  })

  test("before the deferred read answers, the shelf is all there is", () => {
    // The first paint comes out of the store with no standings in it, on purpose:
    // a check rollup from half an hour ago is drawn identically to a live one. So
    // absent checks must read as the shelf alone rather than as a passing run.
    expect(courtOf(weighing("waiting-for-review"))).toBe("waiting")
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

  test("one ready to land above a pull request that has not landed is Waiting", () => {
    // The stack rule, and the one place this improves on GitHub's own answer:
    // `category` is computed per pull request, so GitHub calls the top of a
    // stack ready to merge while the foundation underneath it is still in
    // review. It cannot land, and it is not the Participant's move.
    expect(courtOf(weighing("ready-to-merge", "open", true))).toBe("waiting")
  })

  test("a stack does not excuse the Participant from what is broken", () => {
    // Demoting on the stack applies to landing and nothing else. Failing checks
    // on a child are still the Participant's to fix, and they can be fixed now,
    // before the foundation lands.
    expect(courtOf(weighing("needs-action", "open", true))).toBe("your-move")
    expect(courtOf(weighing("your-drafts", "open", true))).toBe("your-move")
  })

  test("one on none of the shelves is Waiting", () => {
    // A repository's own list is mostly pull requests the reader has nothing to do
    // with, and those arrive through a plain query with no shelf at all. Somebody
    // has to review them or land them, and that somebody is not the reader.
    expect(courtOf(stranger())).toBe("waiting")
  })

  test("and is still Settled once it is merged or closed", () => {
    expect(courtOf(stranger("merged"))).toBe("settled")
    expect(courtOf(stranger("closed"))).toBe("settled")
  })

  test("every shelf lands in some Court", () => {
    // Total by construction. An unhandled shelf that fell through to undefined
    // would leave rows out of every group and so off the screen entirely.
    for (const shelf of SHELVES) {
      expect(["your-move", "waiting", "running", "settled"]).toContain(courtOf(weighing(shelf)))
    }
  })
})
