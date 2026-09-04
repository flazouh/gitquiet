import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Closing, IssueSnapshot } from "../domain/Issue"
import type { ListedIssue } from "../domain/issues"
import { IssueScreen } from "./IssueScreen"
import { Toasts } from "./Toasts"

afterEach(cleanup)

const reference = { owner: "flazouh", repo: "githubpro", number: 146 }

const person = (login: string) => ({
  login,
  isAutomated: false,
  faceUrl: Option.none<string>()
})

const issue: IssueSnapshot = {
  reference,
  id: "I_kwDOAJy2Ks7UQx_c",
  title: "The Courts hold only half of what is owed",
  description: {
    markdown: "Issues are missing from the dashboard.",
    html: "<p>Issues are missing from the dashboard.</p>"
  },
  state: "open",
  closing: Option.none(),
  openedAt: "2026-07-28T20:07:00Z",
  author: person("flazouh"),
  labels: [
    { name: "bug", colour: "d73a4a", description: Option.some("Something is broken") },
    { name: "help wanted", colour: "008672", description: Option.none() }
  ],
  assignees: [person("octocat")],
  remarks: [
    {
      id: "IC_1",
      author: person("octocat"),
      body: "Agreed, this is the whole complaint.",
      html: "<p>Agreed, this is the whole complaint.</p>",
      createdAt: "2026-07-29T09:00:00Z"
    }
  ],
  reactions: [{ kind: "THUMBS_UP", count: 3, viewerReacted: false }],
  allowed: { comment: true, close: true, reopen: false, label: true, assign: true },
  viewer: Option.some(person("flazouh"))
}

const screenOf = (props: Partial<React.ComponentProps<typeof IssueScreen>> = {}) => (
  <IssueScreen
    reference={reference}
    load={() => Effect.succeed({ snapshot: issue })}
    onStepAside={() => {}}
    {...props}
  />
)

describe("one issue, on the page GitHub keeps for it", () => {
  test("reports when a detached issue is ready for navigation", async () => {
    let prepared = 0
    render(
      screenOf({
        preparing: true,
        onPrepared: () => {
          prepared += 1
        }
      })
    )

    await waitFor(() => expect(prepared).toBe(1))
  })

  test("says which issue this is and what was written", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(issue.title)).toBeDefined())
    expect(screen.getByText("#146")).toBeDefined()
    expect(screen.getByText("Issues are missing from the dashboard.")).toBeDefined()
  })

  test("keeps the main post open, however long it is", async () => {
    render(screenOf())

    const post = await screen.findByRole("region", { name: "Description" })

    expect(within(post).queryByRole("button", { name: "Show all of it" })).toBeNull()
    expect(post.querySelector("[style*='max-height']")).toBeNull()
  })

  test("says it is open, with the age beside the word", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByLabelText(/^Open /)).toBeDefined())
  })

  test("says why a closed one closed rather than only that it is closed", async () => {
    // The distinction the Courts drop on purpose. Somebody reading this came to
    // find out whether the thing they reported is ever going to be done.
    const discarded: IssueSnapshot = {
      ...issue,
      state: "closed",
      closing: Option.some("discarded")
    }
    render(screenOf({ load: () => Effect.succeed({ snapshot: discarded }) }))

    await waitFor(() => expect(screen.getByText("Closed as not planned")).toBeDefined())
  })

  test("names the labels rather than counting them", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText("bug")).toBeDefined())
    expect(screen.getByText("help wanted")).toBeDefined()
  })

  test("draws what everyone said", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByLabelText("Conversation")).toBeDefined())
    // Twice: once as the folded line that summarises it, once as the comment
    // itself inside the fold.
    expect(screen.getAllByText(/Agreed, this is the whole complaint/).length).toBeGreaterThan(0)
  })

  test("puts what the reader just said on the page without reading the issue again", async () => {
    // An issue arrives in one request, so a comment posted a moment ago is on
    // the screen only because it was put there.
    let reads = 0
    render(
      screenOf({
        load: () =>
          Effect.sync(() => {
            reads += 1
            return { snapshot: issue }
          }),
        postRemark: (_id, body) =>
          Effect.succeed({
            id: "IC_2",
            author: person("flazouh"),
            body,
            html: `<p>${body}</p>`,
            createdAt: "2026-07-29T10:00:00Z"
          })
      })
    )

    await waitFor(() => expect(screen.getByLabelText("Conversation")).toBeDefined())
    const before = reads

    // Folded until pressed, which is what keeps a two-hundred pixel box off
    // every issue nobody adds a word to.
    await userEvent.click(
      screen.getByRole("button", { name: "Say something about this issue" })
    )
    await userEvent.type(screen.getByRole("textbox"), "Reading it now")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))

    await waitFor(() =>
      expect(screen.getAllByText(/Reading it now/).length).toBeGreaterThan(0)
    )
    expect(reads).toBe(before)
  })

  test("offers no box to write in where GitHub says the reader may not", async () => {
    // A locked issue and an archived repository both refuse, and a box that
    // throws when it is used is worse than no box.
    const locked: IssueSnapshot = { ...issue, allowed: { ...issue.allowed, comment: false } }
    render(
      screenOf({
        load: () => Effect.succeed({ snapshot: locked }),
        postRemark: (body) =>
          Effect.succeed({
            id: "IC_3",
            author: person("flazouh"),
            body,
            html: `<p>${body}</p>`,
            createdAt: "2026-07-29T10:00:00Z"
          })
      })
    )

    await waitFor(() => expect(screen.getByLabelText("Conversation")).toBeDefined())
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  test("hands the page back rather than showing half an issue when the read fails", async () => {
    let handedBack = false
    render(
      screenOf({
        load: () => Effect.fail(new Error("GitHub said no")),
        onStepAside: () => {
          handedBack = true
        },
        signedIn: () => true
      })
    )

    await waitFor(() => expect(screen.getByText("This issue could not be read")).toBeDefined())
    await userEvent.click(screen.getByRole("button", { name: "Show GitHub's issue" }))

    expect(handedBack).toBe(true)
  })

  test("blames the session rather than GitHub when nobody is signed in", async () => {
    // Every route answers as though the page does not exist to a signed-out
    // reader, which looks exactly like a payload that changed shape.
    render(
      screenOf({
        load: () => Effect.fail(new Error("404")),
        signedIn: () => false
      })
    )

    await waitFor(() => expect(screen.getByText("You are signed out of GitHub")).toBeDefined())
  })
})

