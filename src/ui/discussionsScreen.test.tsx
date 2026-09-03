import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import { Effect, Option } from "effect"
import { categoriesOnPage, discussionsOnPage } from "../github/discussionsList"
import { DiscussionsScreen, type Shown } from "./DiscussionsScreen"

afterEach(cleanup)

/*
 * `vercel/next.js/discussions` as GitHub served it on 2026-09-03, drawn through the real parser
 * rather than through rows written here. A screen tested against hand-made rows is a screen
 * tested against what somebody hoped the page said.
 */
const real = await Bun.file("tests/fixtures/discussionsList.html").text()

const repo = { owner: "vercel", repo: "next.js" }

const SHOWN: Shown = {
  rows: discussionsOnPage(real),
  categories: categoriesOnPage(real),
  more: true
}

const show = (shown: Shown = SHOWN, category = Option.none<string>()) =>
  render(
    <DiscussionsScreen
      repo={repo}
      category={category}
      load={() => Effect.succeed(shown)}
      signedIn={() => true}
      onStepAside={() => {}}
    />
  )

describe("a repository's discussions", () => {
  test("draws three headings and never a fourth", async () => {
    show()

    await screen.findByRole("region", { name: "Needs You" })
    screen.getByRole("region", { name: "Waiting" })
    screen.getByRole("region", { name: "Settled" })
    expect(screen.queryByRole("region", { name: "Running" })).toBeNull()
  })

  /*
   * The whole of what this screen is for. On this page GitHub draws fifteen questions with the
   * same grey outlined check it draws on a question nobody has replied to, and one of the fifteen
   * is closed. The other fourteen are what a reader can finish.
   */
  test("gathers the questions with replies and no answer under Needs You", async () => {
    show()

    const yours = await screen.findByRole("region", { name: "Needs You" })

    expect(within(yours).getAllByRole("listitem")).toHaveLength(14)
    expect(within(yours).getAllByText("Stale")).toHaveLength(14)
  })

  test("names one of them by its title, so the row is a thing and not a count", async () => {
    show()

    const yours = await screen.findByRole("region", { name: "Needs You" })

    expect(
      within(yours).getByRole("link", { name: "High Memory Usage by next-server process." })
    ).toHaveProperty("href")
  })

  /*
   * A closed question is still a question nobody answered, so both facts are on the row. Their
   * own row prints them together and this one does too.
   */
  test("says a row is closed beside what it is still waiting for", async () => {
    show()

    const settled = await screen.findByRole("region", { name: "Settled" })
    const closed = within(settled).getAllByText("Closed")

    expect(closed.length).toBeGreaterThan(0)
  })

  test("offers every category their sidebar names, not only the five with a row", async () => {
    show()

    const filter = await screen.findByRole("navigation", { name: "Categories" })

    // Nine, and All beside them.
    expect(within(filter).getAllByRole("link")).toHaveLength(10)
    expect(within(filter).getByRole("link", { name: /Polls/ })).toHaveProperty("href")
  })

  test("says there is another page rather than guessing at how many", async () => {
    show()

    expect(await screen.findByText(/more discussions after these/)).toBeTruthy()
  })

  test("says nothing is being discussed where nothing is", async () => {
    show({ rows: [], categories: [], more: false })

    expect(await screen.findByText(/Nothing is being discussed in vercel\/next\.js/)).toBeTruthy()
  })

  test("hands GitHub's own list back when the read fails", async () => {
    render(
      <DiscussionsScreen
        repo={repo}
        category={Option.none()}
        load={() => Effect.fail(new Error("no"))}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

    expect(await screen.findByRole("button", { name: "Show GitHub's list" })).toBeTruthy()
  })
})
