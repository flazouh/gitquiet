import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ListedRepository } from "../domain/life"
import type { Person } from "../domain/person"
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

/** Who their page said they were, as `personIn` hands it over. */
const who = (over: Partial<Person> = {}): Person => ({
  login: "flazouh",
  name: Option.some("Alex"),
  bio: Option.some("Building Acepe"),
  faceUrl: Option.some("https://avatars.githubusercontent.com/u/25705704?v=4"),
  company: Option.none(),
  location: Option.none(),
  followers: Option.some("25"),
  following: Option.some("65"),
  site: Option.some({ label: "acepe.dev", href: "https://acepe.dev" }),
  ways: [{ label: "@sasha_zelts", href: "https://x.com/sasha_zelts" }],
  sponsorAt: Option.some("/sponsors/flazouh"),
  tally: { repositories: Option.some("55"), stars: Option.some("113") },
  ...over
})

const shown = (
  rows: ReadonlyArray<ListedRepository>,
  over: Partial<Shown> = {},
  props: { readonly who?: Person; readonly onStepAside?: () => void } = {}
) =>
  render(
    <PersonReposScreen
      login="flazouh"
      now={now}
      load={() => Effect.succeed({ rows, reading: false, capped: false, ...over })}
      onStepAside={props.onStepAside ?? (() => {})}
      who={props.who}
      signedIn={() => true}
    />
  )

/**
 * One group's card, found by its heading.
 *
 * The heading is inside the `summary` that opens it, which is the fold the rest of this
 * extension uses. `details.open` is the state, and it is the browser's rather than ours.
 */
const fold = (name: string): HTMLDetailsElement => {
  const heading = screen.getByRole("heading", { name: new RegExp(`^${name}$`) })
  const found = heading.closest("details")
  if (found === null) throw new Error(`no fold around ${name}`)
  return found as HTMLDetailsElement
}

const opened = (name: string): boolean => fold(name).open

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
  test("draws a card with a heading and a count for each group there is", async () => {
    // The loudest unanswered ask on this page: 1,679 upvotes across three
    // discussions, all for exactly this.
    shown(LIST)

    for (const name of ["Moving", "Quiet", "Retired", "Forked"]) {
      expect(await screen.findByRole("heading", { name: new RegExp(`^${name}$`) })).toBeTruthy()
    }
    expect(fold("Moving").textContent).toContain("pushed to in the last 30 days")
  })

  test("draws no card for a group with nothing in it", async () => {
    shown([row({ repo: "gitquiet" })])
    await screen.findByRole("heading", { name: /^Moving$/ })

    expect(screen.queryByRole("heading", { name: /^Retired$/ })).toBeNull()
  })

  test("keeps an archived repository out of moving, whatever its date says", async () => {
    shown(LIST)
    await screen.findByRole("heading", { name: /^Retired$/ })

    expect(names()).toContain("old-cli")
    expect(fold("Retired").textContent).toContain("1")
    expect(fold("Moving").textContent).toContain("1")
  })

  test("starts with forked shut, because it is mostly not their work", async () => {
    shown(LIST)
    await screen.findByRole("heading", { name: /^Forked$/ })

    expect(opened("Forked")).toBe(false)
    expect(opened("Moving")).toBe(true)
  })

  test("opens a shut group when its heading is pressed", async () => {
    shown(LIST)
    await screen.findByRole("heading", { name: /^Forked$/ })

    await userEvent.click(screen.getByRole("heading", { name: /^Forked$/ }))

    expect(opened("Forked")).toBe(true)
  })

  test("shuts a group that started open", async () => {
    shown(LIST)
    await screen.findByRole("heading", { name: /^Moving$/ })

    await userEvent.click(screen.getByRole("heading", { name: /^Moving$/ }))

    expect(opened("Moving")).toBe(false)
  })
})

