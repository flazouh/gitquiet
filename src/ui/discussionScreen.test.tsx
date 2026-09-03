import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import { Effect, Option } from "effect"
import type { DiscussionSnapshot } from "../domain/discussions"
import { discussionOnPage } from "../github/discussionView"
import { DiscussionScreen } from "./DiscussionScreen"

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
