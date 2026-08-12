import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
  type Notice,
  type Standing,
  REASONS,
  courtOf,
  docketsOf,
  noticesIn,
  standingOf
} from "./notices"

/**
 * A Notice in the shape their row gives one.
 *
 * The defaults are the commonest row on the measured inbox of 2026-08-13: an open pull
 * request the reader authored, read, with a machine and the reader in it.
 */
const notice = (what: Partial<Notice> = {}): Notice => ({
  id: "NT_kwHOAYg86No",
  url: "https://github.com/octo-org/octo-repo/pull/2169",
  repository: "octo-org/octo-repo",
  number: "2169",
  title: "fold span analysis into word analysis",
  reason: "author",
  standing: "open",
  unread: false,
  saved: false,
  movedAt: "2026-08-12T21:59:53Z",
  participants: [],
  presses: [],
  ...what
})

describe("the address of the notifications page", () => {
  test("owns their inbox, with and without their own query on it", () => {
    expect(noticesIn("https://github.com/notifications")).toBe(true)
    expect(noticesIn("https://github.com/notifications/")).toBe(true)
    expect(noticesIn("https://github.com/notifications?query=is%3Aunread")).toBe(true)
  })

  /*
   * Their subscriptions page and their watching page live under the same word and are not
   * this screen: neither lists a Notice, and taking them would replace a page this interface
   * has nothing to say about.
   */
  test("leaves the pages beside it to GitHub", () => {
    expect(noticesIn("https://github.com/notifications/subscriptions")).toBe(false)
    expect(noticesIn("https://github.com/watching")).toBe(false)
    expect(noticesIn("https://github.com/octo-org/octo-repo/pulls")).toBe(false)
    expect(noticesIn("https://example.com/notifications")).toBe(false)
    expect(noticesIn("not an address")).toBe(false)
  })
})

/*
 * Six shapes, each read off a real row on 2026-08-13. The colour is carried with the icon
 * because their own markup carries both, and reading the icon alone would call a closed
 * pull request open on the strength of the word in its name.
 */
describe("the subject's state, off their icon", () => {
  const shapes: ReadonlyArray<readonly [string, Standing]> = [
    ["octicon octicon-git-pull-request  color-fg-open", "open"],
    ["octicon octicon-git-merge  color-fg-done", "merged"],
    ["octicon octicon-git-pull-request-closed  color-fg-closed", "closed"],
    ["octicon octicon-issue-opened  color-fg-open", "open"],
    ["octicon octicon-issue-closed  color-fg-done", "closed"],
    ["octicon octicon-alert", "unknown"]
  ]

  for (const [icon, standing] of shapes) {
    test(`reads ${icon.replace(/\s+/g, " ")} as ${standing}`, () => {
      expect(standingOf(icon)).toBe(standing)
    })
  }

  /*
   * A draft pull request, a discussion, a release and a completed run all reach this inbox
   * and none of them appeared in the measured one, so their spelling is unread. Unknown is
   * the honest answer and it keeps the row on the screen, filed by its reason alone.
   */
  test("says unknown for a shape it has not been shown", () => {
    expect(standingOf("octicon octicon-comment-discussion")).toBe("unknown")
    expect(standingOf("")).toBe("unknown")
  })
})

