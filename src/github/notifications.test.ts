import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { courtOf, docketsOf, pressOf } from "../domain/notices"
import { noticesOnPage } from "./notifications"

/*
 * `/notifications` as GitHub served it on 2026-08-13, eleven rows over three of their
 * inboxes: the plain one, `reason:mention` and `is:repository-vulnerability-alert`. Three
 * inboxes because one page carried one shape of subject, and the six shapes an inbox really
 * holds are spread over three.
 *
 * Every element, class, attribute and form is theirs, unedited. What was changed is what
 * named a real account or a private repository: owners, repository names, logins, titles,
 * avatar paths, thread ids, signed analytics hmacs and authenticity tokens are all
 * substitutes of the same shape. The page furniture around the list — their header, their
 * filter pane's contents and their bulk toolbar — is stripped, because no parser reads it
 * and it was most of the 638KB.
 */
const real = await Bun.file("tests/fixtures/notifications.html").text()

const notices = noticesOnPage(real)

describe("reading their inbox", () => {
  test("finds every row on it", () => {
    expect(notices).toHaveLength(11)
  })

  test("reads the first row's facts as their page prints them", () => {
    const first = notices[0]

    expect(first?.repository).toBe("octo-org/octo-www")
    expect(first?.number).toBe("1955")
    expect(first?.title).toBe("fold span analysis into word analysis")
    expect(first?.reason).toBe("author")
    expect(first?.standing).toBe("open")
    expect(first?.unread).toBe(true)
    expect(first?.movedAt).toBe("2026-08-12T19:49:43Z")
    expect(first?.url).toContain("/octo-org/octo-www/pull/1955")
  })

  /*
   * Their thread id, which is the one field on the row that nothing else can be worked out
   * from: every write form addresses the row by it.
   */
  test("carries the thread id every press needs", () => {
    expect(notices.every((one) => one.id.startsWith("NT_"))).toBe(true)
    expect(new Set(notices.map((one) => one.id)).size).toBe(11)
  })

  /*
   * The reason off their analytics payload rather than off the visible label. Both are on the
   * row and the payload is the machine string: their label humanises it, so `assign` reads
   * "assigned", `comment` reads "commented" and `state_change` reads "state change".
   */
  test("reads the reason in GitHub's own spelling", () => {
    expect(new Set(notices.map((one) => one.reason))).toEqual(
      new Set(["author", "state_change", "assign", "mention", "security_alert"])
    )
  })

  test("reads read and unread as their row marks it", () => {
    expect(notices.filter((one) => one.unread)).toHaveLength(3)
  })

  /*
   * The whole point of the screen. GitHub draws the subject's state as the Octicon at the
   * head of every row, so open, merged and closed are on the page and need no second fetch —
   * which is the fact discussions #15591 and #55098 both assume is missing.
   */
  test("reads the subject's state off the icon on the row", () => {
    const standings = notices.map((one) => one.standing)

    expect(standings.filter((one) => one === "open")).toHaveLength(5)
    expect(standings.filter((one) => one === "merged")).toHaveLength(2)
    expect(standings.filter((one) => one === "closed")).toHaveLength(3)
    expect(standings.filter((one) => one === "unknown")).toHaveLength(1)
  })

  /*
   * Their own class on the row, and the only marker on it that says so. The security
   * advisory is the one row here the reader had already unsubscribed from.
   */
  test("reads whether GitHub is still telling the reader about the thread", () => {
    expect(notices.filter((one) => !one.subscribed)).toHaveLength(1)
    expect(notices.find((one) => !one.subscribed)?.reason).toBe("security_alert")
  })

  test("reads an issue's state as well as a pull request's", () => {
    const issue = notices.find((one) => one.url.includes("/issues/207"))

    expect(issue?.standing).toBe("closed")
    expect(issue?.number).toBe("207")
  })

  /*
   * Their security advisories are on this list too, and they are the row that breaks every
   * assumption: no repository of the reader's, no number, and an icon with no state colour.
   */
  test("keeps a security advisory rather than dropping it", () => {
    const alert = notices.find((one) => one.reason === "security_alert")

    expect(alert?.url).toContain("/advisories/GHSA-")
    expect(alert?.standing).toBe("unknown")
    expect(alert?.number).toBeNull()
  })

  /*
   * A row whose link is to a range of commits inside a pull request rather than to the pull
   * request itself. GitHub writes one whenever the notification is a push, and reading the
   * number off the end of the path would give a commit sha.
   */
  test("reads the number off a link that points inside the pull request", () => {
    const pushed = notices.find((one) => one.url.includes("/changes/"))

    expect(pushed?.number).toBe("1948")
    expect(pushed?.repository).toBe("octo-org/octo-www")
  })
})