describe("one row", () => {
  test("says when it last moved as a date, never as a distance", async () => {
    // "2 years ago" under "3 years ago" is the same three words to somebody
    // scanning thirty rows, and which is maintained is the question being asked.
    shown([row({ repo: "notes", pushedAt: Option.some("2019-03-12T10:00:00Z") })])

    const one = await screen.findByRole("listitem")
    expect(one.textContent).toContain("12 Mar 2019")
  })

  test("carries what the repository is, its language, its stars and its forks", async () => {
    shown([
      row({
        repo: "gitquiet",
        description: Option.some("A quieter GitHub"),
        language: Option.some({ name: "TypeScript", colour: "#3178c6" }),
        stars: 42,
        forks: 3,
        topics: ["browser-extension", "github"]
      })
    ])

    const one = await screen.findByRole("listitem")
    expect(one.textContent).toContain("A quieter GitHub")
    expect(one.textContent).toContain("TypeScript")
    expect(one.textContent).toContain("42 stars")
    expect(one.textContent).toContain("3 forks")
  })

  test("keeps the topics out of the line and in the find box", async () => {
    // Their own rows print every topic as a chip, which is how thirty repositories
    // become five hundred pixels of chips. The topics are still how a reader finds
    // one, so they are searched rather than drawn.
    shown([row({ repo: "gitquiet", topics: ["browser-extension"] })])
    await screen.findByRole("listitem")

    expect(screen.queryByText("browser-extension")).toBeNull()

    await userEvent.type(screen.getByRole("searchbox"), "browser-ext")

    expect(names()).toEqual(["gitquiet"])
  })

  test("names what a fork came from, so the row is not read as their work", async () => {
    shown([
      row({ repo: "vscode", forkedFrom: Option.some("microsoft/vscode"), pushedAt: daysAgo(1) })
    ])

    const one = await screen.findByRole("listitem")
    expect(one.textContent).toContain("forked from microsoft/vscode")
  })

  /*
   * One word in the column and the sentence in the label, because the column is five and a
   * half rems: "never" beside a date is read as a date that is not there, and anybody being
   * read to still hears the whole of it.
   */
  test("says a repository has never been pushed to rather than drawing nothing", async () => {
    shown([row({ repo: "empty", pushedAt: Option.none() })])

    const one = await screen.findByRole("listitem")
    expect(one.textContent).toContain("never")
    expect(within(one).getByLabelText("never pushed to")).toBeTruthy()
  })

  test("holds every column open on every row, so the facts stay under each other", async () => {
    // The tracks and the cells are two lists in one file, and a column added to one
    // and forgotten in the other is a seam down the middle of every group that
    // nothing else would fail about. The Working Set holds the same line.
    shown([
      row({
        repo: "gitquiet",
        language: Option.some({ name: "TypeScript", colour: "#3178c6" }),
        stars: 42,
        forks: 3
      }),
      row({ repo: "notes" })
    ])
    const rows = await screen.findAllByRole("listitem")

    expect(rows[0]?.style.gridTemplateColumns).toBe(rows[1]?.style.gridTemplateColumns)
    expect(rows[0]?.childElementCount).toBe(rows[1]?.childElementCount)
  })

  test("keeps no column for a fact no row in the list has", async () => {
    // Seven rems held open on every line for a language none of these rows has is
    // width taken from the descriptions, which are the part worth reading.
    shown([row({ repo: "gitquiet" }), row({ repo: "notes" })])
    const rows = await screen.findAllByRole("listitem")

    expect(rows[0]?.style.gridTemplateColumns).not.toContain("7rem")
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

  test("says nothing matched, and offers the field back empty", async () => {
    shown(LIST)
    await screen.findAllByRole("listitem")

    await userEvent.type(screen.getByRole("searchbox"), "nothing of theirs")
    expect(screen.getByText(/Nothing matches that/)).toBeTruthy()

    await userEvent.click(screen.getByRole("button", { name: "Clear the filter" }))

    expect(names()).toContain("gitquiet")
  })

  test("rows arrive without motion while somebody is typing", async () => {
    // A stagger on every keystroke is decoration on an action a reader takes forty
    // times in a row. See the audit's first category.
    shown(LIST)
    await screen.findAllByRole("listitem")

    expect(screen.getAllByRole("listitem")[0]?.className).toContain("t-row-in")

    await userEvent.type(screen.getByRole("searchbox"), "git")

    expect(screen.getAllByRole("listitem")[0]?.className).not.toContain("t-row-in")
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

describe("the column down the left", () => {
  test("draws who they are from what their page already said", async () => {
    shown(LIST, {}, { who: who() })

    const aside = await screen.findByRole("complementary", { name: "About flazouh" })
    expect(aside.textContent).toContain("Alex")
    expect(aside.textContent).toContain("flazouh")
    expect(aside.textContent).toContain("Building Acepe")
    expect(aside.textContent).toContain("25 followers")
    expect(aside.textContent).toContain("acepe.dev")
    expect(aside.textContent).toContain("@sasha_zelts")
  })

  test("offers their page for the one act this interface will not do", async () => {
    // Following is a write, and every write on these pages is GitHub's own form.
    let asked = 0
    shown(LIST, {}, { who: who(), onStepAside: () => (asked += 1) })

    await userEvent.click(
      await screen.findByRole("button", { name: "Follow, on GitHub's page" })
    )

    expect(asked).toBe(1)
  })

  test("draws the list anyway where that column could not be read", async () => {
    shown(LIST)

    await screen.findByRole("heading", { name: /^Moving$/ })
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  /*
   * Where the column comes from, rather than when. The screen reads it off the served
   * page and reads it again while GitHub is still writing that page, and the reading is
   * `usePerson`'s: see `usePerson.test.tsx`, which holds the fault this had — a first
   * read against a document a few kilobytes long, answering with a name and nothing
   * under it. Tested there, it is a hook and a mutation. Tested here, it was a screen,
   * a list, a watcher and a four second window, and it failed about one run in four on
   * a machine running the whole suite.
   */
  test("draws the column the read hands over, whenever it arrives", async () => {
    render(
      <PersonReposScreen
        login="flazouh"
        now={now}
        load={() => Effect.succeed({ rows: LIST, reading: false, capped: false })}
        onStepAside={() => {}}
        readWho={() => Option.some(who())}
        signedIn={() => true}
      />
    )

    const aside = await screen.findByRole("complementary", { name: "About flazouh" })
    expect(aside.textContent).toContain("25 followers")
    expect(aside.textContent).toContain("acepe.dev")
  })

  test("carries their own counts on the tab row rather than counting rows", async () => {
    // The walk stops at a cap and the stars tab is never read, so a number counted
    // here would disagree with their page on the accounts where it matters.
    shown(LIST, {}, { who: who() })

    const tabs = await screen.findByRole("navigation", { name: /flazouh/ })
    expect(tabs.textContent).toContain("Repositories55")
    expect(tabs.textContent).toContain("Stars113")
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
  test("offers their page back rather than an empty screen", async () => {
    render(
      <PersonReposScreen
        login="flazouh"
        now={now}
        load={() => Effect.fail(new Error("GitHub said no"))}
        onStepAside={() => {}}
        signedIn={() => true}
      />
    )

    expect(await screen.findByRole("button", { name: "Show GitHub's page" })).toBeTruthy()
  })
})