/**
 * The header, drawn from the row the reader pressed rather than waited for.
 *
 * The first open of any given issue is the whole of the wait on this screen: one request
 * carries the issue and every remark on it, and until 14 August 2026 nothing at all was
 * drawn until all of it landed. The list that was on the screen a moment earlier already
 * had the header of it, so the header is drawn from that and the wait is left over the
 * parts a row never carried.
 */
describe("the header a list already had", () => {
  const row: ListedIssue = {
    reference,
    id: issue.id,
    title: issue.title,
    author: person("flazouh"),
    state: "open",
    comments: 1,
    labels: ["bug", "help wanted"],
    raisedAt: "2026-07-28T20:07:00Z"
  }

  test("says which issue this is before any read has answered", () => {
    render(screenOf({ row, load: () => Effect.never }))

    expect(screen.getByText(row.title)).toBeDefined()
    expect(screen.getByText("#146")).toBeDefined()
  })

  test("says the state, the age, who raised it and its labels", () => {
    render(screenOf({ row, load: () => Effect.never }))

    expect(screen.getByLabelText(/^Open /)).toBeDefined()
    expect(screen.getByText("flazouh")).toBeDefined()
    expect(screen.getByText("bug")).toBeDefined()
    expect(screen.getByText("help wanted")).toBeDefined()
  })

  test("claims no body and no conversation, having read neither", () => {
    render(screenOf({ row, load: () => Effect.never }))

    expect(screen.queryByRole("region", { name: "Description" })).toBeNull()
    expect(screen.queryByLabelText("Conversation")).toBeNull()
  })

  test("offers nothing to press on an issue GitHub has not answered for", () => {
    // What the reader may do to an issue is GitHub's answer and a row never asked for
    // it, so a Close button here would be a control that refuses when it is used.
    render(screenOf({ row, load: () => Effect.never, settle: () => Effect.void }))

    expect(screen.getByText(row.title)).toBeDefined()
    expect(screen.queryByRole("button", { name: "Close issue" })).toBeNull()
  })

  test("gives way to the issue GitHub sent, title and all", async () => {
    const renamed = { ...issue, title: "Renamed since the list was read" }
    render(screenOf({ row, load: () => Effect.succeed({ snapshot: renamed }) }))

    await waitFor(() => expect(screen.getByText(renamed.title)).toBeDefined())
    expect(screen.queryByText(row.title)).toBeNull()
    expect(screen.getByRole("region", { name: "Description" })).toBeDefined()
  })

  test("waits as it always did where no list drew a row for it", () => {
    render(screenOf({ load: () => Effect.never }))

    expect(screen.queryByText(issue.title)).toBeNull()
  })
})

/**
 * Closing an issue from our own page, which until now meant handing the page back to GitHub
 * to press their button.
 *
 * The page moves on the press and the request follows it, exactly as a star does: closing an
 * issue is a decision the reader has already made, and a header that waits for GitHub to
 * agree reads as one that did not hear. The interesting half is the other one — GitHub
 * refuses more often here than anywhere else in this extension, because a locked issue, an
 * archived repository and a lost session all answer the same way.
 */
