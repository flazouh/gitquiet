import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Notice, Press, PressKind } from "../domain/notices"
import { NoticesScreen } from "./NoticesScreen"
import { Toasts } from "./Toasts"

afterEach(cleanup)

/** Every press GitHub puts on a row, which is all six of them on all of them. */
const KINDS: ReadonlyArray<PressKind> = [
  "mark",
  "unmark",
  "archive",
  "unarchive",
  "subscribe",
  "unsubscribe",
  "star",
  "unstar"
]

const pressesFor = (id: string): ReadonlyArray<Press> =>
  KINDS.map((kind) => ({ kind, route: `/notifications/beta/${kind}`, token: `${kind}-${id}`, ids: [id] }))

const notice = (what: Partial<Notice> & Pick<Notice, "id">): Notice => ({
  url: `/fluentai-pro/fluentai/pull/2169`,
  repository: "fluentai-pro/fluentai",
  number: "2169",
  title: "fix(worker): bound live tail memory and keep it observable",
  reason: "subscribed",
  standing: "open",
  unread: true,
  subscribed: true,
  movedAt: "2026-08-13T09:00:00Z",
  participants: [{ login: "flazouh", isAutomated: false, faceUrl: Option.none() }],
  presses: pressesFor(what.id),
  ...what
})

const show = (
  notices: ReadonlyArray<Notice>,
  onPress: (press: Press) => Effect.Effect<void, unknown> = () => Effect.void
) =>
  render(
    <Toasts>
      <NoticesScreen
        load={() => Effect.succeed(notices)}
        onPress={onPress}
        onStepAside={() => {}}
      />
    </Toasts>
  )

