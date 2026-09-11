import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { Effect, Option } from "effect"
import type { DiscussionPress, DiscussionSnapshot } from "../domain/discussions"
import { discussionOnPage } from "../github/discussionView"
import { DiscussionScreen, type DiscussionScreenProps } from "./DiscussionScreen"
import { GatewayError } from "@/ports/GitHubGateway"

afterEach(cleanup)

/*
 * Two discussions of `vercel/next.js` as GitHub served them on 2026-09-03, drawn through the real
 * parser rather than through a snapshot written here. A screen tested against hand-made comments
 * is a screen tested against what somebody hoped the page said.
 */
const answeredHtml = await Bun.file("tests/fixtures/discussionAnswered.html").text()
const staleHtml = await Bun.file("tests/fixtures/discussionView.html").text()

const nextjs = { kind: "repository", owner: "vercel", repo: "next.js" } as const

const at = (number: number) => ({ home: nextjs, number })

const answered = Option.getOrThrow(discussionOnPage(at(98177), answeredHtml))
const stale = Option.getOrThrow(discussionOnPage(at(70178), staleHtml))

const show = (snapshot: DiscussionSnapshot) =>
  render(
    <DiscussionScreen
      reference={snapshot.reference}
      load={() => Effect.succeed(snapshot)}
      signedIn={() => true}
      onStepAside={() => {}}
    />
  )

describe("a discussion with an answer", () => {
  test("puts the answer above the thread rather than where it happened to be said", async () => {
    show(answered)

    const found = await screen.findByRole("region", { name: "The answer" })

    expect(within(found).getByText(/cacheComponents/)).toBeTruthy()
  })

  test("says the discussion is answered, in a word", async () => {
    show(answered)

    await screen.findByText("Answered")
  })

  /*
   * The answer is also left where it was said. Lifting it out and taking it away would break the
   * thread it is a reply in, and the reader who scrolls looking for it would not find it.
   */
  test("keeps the answer in the thread as well, marked where it stands", async () => {
    show(answered)

    const thread = await screen.findByRole("region", { name: "2 replies" })

    expect(within(thread).getAllByText("The answer")).toHaveLength(1)
  })
})

describe("a discussion nobody answered", () => {
  test("says Stale, which is the word GitHub has none for", async () => {
    show(stale)

    await screen.findByText("Stale")
  })

  /*
   * The card their page has no equivalent of. Nine comments in two years and nothing marked, so
   * the reply people upvoted most is lifted out under a heading that says exactly what it is.
   */
  test("offers the most upvoted reply, and never calls it the answer", async () => {
    show(stale)

    const found = await screen.findByRole("region", { name: "Nobody marked an answer" })

    expect(within(found).queryByText("The answer")).toBeNull()
    expect(screen.queryByRole("region", { name: "The answer" })).toBeNull()
  })

  test("draws every comment, with the replies under the comment they hang from", async () => {
    show(stale)

    const thread = await screen.findByRole("region", { name: "9 replies" })
    const top = within(thread).getAllByRole("listitem")

    // Six comments and three replies, and every reply inside its own comment's item.
    expect(top.length).toBeGreaterThanOrEqual(9)
    expect(within(top[0]!).getAllByRole("listitem")).toHaveLength(3)
  })

  /*
   * Scoped to the header, because the person who asked also replied twice in the thread below.
   * Asking the whole screen for the name found three of them.
   */
  test("names who asked, where, and how long ago", async () => {
    show(stale)

    const header = await screen.findByRole("region", { name: stale.title })

    expect(within(header).getByText("ShivamArora")).toBeTruthy()
    expect(within(header).getByRole("link", { name: "Help" })).toHaveProperty("href")
    expect(within(header).getByText("#70178")).toBeTruthy()
  })
})

