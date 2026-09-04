import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { Effect, Option } from "effect"
import type { DiscussionPress, DiscussionSnapshot } from "../domain/discussions"
import { discussionOnPage } from "../github/discussionView"
import { DiscussionScreen, type DiscussionScreenProps } from "./DiscussionScreen"

afterEach(cleanup)

/*
 * Two discussions of `vercel/next.js` as GitHub served them on 2026-09-03, drawn through the real
 * parser rather than through a snapshot written here. A screen tested against hand-made comments
 * is a screen tested against what somebody hoped the page said.
 */
const answeredHtml = await Bun.file("tests/fixtures/discussionAnswered.html").text()
const staleHtml = await Bun.file("tests/fixtures/discussionView.html").text()

const at = (number: number) => ({ owner: "vercel", repo: "next.js", number })

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

  test("says a refusal out loud rather than swallowing it", async () => {
    marking(offered({}), () => Effect.fail(new Error("GitHub said no")))

    fireEvent.click(await screen.findByRole("button", { name: "Upvote this discussion" }))

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "GitHub said no")
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
