import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ListedRepository } from "../domain/life"
import { PersonReposScreen, type Shown } from "./PersonReposScreen"

afterEach(cleanup)

const now = new Date("2026-08-15T00:00:00Z")

const daysAgo = (days: number): Option.Option<string> =>
  Option.some(new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString())

const row = (over: Partial<ListedRepository> & { readonly repo: string }): ListedRepository => ({
  owner: "flazouh",
  nameWithOwner: `flazouh/${over.repo}`,
  description: Option.none(),
  topics: [],
  language: Option.none(),
  stars: 0,
  forks: 0,
  pushedAt: daysAgo(2),
  isArchived: false,
  forkedFrom: Option.none(),
  isPrivate: false,
  ...over
})

const shown = (rows: ReadonlyArray<ListedRepository>, over: Partial<Shown> = {}) =>
  render(
    <PersonReposScreen
      login="flazouh"
      now={now}
      load={() => Effect.succeed({ rows, reading: false, capped: false, ...over })}
      onStepAside={() => {}}
      signedIn={() => true}
    />
  )

const heading = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) })

const names = () =>
  screen
    .getAllByRole("listitem")
    .map((one) => one.querySelector("a")?.textContent)
    .filter((one) => one !== undefined)

const LIST: ReadonlyArray<ListedRepository> = [
  row({ repo: "gitquiet", pushedAt: daysAgo(1) }),
  row({ repo: "notes", pushedAt: daysAgo(400) }),
  row({ repo: "old-cli", isArchived: true, pushedAt: daysAgo(3) }),
  row({ repo: "vscode", forkedFrom: Option.some("microsoft/vscode"), pushedAt: daysAgo(500) })
]

describe("a person's repositories, in groups", () => {
  test("draws a heading and a count for each group there is", async () => {
    // The loudest unanswered ask on this page: 1,679 upvotes across three
    // discussions, all for exactly this.
    shown(LIST)

    for (const name of ["Moving", "Quiet", "Retired", "Forked"]) {
      expect(await screen.findByRole("button", { name: new RegExp(`^${name}`) })).toBeTruthy()
    }
    expect(heading("Moving").textContent).toContain("1")
  })

  test("draws no heading for a group with nothing in it", async () => {
    shown([row({ repo: "gitquiet" })])
    await screen.findByRole("button", { name: /^Moving/ })

    expect(screen.queryByRole("button", { name: /^Retired/ })).toBeNull()
  })

  test("keeps an archived repository out of moving, whatever its date says", async () => {
    shown(LIST)
    await screen.findByRole("button", { name: /^Retired/ })

    expect(names()).toContain("old-cli")
    expect(heading("Retired").textContent).toContain("1")
    expect(heading("Moving").textContent).toContain("1")
  })

  test("starts with forked shut, because it is mostly not their work", async () => {
    shown(LIST)

    const forked = await screen.findByRole("button", { name: /^Forked/ })
    expect(forked.getAttribute("aria-expanded")).toBe("false")
    expect(names()).not.toContain("vscode")
  })

  test("opens a shut group when its heading is pressed, and remembers it", async () => {
    shown(LIST)
    const forked = await screen.findByRole("button", { name: /^Forked/ })

    await userEvent.click(forked)

    expect(screen.getByRole("button", { name: /^Forked/ }).getAttribute("aria-expanded")).toBe(
      "true"
    )
    expect(names()).toContain("vscode")
  })

  test("shuts a group that started open", async () => {
    shown(LIST)
    await userEvent.click(await screen.findByRole("button", { name: /^Moving/ }))

    expect(names()).not.toContain("gitquiet")
  })
})

describe("one row", () => {
  test("says when it last moved as a date, never as a distance", async () => {
    // "2 years ago" under "3 years ago" is the same three words to somebody
    // scanning thirty rows, and which is maintained is the question being asked.
    shown([row({ repo: "notes", pushedAt: Option.some("2019-03-12T10:00:00Z") })])

    const one = await screen.findByRole("listitem")
    expect(one.textContent).toContain("moved 12 Mar 2019")
  })

  test("carries the language, the stars, the forks and up to three topics", async () => {
    shown([
      row({
        repo: "gitquiet",
        description: Option.some("A quieter GitHub"),
        language: Option.some({ name: "TypeScript", colour: "#3178c6" }),
        stars: 42,
        forks: 3,
        topics: ["browser-extension", "github", "typescript", "effect"]
      })
    ])

    const one = await screen.findByRole("listitem")
    expect(one.textContent).toContain("A quieter GitHub")
    expect(one.textContent).toContain("TypeScript")
    expect(one.textContent).toContain("42 stars")
    expect(one.textContent).toContain("3 forks")
    // Three of the four, because a row with eleven topics is a row whose name and
    // description are the last things a reader finds in it.
    expect([...one.querySelectorAll('a[href^="/topics/"]')].map((topic) => topic.textContent)).toEqual([
      "browser-extension",
      "github",
      "typescript"
    ])
  })

  test("names what a fork came from, so the row is not read as their work", async () => {
    shown([row({ repo: "vscode", forkedFrom: Option.some("microsoft/vscode"), pushedAt: daysAgo(1) })])

    const one = await screen.findByRole("listitem")
    expect(one.textContent).toContain("forked from microsoft/vscode")
  })

  test("says a repository has never been pushed to rather than drawing nothing", async () => {
    shown([row({ repo: "empty", pushedAt: Option.none() })])

    expect((await screen.findByRole("listitem")).textContent).toContain("never pushed to")
  })
})

