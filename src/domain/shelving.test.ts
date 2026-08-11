import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { shelfOf, type Standing } from "./shelving"
import type { CheckRollup, Opinion } from "./workingSet"

/** A pull request somebody else wrote, that nobody has asked the reader about. */
const standing = (over: Partial<Standing> = {}): Standing => ({
  viewerIsAuthor: false,
  draft: false,
  inMergeQueue: false,
  askedOfViewer: false,
  askedOfTeam: false,
  reviewed: Option.none(),
  checks: Option.none(),
  ...over
})

const checks = (state: CheckRollup["state"]): Option.Option<CheckRollup> =>
  Option.some({ state, total: 4, passed: state === "passing" ? 4 : 2 })

const opinion = (of: Opinion) => Option.some(of)

describe("what GitHub's dashboard would have called it", () => {
  test("a pull request the reader is only mentioned in is on no shelf at all", () => {
    expect(shelfOf(standing())).toEqual(Option.none())
  })

  test("being asked personally is the reader's move, whoever else was asked", () => {
    expect(shelfOf(standing({ askedOfViewer: true, askedOfTeam: true }))).toEqual(
      Option.some("needs-action")
    )
  })

  test("a team the reader is in being asked is the team's shelf", () => {
    expect(shelfOf(standing({ askedOfTeam: true }))).toEqual(
      Option.some("team-review-requested")
    )
  })

  test("the merge queue outranks everything, including being asked to review", () => {
    expect(shelfOf(standing({ inMergeQueue: true, askedOfViewer: true }))).toEqual(
      Option.some("merge-queue")
    )
  })

  describe("the reader's own pull requests", () => {
    const mine = (over: Partial<Standing> = {}) => standing({ viewerIsAuthor: true, ...over })

    test("a draft is theirs to finish, even with the checks against it", () => {
      expect(shelfOf(mine({ draft: true, checks: checks("failing") }))).toEqual(
        Option.some("your-drafts")
      )
    })

    test("failing checks are theirs to fix", () => {
      expect(shelfOf(mine({ checks: checks("failing") }))).toEqual(Option.some("needs-action"))
    })

    test("changes requested are theirs to make", () => {
      expect(shelfOf(mine({ reviewed: opinion("changes-requested") }))).toEqual(
        Option.some("needs-action")
      )
    })

    test("approved and green is theirs to land", () => {
      expect(shelfOf(mine({ reviewed: opinion("approved"), checks: checks("passing") }))).toEqual(
        Option.some("ready-to-merge")
      )
    })

    test("approved with no checks configured is still theirs to land", () => {
      expect(shelfOf(mine({ reviewed: opinion("approved") }))).toEqual(
        Option.some("ready-to-merge")
      )
    })

    /**
     * The one case worth stating twice: approved is not ready while a check is
     * still running, because the button it would put in front of somebody is a
     * button GitHub will refuse.
     */
    test("approved with checks still running is not ready to land", () => {
      expect(shelfOf(mine({ reviewed: opinion("approved"), checks: checks("running") }))).toEqual(
        Option.some("waiting-for-review")
      )
    })

    test("nobody has looked yet, so it waits", () => {
      expect(shelfOf(mine({ reviewed: opinion("review-required") }))).toEqual(
        Option.some("waiting-for-review")
      )
    })
  })
})
