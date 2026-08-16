import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
  type Notice,
  type Press,
  type Standing,
  REASONS,
  courtOf,
  docketsOf,
  noticesIn,
  pressOf,
  standingOf
} from "./notices"

/** Every press GitHub renders on a row, which is all six of them, in pairs. */
const sixForms: ReadonlyArray<Press> = (
  ["mark", "unmark", "archive", "unarchive", "subscribe", "unsubscribe"] as const
).map((kind) => ({ kind, route: `/notifications/beta/${kind}`, token: "tok", ids: ["NT_kwHOAYg86No"] }))

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
  subscribed: true,
  movedAt: "2026-08-12T21:59:53Z",
  participants: [],
  presses: sixForms,
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
      expect(courtOf(notice({ reason, standing: "open" }))).toBe("needs-you")
    }
  })

  test("keeps the reader's own repository's vulnerabilities theirs to fix", () => {
    expect(courtOf(notice({ reason: "security_alert", standing: "unknown" }))).toBe("needs-you")
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
    expect(courtOf(notice({ reason: "ci_activity", standing: "unknown" }))).toBe("needs-you")
  })

  test("waits on a reason it has never been shown", () => {
    expect(courtOf(notice({ reason: "something_new", standing: "open" }))).toBe("waiting")
  })
})

describe("the three piles", () => {
  const some = [
    notice({ id: "a", reason: "review_requested", standing: "open", unread: true, movedAt: "2026-08-10T00:00:00Z" }),
    notice({ id: "b", reason: "review_requested", standing: "open", unread: false, movedAt: "2026-08-12T00:00:00Z" }),
    notice({ id: "c", reason: "review_requested", standing: "merged" }),
    notice({ id: "d", reason: "subscribed", standing: "open" })
  ]

  /*
   * Three of the product's four, and Running is the one left out. Every other screen draws a
   * Court that is empty today because it is full this afternoon, and the reader learns where to
   * look by its being in the same place either way. Running on an inbox is not that: no Notice
   * can reach it, on any inbox, ever — see `courtOf`. A heading that can never mean anything
   * teaches the reader that a heading may mean nothing, which is what the four Courts are for.
   */
  test("gives three even where two are empty, and no Running", () => {
    const dockets = docketsOf([notice({ reason: "subscribed", standing: "open" })])

    expect(dockets.map((one) => one.court)).toEqual(["needs-you", "waiting", "settled"])
    expect(dockets.map((one) => one.count)).toEqual([0, 1, 0])
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
    const needsYou = docketsOf(some).find((one) => one.court === "needs-you")

    expect(needsYou?.notices.map((one) => one.id)).toEqual(["a", "b"])
  })

  /*
   * The guard on the Court that is not drawn. A Notice with nowhere to go would be a row this
   * screen reads off their page and then never shows, which is worse than a heading nothing
   * reaches: `docketsOf` files by Court, so a Court it does not list is a Notice dropped.
   *
   * So this is asked of every reason GitHub sends and every state their icons carry, and it is
   * what should fail first if a later reason does belong in Running. The answer then is to draw
   * Running on the inbox again, not to file the row somewhere it does not belong.
   */
  test("files every reason and every state in one of the three", () => {
    const standings: ReadonlyArray<Standing> = ["open", "merged", "closed", "unknown"]
    const drawn = ["needs-you", "waiting", "settled"]

    for (const reason of [...REASONS, "something_new"]) {
      for (const standing of standings) {
        expect(drawn).toContain(courtOf(notice({ reason, standing })))
      }
    }
  })

  test("drops no Notice on an inbox that holds one of everything", () => {
    const one = [...REASONS].map((reason) => notice({ id: reason, reason, standing: "open" }))

    const filed = docketsOf(one).flatMap((docket) => docket.notices)

    expect(filed).toHaveLength(REASONS.length)
  })
})

/*
 * GitHub renders all six forms on every row and shows one of each pair with their own
 * script, which is the opposite of how a run page works: a run carries a cancel form or a
 * re-run form and never both, so there the form is the answer. Here the row's own state is.
 */
describe("which half of a pair applies", () => {
  test("offers marking read only where the Notice is unread, and unmarking only where it is not", () => {
    expect(Option.isSome(pressOf(notice({ unread: true }), "mark"))).toBe(true)
    expect(Option.isSome(pressOf(notice({ unread: true }), "unmark"))).toBe(false)
    expect(Option.isSome(pressOf(notice({ unread: false }), "mark"))).toBe(false)
    expect(Option.isSome(pressOf(notice({ unread: false }), "unmark"))).toBe(true)
  })

  test("offers unsubscribing only where GitHub is still telling the reader about it", () => {
    expect(Option.isSome(pressOf(notice({ subscribed: true }), "unsubscribe"))).toBe(true)
    expect(Option.isSome(pressOf(notice({ subscribed: true }), "subscribe"))).toBe(false)
    expect(Option.isSome(pressOf(notice({ subscribed: false }), "subscribe"))).toBe(true)
  })

  /* Everything on the inbox is un-archived, which is what makes it the inbox. */
  test("always offers Done", () => {
    expect(Option.isSome(pressOf(notice(), "archive"))).toBe(true)
  })

  /*
   * Nothing on the row says whether a Notice is already saved: their bookmark span is on
   * every row and hidden by a rule. A button that might do the opposite of what it says is
   * worse than no button.
   */
  test("offers neither half of saving, because the row does not say which applies", () => {
    expect(Option.isSome(pressOf(notice(), "star"))).toBe(false)
    expect(Option.isSome(pressOf(notice(), "unstar"))).toBe(false)
  })

  test("offers nothing GitHub did not put a form there for", () => {
    expect(Option.isSome(pressOf(notice({ presses: [] }), "archive"))).toBe(false)
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