describe("the two figures over the list", () => {
  test("the strip carries one cell per repository, newest first", async () => {
    shown(LIST)

    const strip = await screen.findByRole("region", { name: "Last moved" })
    const cells = strip.querySelectorAll("a")
    expect(cells).toHaveLength(4)
    expect(cells[0]?.getAttribute("aria-label")).toBe("flazouh/gitquiet")
  })

  test("the language bar counts repositories rather than claiming bytes", async () => {
    // GitHub counts a repository's languages by bytes and these rows carry one
    // language each. A percentage here would disagree with their own page.
    shown([
      row({ repo: "a", language: Option.some({ name: "TypeScript", colour: "#3178c6" }) }),
      row({ repo: "b", language: Option.some({ name: "TypeScript", colour: "#3178c6" }) }),
      row({ repo: "c", language: Option.some({ name: "Rust", colour: "#dea584" }) })
    ])

    const bar = await screen.findByRole("region", { name: "Languages" })
    expect(bar.textContent).toContain("TypeScript")
    expect(bar.textContent).toContain("2")
    expect(bar.textContent).toContain("Rust")
  })

  test("draws neither figure on a list with no languages and no rows", async () => {
    shown([])

    await screen.findByText(/no public repository/)
    expect(screen.queryByRole("region", { name: "Languages" })).toBeNull()
    expect(screen.queryByRole("region", { name: "Last moved" })).toBeNull()
  })
})

describe("finding one of them", () => {
  test("matches the description and the topics, not the name alone", async () => {
    // Their own box reads names, which their documentation says outright.
    shown([
      row({ repo: "chrono", description: Option.some("parses dates") }),
      row({ repo: "gitquiet", topics: ["browser-extension"] })
    ])
    await screen.findAllByRole("listitem")

    await userEvent.type(screen.getByRole("searchbox"), "parses")

    expect(names()).toEqual(["chrono"])
  })

  test("says how many of the whole list matched", async () => {
    shown(LIST)
    await screen.findAllByRole("listitem")

    await userEvent.type(screen.getByRole("searchbox"), "gitquiet")

    expect(screen.getByText("1 of 4")).toBeTruthy()
  })

  test("redraws the figures over what matched rather than over the page", async () => {
    shown([
      row({ repo: "a", language: Option.some({ name: "TypeScript", colour: "#3178c6" }) }),
      row({ repo: "b", language: Option.some({ name: "Rust", colour: "#dea584" }) })
    ])
    await screen.findAllByRole("listitem")

    await userEvent.type(screen.getByRole("searchbox"), "rust")

    const bar = screen.getByRole("region", { name: "Languages" })
    expect(bar.textContent).toContain("Rust")
    expect(bar.textContent).not.toContain("TypeScript")
  })

  test("says nothing matched rather than drawing an empty list", async () => {
    shown(LIST)
    await screen.findAllByRole("listitem")

    await userEvent.type(screen.getByRole("searchbox"), "nothing of theirs")

    expect(screen.getByText(/Nothing here matches/)).toBeTruthy()
  })
})

describe("what the count admits", () => {
  test("says the rest of their list is still being read", async () => {
    // A group total over the first thirty of 154 rows is a wrong answer
    // confidently drawn, and the count is where that has to be said.
    shown(LIST, { reading: true })

    expect(await screen.findByText(/reading the rest/)).toBeTruthy()
  })

  test("says so when it stopped at the cap rather than at the end", async () => {
    shown(LIST, { capped: true })

    expect(await screen.findByText(/the first pages of a longer list/)).toBeTruthy()
  })

  test("says neither once the whole list is in", async () => {
    shown(LIST)

    expect(await screen.findByText("4 repositories")).toBeTruthy()
  })
})

describe("their three pages", () => {
  test("marks the tab the reader is on and links to the other two", async () => {
    shown(LIST)

    const tabs = await screen.findByRole("navigation", { name: /flazouh/ })
    const rows = [...tabs.querySelectorAll("a")].map((one) => [
      one.textContent,
      one.getAttribute("href"),
      one.getAttribute("aria-current")
    ])

    expect(rows).toEqual([
      ["Overview", "/flazouh", null],
      ["Repositories", "/flazouh?tab=repositories", "page"],
      ["Stars", "/flazouh?tab=stars", null]
    ])
  })
})

describe("a read that failed", () => {
  test("offers their list back rather than an empty screen", async () => {
    render(
      <PersonReposScreen
        login="flazouh"
        now={now}
        load={() => Effect.fail(new Error("GitHub said no"))}
        onStepAside={() => {}}
        signedIn={() => true}
      />
    )

    expect(await screen.findByRole("button", { name: "Show GitHub's list" })).toBeTruthy()
  })
})