describe("when the read does not come", () => {
  test("hands GitHub's own page back", async () => {
    render(
      <DiscussionScreen
        reference={at(70178)}
        load={() => Effect.fail(new Error("no"))}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

    expect(await screen.findByRole("button", { name: "Show GitHub's page" })).toBeTruthy()
  })
})

/*
 * Every control on this screen is behind two gates: whether GitHub rendered their own form for
 * it, and whether anything is wired up to send it. Both are needed, and neither is guessed at.
 */
describe("the presses GitHub offered", () => {
  const offered = (over: Partial<DiscussionSnapshot>): DiscussionSnapshot => ({
    ...stale,
    allowed: { say: true, upvote: true },
    ...over
  })

  const marking = (snapshot: DiscussionSnapshot, onPress: DiscussionScreenProps["onPress"]) =>
    render(
      <DiscussionScreen
        reference={snapshot.reference}
        load={() => Effect.succeed(snapshot)}
        onPress={onPress}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

  test("offers nothing where GitHub offered nothing, even with a way to send it", async () => {
    marking(stale, () => Effect.succeed(stale))

    await screen.findByText("Stale")
    expect(screen.queryByRole("button", { name: /Mark this as the answer/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Upvote this discussion/ })).toBeNull()
  })

  test("offers nothing where there is no way to send it, even where GitHub offered one", async () => {
    render(
      <DiscussionScreen
        reference={stale.reference}
        load={() => Effect.succeed(offered({}))}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

    await screen.findByText("Stale")
    expect(screen.queryByRole("button", { name: /Upvote this discussion/ })).toBeNull()
  })

  test("upvotes the question, and says what it is voting on", async () => {
    const pressed: Array<DiscussionPress> = []
    marking(offered({}), (press) => {
      pressed.push(press)
      return Effect.succeed(offered({}))
    })

    const button = await screen.findByRole("button", { name: "Upvote this discussion" })
    fireEvent.click(button)

    expect(pressed).toEqual([{ kind: "upvote", on: "Discussion", id: stale.id }])
  })

  /*
   * The press this whole screen argues for. On the eight repositories counted, 94 of the 98
   * unanswered questions had somebody's reply in them and nobody had done this.
   */
  test("marks a comment as the answer, naming the comment and not the discussion", async () => {
    const first = stale.comments[0]!
    const pressed: Array<DiscussionPress> = []

    marking(
      offered({
        comments: [{ ...first, mayMarkAnswer: true, replies: [] }]
      }),
      (press) => {
        pressed.push(press)
        return Effect.succeed(stale)
      }
    )

    /*
     * Scoped to the thread. The same comment is also the most upvoted one, so it is drawn twice:
     * once under the heading that says nobody marked an answer, and once where it was said.
     */
    const thread = await screen.findByRole("region", { name: "1 reply" })
    fireEvent.click(within(thread).getByRole("button", { name: "Mark this as the answer" }))

    expect(pressed).toEqual([{ kind: "mark-answer", comment: first.id }])
  })

  /*
   * What the press answered with is the discussion read again, so what is on the screen after one
   * is what GitHub says now rather than what this screen guessed it would say.
   */
  test("draws what the press answered with", async () => {
    const first = stale.comments[0]!

    marking(
      offered({ comments: [{ ...first, mayMarkAnswer: true, replies: [] }] }),
      () => Effect.succeed({ ...answered, allowed: { say: false, upvote: false } })
    )

    const thread = await screen.findByRole("region", { name: "1 reply" })
    fireEvent.click(within(thread).getByRole("button", { name: "Mark this as the answer" }))

    await screen.findByRole("region", { name: "The answer" })
  })

  /*
   * Failed with the error the gateway actually sends, and not with a plain `Error`. A
   * `GatewayError` carries no `message`, so a screen reading `cause.message` drew an alert with
   * nothing in it, and a test that failed with an `Error` was the one shape that hid it.
   */
  test("says a refusal out loud rather than swallowing it", async () => {
    marking(offered({}), () =>
      Effect.fail(
        new GatewayError({
          reference: { owner: "vercel", repo: "next.js" },
          route: "upvote a discussion",
          reason: "rejected",
          detail: "GitHub said no"
        })
      )
    )

    fireEvent.click(await screen.findByRole("button", { name: "Upvote this discussion" }))

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "GitHub said no")
  })

  test("says GitHub could not be reached when the call never landed", async () => {
    marking(offered({}), () =>
      Effect.fail(
        new GatewayError({
          reference: { owner: "vercel", repo: "next.js" },
          route: "upvote a discussion",
          reason: "unreachable",
          detail: "TypeError: Failed to fetch"
        })
      )
    )

    fireEvent.click(await screen.findByRole("button", { name: "Upvote this discussion" }))

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "GitHub could not be reached."
    )
  })
})

/*
 * `vercel/next.js#91275` — two options, two votes, and a question nobody has voted on from here.
 * Their page hides the results behind a press until you have voted; this draws them, because a
 * poll's answer is the point of it.
 */
const pollHtml = await Bun.file("tests/fixtures/discussionPoll.html").text()
const asked = Option.getOrThrow(discussionOnPage(at(91275), pollHtml))

describe("a discussion that is a poll", () => {
  test("asks the question and shows where the votes went", async () => {
    show(asked)

    const poll = await screen.findByRole("region", {
      name: "was non-standard characters [,(,),] in filenames one of the worst decisions ever?"
    })

    expect(within(poll).getByText("yes")).toBeTruthy()
    expect(within(poll).getByText("100%")).toBeTruthy()
    expect(within(poll).getByText("0%")).toBeTruthy()
    expect(within(poll).getByText("2 votes")).toBeTruthy()
  })

  test("offers no vote where GitHub hid their own button", async () => {
    show(asked)

    await screen.findByText("2 votes")
    expect(screen.queryByRole("button", { name: "Vote for yes" })).toBeNull()
  })

  test("sends the option's own id where GitHub offered the press", async () => {
    const poll = Option.getOrThrow(asked.poll)
    const pressed: Array<DiscussionPress> = []

    render(
      <DiscussionScreen
        reference={asked.reference}
        load={() => Effect.succeed({ ...asked, poll: Option.some({ ...poll, mayVote: true }) })}
        onPress={(press) => {
          pressed.push(press)
          return Effect.succeed(asked)
        }}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

    fireEvent.click(await screen.findByRole("button", { name: "Vote for yes" }))

    expect(pressed).toEqual([{ kind: "vote", option: "78929" }])
  })

  test("a discussion that is not a poll draws none", async () => {
    show(stale)

    await screen.findByText("Stale")
    expect(screen.queryByText(/votes$/)).toBeNull()
  })
})

describe("the faces on what people said", () => {
  test("draws the one face on this thread as a count, since GitHub offered no press", async () => {
    show(stale)

    const thread = await screen.findByRole("region", { name: "9 replies" })

    expect(within(thread).getByText(/🚀\s*1/)).toBeTruthy()
    expect(within(thread).queryByRole("button", { name: /React with/ })).toBeNull()
  })

  test("presses one where GitHub offered it, sending their name for the face", async () => {
    const last = stale.comments[stale.comments.length - 1]!
    const pressed: Array<DiscussionPress> = []

    render(
      <DiscussionScreen
        reference={stale.reference}
        load={() =>
          Effect.succeed({
            ...stale,
            comments: [
              {
                ...last,
                replies: [],
                reactions: [{ ...last.reactions[0]!, mayPress: true }]
              }
            ]
          })
        }
        onPress={(press) => {
          pressed.push(press)
          return Effect.succeed(stale)
        }}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

    const thread = await screen.findByRole("region", { name: "1 reply" })
    fireEvent.click(within(thread).getByRole("button", { name: "React with rocket" }))

    expect(pressed).toEqual([
      { kind: "react", on: "DiscussionComment", id: last.id, content: "rocket" }
    ])
  })
})

/*
 * Their own menu, which is where close, lock, edit and delete all live. This screen knows none of
 * them by name: it asks GitHub what is on offer, draws their sentences, and sends the form behind
 * whichever one was pressed.
 */
describe("everything else GitHub offers", () => {
  const menu = (
    doings: ReadonlyArray<{ said: string; danger: boolean }>,
    onPress: DiscussionScreenProps["onPress"] = () => Effect.succeed(stale)
  ) =>
    render(
      <DiscussionScreen
        reference={stale.reference}
        load={() => Effect.succeed(stale)}
        onPress={onPress}
        onAsk={() => Effect.succeed(doings)}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

  test("asks nothing until a reader opens it", async () => {
    let asked = 0
    render(
      <DiscussionScreen
        reference={stale.reference}
        load={() => Effect.succeed(stale)}
        onPress={() => Effect.succeed(stale)}
        onAsk={() => {
          asked += 1
          return Effect.succeed([])
        }}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

    await screen.findByText("Stale")

    // Seven of them on this thread, and not one request.
    expect(asked).toBe(0)
    expect(screen.getAllByText("More").length).toBeGreaterThan(1)
  })

  test("offers nothing where there is no way to ask", async () => {
    render(
      <DiscussionScreen
        reference={stale.reference}
        load={() => Effect.succeed(stale)}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

    await screen.findByText("Stale")
    expect(screen.queryByText("More")).toBeNull()
  })

  test("draws their sentences, in their words", async () => {
    menu([
      { said: "Close discussion", danger: false },
      { said: "Lock conversation", danger: false }
    ])

    const more = (await screen.findAllByText("More"))[0]!
    fireEvent.click(more)

    expect(await screen.findByRole("button", { name: "Close discussion" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Lock conversation" })).toBeTruthy()
  })

  test("sends the words that were pressed, and nothing about what they mean", async () => {
    const pressed: Array<DiscussionPress> = []
    menu([{ said: "Close discussion", danger: false }], (press) => {
      pressed.push(press)
      return Effect.succeed(stale)
    })

    fireEvent.click((await screen.findAllByText("More"))[0]!)
    fireEvent.click(await screen.findByRole("button", { name: "Close discussion" }))

    expect(pressed).toEqual([
      { kind: "doing", on: "Discussion", id: stale.id, said: "Close discussion" }
    ])
  })

  /*
   * GitHub marks the destructive ones in their own markup. Nothing here decides which of their
   * entries deletes something, and the one they marked asks twice.
   */
  test("a destructive entry asks twice", async () => {
    const pressed: Array<DiscussionPress> = []
    menu([{ said: "Delete", danger: true }], (press) => {
      pressed.push(press)
      return Effect.succeed(stale)
    })

    fireEvent.click((await screen.findAllByText("More"))[0]!)
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }))

    expect(pressed).toEqual([])

    fireEvent.click(await screen.findByRole("button", { name: "Delete, and mean it" }))

    expect(pressed).toEqual([{ kind: "doing", on: "Discussion", id: stale.id, said: "Delete" }])
  })

  test("says so where GitHub offers nothing", async () => {
    menu([])

    fireEvent.click((await screen.findAllByText("More"))[0]!)

    expect(await screen.findByText("GitHub offers nothing here.")).toBeTruthy()
  })
})