describe("settling an issue from our own page", () => {
  const settled = { ...issue, state: "closed" as const, closing: Option.some<Closing>("completed") }

  const closable = (props: Partial<React.ComponentProps<typeof IssueScreen>> = {}) => (
    <Toasts>{screenOf(props)}</Toasts>
  )

  test("says it is closed before GitHub has answered", async () => {
    render(closable({ settle: () => Effect.never }))

    await userEvent.click(await screen.findByRole("button", { name: "Close issue" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /completed/ }))

    await waitFor(() => expect(screen.getByLabelText(/^Closed /)).toBeDefined())
  })

  test("says which of the two closes it was, the word Closed hiding exactly that", async () => {
    render(closable({ settle: () => Effect.never }))

    await userEvent.click(await screen.findByRole("button", { name: "Close issue" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /not planned/ }))

    await waitFor(() => expect(screen.getByLabelText(/^Closed as not planned/)).toBeDefined())
  })

  test("puts it back and says why, where GitHub refuses", async () => {
    render(
      closable({
        settle: () => Effect.fail({ reason: "rejected", detail: "Issue is locked." })
      })
    )

    await userEvent.click(await screen.findByRole("button", { name: "Close issue" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /completed/ }))

    expect(await screen.findByText("Issue is locked.")).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText(/^Open /)).toBeDefined())
  })

  test("lets a later read say the issue is open again", async () => {
    /*
     * The press stands over the read only until the read agrees with it. It used
     * to stand over it forever: nothing here compared the two, so a close made a
     * minute ago went on being drawn over an issue somebody had since reopened
     * from another tab, for as long as the document lived.
     *
     * Coming back to the tab is what asks again, which is how this drives a
     * second read without reaching for anything the screen does not offer.
     */
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })

    let saying = issue
    render(
      closable({
        load: () => Effect.succeed({ snapshot: saying }),
        settle: () => Effect.void,
        reopen: () => Effect.void
      })
    )

    await userEvent.click(await screen.findByRole("button", { name: "Close issue" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /completed/ }))

    // Worn, while GitHub's own read still says open.
    await waitFor(() => expect(screen.getByLabelText(/^Closed /)).toBeDefined())

    // GitHub agrees, and then it is reopened somewhere else. That last fact is
    // theirs to report, and this page has to be able to hear it.
    saying = settled
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))
    await waitFor(() => expect(screen.getByLabelText(/^Closed /)).toBeDefined())

    saying = issue
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))
    await waitFor(() => expect(screen.getByLabelText(/^Open /)).toBeDefined())
  })

  test("opens a closed one again, on one press and no menu", async () => {
    let reopened = 0
    render(
      closable({
        load: () => Effect.succeed({ snapshot: { ...settled, allowed: { ...issue.allowed, close: false, reopen: true } } }),
        reopen: () => Effect.sync(() => void (reopened += 1))
      })
    )

    await userEvent.click(await screen.findByRole("button", { name: "Reopen issue" }))

    await waitFor(() => expect(reopened).toBe(1))
    await waitFor(() => expect(screen.getByLabelText(/^Open /)).toBeDefined())
  })

  test("offers the way back out of a close, which is what makes one press honest", async () => {
    let reopened = 0
    render(
      closable({
        settle: () => Effect.void,
        reopen: () => Effect.sync(() => void (reopened += 1))
      })
    )

    await userEvent.click(await screen.findByRole("button", { name: "Close issue" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /completed/ }))

    await userEvent.click(await screen.findByRole("button", { name: "Undo" }))

    await waitFor(() => expect(reopened).toBe(1))
    await waitFor(() => expect(screen.getByLabelText(/^Open /)).toBeDefined())
  })

  test("offers nothing at all where nothing is wired up to it", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(issue.title)).toBeDefined())
    expect(screen.queryByRole("button", { name: "Close issue" })).toBeNull()
  })

  /**
   * The duplicate, which is the third close and the one that names another issue.
   *
   * The sentence carries the other issue's name, which theirs does not: "closed as a
   * duplicate" leaves out the one fact the reader wants next, which is a duplicate of what.
   */
  describe("closing it as a duplicate of another issue", () => {
    const naming = async (said: string) => {
      await userEvent.click(await screen.findByRole("button", { name: "Close issue" }))
      await userEvent.click(await screen.findByRole("menuitem", { name: /duplicate/ }))
      await userEvent.type(screen.getByLabelText(/Which issue is this a duplicate of/), said)
      await userEvent.click(screen.getByRole("button", { name: "Close as duplicate" }))
    }

    test("sends the issue the reader named, by address rather than by GitHub's name", async () => {
      let asked: unknown
      render(closable({ settle: (_id, settling) => Effect.sync(() => void (asked = settling)) }))

      await naming("#78")

      await waitFor(() =>
        expect(asked).toEqual({
          as: "duplicate",
          of: { owner: issue.reference.owner, repo: issue.reference.repo, number: 78 }
        })
      )
    })

    test("says which issue it is a duplicate of, which their own message leaves out", async () => {
      render(closable({ settle: () => Effect.void }))

      await naming("#78")

      expect(
        await screen.findByText(`This issue is closed as a duplicate of ${issue.reference.owner}/${issue.reference.repo}#78`)
      ).toBeTruthy()
    })

    test("puts it back where GitHub has no such issue to point at", async () => {
      render(
        closable({
          settle: () => Effect.fail({ reason: "rejected", detail: "Could not resolve to a node." })
        })
      )

      await naming("#4321")

      expect(await screen.findByText("Could not resolve to a node.")).toBeTruthy()
      await waitFor(() => expect(screen.getByLabelText(/^Open /)).toBeDefined())
    })
  })
})