describe("the reader's inbox, grouped by who acts next", () => {
  /*
   * Three, and the same three whether the inbox is quiet or busy: a reader finds Settled by
   * where it is rather than by reading, and a Court that came and went with the day's rows
   * would take that away.
   */
  test("draws its three Courts, so a quiet inbox reads the same as a busy one", async () => {
    show([notice({ id: "one" })])

    for (const court of ["Needs You", "Waiting", "Settled"]) {
      expect(await screen.findByRole("region", { name: court })).toBeTruthy()
    }
  })

  /*
   * And not the fourth. Running means a machine owes the next step, and a Notice is sent
   * because a machine has finished, so nothing on any inbox can ever be filed there. Every
   * other screen keeps an empty Court because this afternoon it will have rows in it; what a
   * heading nothing can reach teaches the reader is that a heading may mean nothing.
   */
  test("draws no Running, which nothing on any inbox can reach", async () => {
    show([notice({ id: "one" })])

    await screen.findByRole("region", { name: "Needs You" })
    expect(screen.queryByRole("region", { name: "Running" })).toBeNull()
  })

  /*
   * The fact the whole screen turns on. Eleven of the fifteen review requests measured on
   * 2026-08-13 were for pull requests merged without the reader, and their own page draws
   * every one of them like work.
   */
  test("files a merged pull request under Settled, whoever was asked to review it", async () => {
    show([
      notice({ id: "merged", reason: "review_requested", standing: "merged", title: "already landed" })
    ])

    const settled = await screen.findByRole("region", { name: "Settled" })
    expect(within(settled).getByRole("link", { name: "already landed" })).toBeTruthy()

    const yours = await screen.findByRole("region", { name: "Needs You" })
    expect(within(yours).queryByRole("link", { name: "already landed" })).toBeNull()
  })

  test("files a review request on an open pull request under Needs You", async () => {
    show([notice({ id: "asked", reason: "review_requested", title: "still open" })])

    const yours = await screen.findByRole("region", { name: "Needs You" })
    expect(within(yours).getByRole("link", { name: "still open" })).toBeTruthy()
  })

  /*
   * A team was named and not a person. Calling this the reader's move is what makes a busy
   * team's inbox indistinguishable from a personal one.
   */
  test("keeps a team mention in Waiting", async () => {
    show([notice({ id: "team", reason: "team_mention", title: "the team was named" })])

    const waiting = await screen.findByRole("region", { name: "Waiting" })
    expect(within(waiting).getByRole("link", { name: "the team was named" })).toBeTruthy()
  })

  test("says how many are in each Court", async () => {
    show([
      notice({ id: "a", reason: "mention" }),
      notice({ id: "b", reason: "mention" }),
      notice({ id: "c", reason: "subscribed" })
    ])

    const yours = await screen.findByRole("region", { name: "Needs You" })
    expect(within(yours).getByText("2")).toBeTruthy()
  })

  test("names the repository and the number the Notice is about", async () => {
    show([notice({ id: "one" })])

    expect(await screen.findByText("fluentai-pro/fluentai")).toBeTruthy()
    expect(await screen.findByText("#2169")).toBeTruthy()
  })

  test("opens the thread where GitHub's own row opens it", async () => {
    show([notice({ id: "one" })])

    const link = await screen.findByRole("link", { name: /^fix\(worker\)/ })
    expect(link.getAttribute("href")).toBe("/fluentai-pro/fluentai/pull/2169")
  })

  test("says why the reader was told, in this product's words rather than GitHub's", async () => {
    show([notice({ id: "one", reason: "review_requested" })])

    // Their own markup says `review_requested` and their visible label says "review requested".
    expect(await screen.findByText("Review asked of you")).toBeTruthy()
  })

  test("marks a machine in the thread, which is as far as the row goes", async () => {
    show([
      notice({
        id: "bot",
        participants: [
          { login: "dependabot", isAutomated: true, faceUrl: Option.none() },
          { login: "flazouh", isAutomated: false, faceUrl: Option.none() }
        ]
      })
    ])

    expect(await screen.findByTitle("dependabot, a machine")).toBeTruthy()
    expect(await screen.findByTitle("flazouh")).toBeTruthy()
  })

  describe("what the reader can do without leaving", () => {
    test("offers marking an unread Notice read, and not the other way round", async () => {
      show([notice({ id: "one", unread: true })])

      const row = await screen.findByRole("listitem")
      expect(within(row).getByRole("button", { name: "Mark read" })).toBeTruthy()
      expect(within(row).queryByRole("button", { name: "Mark unread" })).toBeNull()
    })

    test("and marking a read one unread", async () => {
      show([notice({ id: "one", unread: false })])

      const row = await screen.findByRole("listitem")
      expect(within(row).getByRole("button", { name: "Mark unread" })).toBeTruthy()
      expect(within(row).queryByRole("button", { name: "Mark read" })).toBeNull()
    })

    test("offers stopping a thread the reader is still told about", async () => {
      show([notice({ id: "one", subscribed: true })])

      const row = await screen.findByRole("listitem")
      expect(within(row).getByRole("button", { name: "Unsubscribe" })).toBeTruthy()
      expect(within(row).queryByRole("button", { name: "Subscribe" })).toBeNull()
    })

    test("and starting one they stopped", async () => {
      show([notice({ id: "one", subscribed: false })])

      const row = await screen.findByRole("listitem")
      expect(within(row).getByRole("button", { name: "Subscribe" })).toBeTruthy()
    })

    /*
     * Their bookmark span is on every row and hidden by a rule, and no row class says whether
     * a Notice is saved. A button that might do the opposite of what it says is worse than no
     * button, so the pair is parsed and never drawn.
     */
    test("never offers Save, because the row does not say whether it is already saved", async () => {
      show([notice({ id: "one" })])

      const row = await screen.findByRole("listitem")
      expect(within(row).queryByRole("button", { name: /Save/ })).toBeNull()
    })

    test("puts the row back when GitHub refuses the press", async () => {
      /*
       * An archive their server refused used to take the Notice off the screen
       * anyway, and leave it off until the inbox was opened again. The row is
       * drawn the way the reader asked for, and GitHub's no is what puts it back.
       */
      show([notice({ id: "NT_one" })], () => Effect.fail(new Error("nope")))

      const rows = await screen.findAllByRole("listitem")
      const first = rows[0]
      if (first === undefined) throw new Error("no rows")

      await userEvent.click(within(first).getByRole("button", { name: /Done/ }))

      await waitFor(async () =>
        expect(await screen.findAllByRole("listitem")).toHaveLength(1)
      )
    })

    test("sends GitHub's own form for the row that was pressed", async () => {
      const sent: Array<Press> = []
      show([notice({ id: "NT_one" }), notice({ id: "NT_two" })], (press) =>
        Effect.sync(() => void sent.push(press))
      )

      const rows = await screen.findAllByRole("listitem")
      const first = rows[0]
      if (first === undefined) throw new Error("no rows")

      await userEvent.click(within(first).getByRole("button", { name: "Mark read" }))

      expect(sent).toHaveLength(1)
      expect(sent[0]?.route).toBe("/notifications/beta/mark")
      expect(sent[0]?.ids).toEqual(["NT_one"])
    })

    test("takes the Notice off the screen once it is archived", async () => {
      show([notice({ id: "gone", title: "done with this" })])

      const row = await screen.findByRole("listitem")
      await userEvent.click(within(row).getByRole("button", { name: "Done" }))

      expect(screen.queryByRole("link", { name: "done with this" })).toBeNull()
    })

    /*
     * Read state orders rows and never moves one between Courts, so a row marked read stays
     * where the reader can see what they just did.
     */
    test("keeps a Notice on the screen once it is marked read", async () => {
      show([notice({ id: "read", title: "still here" })])

      const row = await screen.findByRole("listitem")
      await userEvent.click(within(row).getByRole("button", { name: "Mark read" }))

      expect(await screen.findByRole("link", { name: "still here" })).toBeTruthy()
      const same = await screen.findByRole("listitem")
      expect(within(same).getByRole("button", { name: "Mark unread" })).toBeTruthy()
    })
  })

  describe("a press that GitHub has since caught up with", () => {
    /*
     * A correction is worn over the read until the read says the same thing, and
     * then it has to come off. It never did: nothing compared the press against
     * the inbox behind it, so a Notice marked read a minute ago went on being
     * drawn read however many times the inbox arrived saying otherwise — which
     * makes an inbox that cannot be corrected by its own read, the one outcome
     * this screen must not have.
     *
     * Coming back to the tab is what asks again, which is how these drive a
     * second read without reaching for anything the screen does not offer.
     */
    const looking = () => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true
      })
    }

    const askAgain = () => {
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))
    }

    test("lets a later read say a Notice is unread again", async () => {
      looking()
      let saying: ReadonlyArray<Notice> = [notice({ id: "one", unread: true })]

      render(
        <Toasts>
          <NoticesScreen
            load={() => Effect.succeed(saying)}
            onPress={() => Effect.void}
            onStepAside={() => {}}
          />
        </Toasts>
      )

      const row = await screen.findByRole("listitem")
      await userEvent.click(within(row).getByRole("button", { name: "Mark read" }))

      // Worn: the inbox still says unread and the press is what is on the screen.
      expect(
        within(await screen.findByRole("listitem")).getByRole("button", { name: "Mark unread" })
      ).toBeTruthy()

      // GitHub agrees, so the press has nothing left to say and comes off.
      saying = [notice({ id: "one", unread: false })]
      askAgain()
      await waitFor(async () =>
        expect(
          within(await screen.findByRole("listitem")).getByRole("button", { name: "Mark unread" })
        ).toBeTruthy()
      )

      // And now somebody comments. That is the inbox's to report, and it used to
      // be a fact this screen sat on for the life of the document.
      saying = [notice({ id: "one", unread: true })]
      askAgain()
      await waitFor(async () =>
        expect(
          within(await screen.findByRole("listitem")).getByRole("button", { name: "Mark read" })
        ).toBeTruthy()
      )
    })

    test("puts an archived Notice back once the inbox has it again", async () => {
      looking()
      let saying: ReadonlyArray<Notice> = [notice({ id: "one", title: "done with this" })]

      render(
        <Toasts>
          <NoticesScreen
            load={() => Effect.succeed(saying)}
            onPress={() => Effect.void}
            onStepAside={() => {}}
          />
        </Toasts>
      )

      const row = await screen.findByRole("listitem")
      await userEvent.click(within(row).getByRole("button", { name: "Done" }))
      expect(screen.queryByRole("link", { name: "done with this" })).toBeNull()

      // GitHub agrees: it has left the inbox, so the press is spent.
      saying = []
      askAgain()
      await waitFor(() => expect(screen.queryByRole("listitem")).toBeNull())

      // Un-archived from somewhere else. The inbox is the answer.
      saying = [notice({ id: "one", title: "done with this" })]
      askAgain()
      await waitFor(() =>
        expect(screen.getByRole("link", { name: "done with this" })).toBeTruthy()
      )
    })
  })

  /*
   * The decision `DASHBOARD` and `ACTIONS` both record, made once more: their filter pane goes
   * with their list, and this screen offers no box of its own in its place.
   */
  test("offers no filter box, because it groups instead of filtering", async () => {
    show([notice({ id: "one" })])

    await screen.findByRole("region", { name: "Needs You" })
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  test("says so plainly where there is nothing in the inbox", async () => {
    show([])

    expect(await screen.findByText("Nothing is in your inbox.")).toBeTruthy()
  })

  test("draws the known inbox at once, rather than waiting for GitHub to agree", async () => {
    const kept = [notice({ id: "one" })]

    // A read that never lands, so anything on the screen came out of the store.
    render(
      <NoticesScreen
        load={() => Effect.never}
        preload={() => Effect.succeed(Option.some(kept))}
        onPress={() => Effect.void}
        onStepAside={() => {}}
      />
    )

    expect(await screen.findByRole("region", { name: "Needs You" })).toBeTruthy()
  })
})
