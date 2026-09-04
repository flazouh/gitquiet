import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import { Effect, Option } from "effect"
import type { DiscussionList } from "../domain/discussions"
import { categoriesOnPage, discussionsOnPage } from "../github/discussionsList"
import { DiscussionsScreen, type Shown } from "./DiscussionsScreen"

afterEach(cleanup)

/*
 * `vercel/next.js/discussions` as GitHub served it on 2026-09-03, drawn through the real parser
 * rather than through rows written here. A screen tested against hand-made rows is a screen
 * tested against what somebody hoped the page said.
 */
const real = await Bun.file("tests/fixtures/discussionsList.html").text()

const list = (over: Partial<DiscussionList> = {}): DiscussionList => ({
  repo: { owner: "vercel", repo: "next.js" },
  category: Option.none(),
  query: "",
  page: 1,
  ...over
})

const SHOWN: Shown = {
  rows: discussionsOnPage(real),
  categories: categoriesOnPage(real),
  more: true
}

const show = (shown: Shown = SHOWN, standing: DiscussionList = list()) =>
  render(
    <DiscussionsScreen
      list={standing}
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

  test("says nothing is being discussed where nothing is", async () => {
    show({ rows: [], categories: [], more: false })

    expect(await screen.findByText(/Nothing is being discussed in vercel\/next\.js/)).toBeTruthy()
  })

  test("hands GitHub's own list back when the read fails", async () => {
    render(
      <DiscussionsScreen
        list={list()}
        load={() => Effect.fail(new Error("no"))}
        signedIn={() => true}
        onStepAside={() => {}}
      />
    )

    expect(await screen.findByRole("button", { name: "Show GitHub's list" })).toBeTruthy()
  })
})

describe("the filter bar", () => {
  /*
   * The press this whole screen argues for. GitHub's own controls offer Unanswered, which on the
   * eight repositories counted is 98 rows of 120; 94 of those already have somebody's reply in
   * them. Nobody would think to type `is:unanswered comments:>0`, and GitHub answers it.
   */
  test("offers Stale as one press, written in their own vocabulary", async () => {
    show()

    const filters = await screen.findByRole("navigation", { name: "Filters" })
    const stale = within(filters).getByRole("link", { name: "Stale" })

    expect(stale.getAttribute("href")).toBe(
      "/vercel/next.js/discussions?discussions_q=is%3Aunanswered+comments%3A%3E0"
    )
  })

  test("says which chip the reader is already on", async () => {
    show(SHOWN, list({ query: "is:answered" }))

    const filters = await screen.findByRole("navigation", { name: "Filters" })

    expect(
      within(filters).getByRole("link", { name: "Answered" }).getAttribute("aria-current")
    ).toBe("true")
    expect(
      within(filters).getByRole("link", { name: "Stale" }).getAttribute("aria-current")
    ).toBeNull()
  })

  /*
   * Asking a different question is asking it of the whole list. A reader on page four who presses
   * Stale and is given page four of the stale ones sees an empty list for no reason they can see.
   */
  test("a chip goes back to the first page", async () => {
    show(SHOWN, list({ page: 4 }))

    const filters = await screen.findByRole("navigation", { name: "Filters" })
    const stale = within(filters).getByRole("link", { name: "Stale" })

    expect(stale.getAttribute("href")).not.toContain("page=")
  })

  /*
   * Their own sidebar drops the filter every time a category is pressed. Wanting to read the
   * Help category is not a reason to stop wanting the stale ones.
   */
  test("a category keeps whatever the reader was filtering by", async () => {
    show(SHOWN, list({ query: "is:unanswered comments:>0" }))

    const categories = await screen.findByRole("navigation", { name: "Categories" })
    const help = within(categories).getByRole("link", { name: /Help/ })

    expect(help.getAttribute("href")).toBe(
      "/vercel/next.js/discussions/categories/help?discussions_q=is%3Aunanswered+comments%3A%3E0"
    )
  })

  test("the box holds the reader's words and never the chips' terms", async () => {
    show(SHOWN, list({ query: "is:unanswered comments:>0 memory leak" }))

    const box = await screen.findByRole("textbox", { name: "Search these discussions" })

    expect(box).toHaveProperty("value", "memory leak")
  })

  test("both ways through the pager where there is a page either side", async () => {
    show(SHOWN, list({ page: 3 }))

    const pages = await screen.findByRole("navigation", { name: "Pages" })

    expect(within(pages).getByRole("link", { name: "Newer" }).getAttribute("href")).toContain(
      "page=2"
    )
    expect(within(pages).getByRole("link", { name: "Older" }).getAttribute("href")).toContain(
      "page=4"
    )
  })
})

describe("raising one", () => {
  /*
   * Handed over rather than drawn. Which category a discussion goes in, and what each of a
   * repository's categories is for, is their page's to explain.
   */
  test("sends a reader to GitHub's own form", async () => {
    show()

    const link = await screen.findByRole("link", { name: "New discussion" })

    expect(link.getAttribute("href")).toBe("/vercel/next.js/discussions/new")
  })

  test("draws the label a maintainer put on a row", async () => {
    show()

    expect(await screen.findByText("Linking and Navigating")).toBeTruthy()
  })
})