describe("which Court a Notice sits in", () => {
  /*
   * The state outranks the reason, which is the rule `courtOf` in `workingSet.ts` and
   * `attentionIn` both open with. On the measured inbox it moves 41 rows of 51.
   */
  test("settles anything whose subject is over, whatever the reason", () => {
    for (const reason of REASONS) {
      expect(courtOf(notice({ reason, standing: "merged" }))).toBe("settled")
      expect(courtOf(notice({ reason, standing: "closed" }))).toBe("settled")
    }
  })

  test("asks the reader to move where somebody asked them for something", () => {
    for (const reason of ["review_requested", "approval_requested", "assign", "mention"]) {
      expect(courtOf(notice({ reason, standing: "open" }))).toBe("your-move")
    }
  })

  test("keeps the reader's own repository's vulnerabilities theirs to fix", () => {
    expect(courtOf(notice({ reason: "security_alert", standing: "unknown" }))).toBe("your-move")
  })

  /*
   * The reader spoke, or is watching, or opened it. Somebody else owes the next step, and
   * `courtOfThread` files the reader's own last word the same way.
   */
  test("waits where somebody else owes the next step", () => {
    for (const reason of ["author", "comment", "manual", "subscribed", "team_mention"]) {
      expect(courtOf(notice({ reason, standing: "open" }))).toBe("waiting")
    }
  })

  test("settles what is already finished by its reason alone", () => {
    for (const reason of ["invitation", "security_advisory_credit", "state_change"]) {
      expect(courtOf(notice({ reason, standing: "open" }))).toBe("settled")
    }
  })

  /*
   * A notification is sent when the run has finished, so the machine is not still working
   * and the outcome is what is left to read. No such row appeared on the measured inbox,
   * which is why an unknown shape falls to the reader rather than being called settled.
   */
  test("reads a finished run by its outcome", () => {
    expect(courtOf(notice({ reason: "ci_activity", standing: "closed" }))).toBe("settled")
    expect(courtOf(notice({ reason: "ci_activity", standing: "unknown" }))).toBe("your-move")
  })

  test("waits on a reason it has never been shown", () => {
    expect(courtOf(notice({ reason: "something_new", standing: "open" }))).toBe("waiting")
  })
})

describe("the four piles", () => {
  const some = [
    notice({ id: "a", reason: "review_requested", standing: "open", unread: true, movedAt: "2026-08-10T00:00:00Z" }),
    notice({ id: "b", reason: "review_requested", standing: "open", unread: false, movedAt: "2026-08-12T00:00:00Z" }),
    notice({ id: "c", reason: "review_requested", standing: "merged" }),
    notice({ id: "d", reason: "subscribed", standing: "open" })
  ]

  test("gives all four even where three are empty", () => {
    const dockets = docketsOf([notice({ reason: "subscribed", standing: "open" })])

    expect(dockets.map((one) => one.court)).toEqual(["your-move", "waiting", "running", "settled"])
    expect(dockets.map((one) => one.count)).toEqual([0, 1, 0, 0])
  })

  test("files each Notice in exactly one", () => {
    const dockets = docketsOf(some)
    const held = dockets.flatMap((one) => one.notices.map((two) => two.id))

    expect(held.toSorted()).toEqual(["a", "b", "c", "d"])
  })

  /*
   * Unread first, because read state is the reader's own bookmark and says nothing about
   * who owes the next move. It orders within a Court and never moves a Notice between two.
   */
  test("puts the unread above the read, then the newest first", () => {
    const yourMove = docketsOf(some).find((one) => one.court === "your-move")

    expect(yourMove?.notices.map((one) => one.id)).toEqual(["a", "b"])
  })

  test("leaves Running empty, because a Notice arrives after the machine has stopped", () => {
    const running = docketsOf(some).find((one) => one.court === "running")

    expect(running?.count).toBe(0)
  })
})

describe("what the row says about machines", () => {
  /*
   * The stack is recent participants and not authorship, which is why this says how many
   * machines have been in the thread and never claims a machine opened it. Measured: six of
   * the seven Dependabot rows on the inbox of 2026-08-13 carry a person as well.
   */
  test("counts the machines in the thread without calling the thread a machine's", () => {
    const machined = notice({
      participants: [
        { login: "dependabot", isAutomated: true, faceUrl: Option.none() },
        { login: "octocat", isAutomated: false, faceUrl: Option.none() }
      ]
    })

    expect(machined.participants.filter((one) => one.isAutomated)).toHaveLength(1)
    expect(machined.participants.some((one) => !one.isAutomated)).toBe(true)
  })
})