describe("who has been in the thread", () => {
  test("names them and marks the machines", () => {
    const first = notices[0]

    expect(first?.participants.map((one) => one.login)).toEqual(["octocat", "devin-ai-integration"])
    expect(first?.participants.map((one) => one.isAutomated)).toEqual([false, true])
    expect(Option.isSome(first?.participants[0]?.faceUrl ?? Option.none())).toBe(true)
  })

  /*
   * The measured limit on discussion #4520. Every row on the inbox of 2026-08-13 carried a
   * machine, and none carried only machines, because a person had been in every thread. A
   * rule that called a thread a machine's when every participant is an App would have
   * matched nothing here and one of the seven real Dependabot rows beside it.
   */
  test("finds a machine in almost every thread and a thread of machines alone in none", () => {
    const machined = notices.filter((one) => one.participants.some((two) => two.isAutomated))
    const onlyMachines = notices.filter(
      (one) => one.participants.length > 0 && one.participants.every((two) => two.isAutomated)
    )

    expect(machined.length).toBeGreaterThan(6)
    expect(onlyMachines).toHaveLength(0)
  })
})

describe("what the reader can press", () => {
  test("takes each press off the form GitHub put in the row", () => {
    const first = notices[0]

    expect(first?.presses.map((one) => one.kind).toSorted()).toEqual([
      "archive",
      "mark",
      "star",
      "subscribe",
      "unarchive",
      "unmark",
      "unstar",
      "unsubscribe"
    ])
    expect(first?.presses.every((one) => one.route.startsWith("/notifications/beta/"))).toBe(true)
  })

  /*
   * The one asymmetry in their markup. Archiving, subscribing and saving are forms inside the
   * row; marking read is a form at the top of the page which takes its ids from the checkbox
   * beside each row. So the two arrive with the page's token and this row's id put on them.
   */
  test("addresses the page's own mark form with the row's id", () => {
    const first = notices[0]
    const mark = first?.presses.find((one) => one.kind === "mark")

    expect(mark?.route).toBe("/notifications/beta/mark")
    expect(mark?.ids).toEqual([first?.id ?? ""])
    expect(mark?.token).not.toBe(first?.presses.find((one) => one.kind === "archive")?.token)
  })

  /*
   * All six on every row, which is the thing that had to be measured rather than assumed. A
   * run page carries a cancel form or a re-run form and never both, so there the form's
   * presence is the answer; here it is not, and the row's own classes are what decide.
   */
  test("finds both halves of every pair on every row", () => {
    for (const one of notices) {
      const kinds = new Set(one.presses.map((two) => two.kind))

      expect(kinds.has("subscribe") && kinds.has("unsubscribe")).toBe(true)
      expect(kinds.has("star") && kinds.has("unstar")).toBe(true)
      expect(kinds.has("archive") && kinds.has("unarchive")).toBe(true)
    }
  })

  /*
   * Every token on the page was a different string, so a press carries the one off its own
   * form. Reusing another form's would be relying on GitHub not to check.
   */
  test("keeps each form's own token", () => {
    const first = notices[0]

    expect(first?.presses.every((one) => one.token !== "")).toBe(true)
    expect(first?.presses.every((one) => one.ids.includes(first.id))).toBe(true)
  })

  test("offers the half of each pair the row's own state calls for", () => {
    const unread = notices.find((one) => one.unread && one.subscribed)

    expect(Option.isSome(pressOf(unread!, "mark"))).toBe(true)
    expect(Option.isSome(pressOf(unread!, "unmark"))).toBe(false)
    expect(Option.isSome(pressOf(unread!, "unsubscribe"))).toBe(true)
    expect(Option.isSome(pressOf(unread!, "archive"))).toBe(true)
  })
})

describe("what the three Courts do to a real inbox", () => {
  /*
   * Five of the eleven rows concern work that is already over, and every one of them is
   * settled by the icon on its own row rather than by anything fetched. On the whole inbox
   * measured the same day the proportion was 41 rows of 51.
   */
  test("settles everything already merged or closed", () => {
    const settled = docketsOf(notices).find((one) => one.court === "settled")

    expect(settled?.count).toBe(5)
    expect(settled?.notices.every((one) => one.standing !== "open")).toBe(true)
    expect(settled?.notices.every((one) => courtOf(one) === "settled")).toBe(true)
  })

  /*
   * Three piles for a real page, and no Running among them: every row of this inbox arrived
   * because something had already happened, which is what a notification is. The one before this
   * asserted the Court was drawn and empty, which is the claim the reader objected to.
   */
  test("files a real page into three piles, with no Running to draw", () => {
    expect(docketsOf(notices).map((one) => one.court)).toEqual([
      "your-move",
      "waiting",
      "settled"
    ])
  })

  test("loses nothing between the page and the piles", () => {
    const filed = docketsOf(notices).reduce((count, one) => count + one.count, 0)

    expect(filed).toBe(notices.length)
  })
})

describe("a page that has stopped looking like this", () => {
  test("comes back empty rather than wrong", () => {
    expect(noticesOnPage("<html><body><main></main></body></html>")).toEqual([])
    expect(noticesOnPage("")).toEqual([])
  })

  test("skips a row whose link cannot be read rather than guessing at it", () => {
    const broken = `<ul><li class="notifications-list-item" data-notification-id="NT_x"></li></ul>`

    expect(noticesOnPage(broken)).toEqual([])
  })
})
