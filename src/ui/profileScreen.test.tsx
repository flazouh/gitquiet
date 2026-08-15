import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Effect, Option } from "effect"
import type { Answering } from "../domain/answering"
import type { ListedRepository } from "../domain/life"
import type { Person } from "../domain/person"
import { type Owned, ProfileScreen } from "./ProfileScreen"

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
  isFork: false,
  forkedFrom: Option.none(),
  isPrivate: false,
  ...over
})

const answered = (over: Partial<Answering> = {}): Answering => ({
  reviews: 4,
  replies: 9,
  pulls: 2,
  places: 3,
  last: daysAgo(2),
  days: 90,
  ...over
})

const who = (): Person => ({
  login: "flazouh",
  name: Option.some("Alex"),
  bio: Option.none(),
  faceUrl: Option.none(),
  company: Option.none(),
  location: Option.none(),
  followers: Option.some("25"),
  following: Option.some("65"),
  site: Option.none(),
  ways: [],
  sponsorAt: Option.none(),
  tally: { repositories: Option.some("121"), stars: Option.none() }
})

const LIST: ReadonlyArray<ListedRepository> = [
  row({ repo: "gitquiet", pushedAt: daysAgo(1) }),
  row({ repo: "coadra", pushedAt: daysAgo(3) }),
  row({ repo: "unhog", pushedAt: daysAgo(4) }),
  row({ repo: "liya", pushedAt: daysAgo(5) }),
  row({ repo: "ego", pushedAt: daysAgo(6) }),
  row({ repo: "shots", pushedAt: daysAgo(7) }),
  row({ repo: "seventh", pushedAt: daysAgo(8) }),
  row({ repo: "notes", pushedAt: daysAgo(400) }),
  row({ repo: "old-cli", isArchived: true, pushedAt: daysAgo(3) })
]

const shown = (
  over: {
    readonly said?: Answering
    readonly owned?: Owned
    readonly failing?: boolean
    readonly failingAnswering?: boolean
  } = {}
) =>
  render(
    <ProfileScreen
      login="flazouh"
      now={now}
      answering={() =>
        over.failingAnswering
          ? Effect.fail(new Error("no") as never)
          : Effect.succeed(over.said ?? answered())
      }
      owned={() =>
        over.failing
          ? Effect.fail(new Error("no") as never)
          : Effect.succeed(over.owned ?? { rows: LIST, reading: false, capped: false })
      }
      who={who()}
      onStepAside={() => {}}
      signedIn={() => true}
    />
  )

describe("whether this person answers anybody", () => {
  test("leads with the three acts that are somebody answering", async () => {
    // The one question a reader with a stranger's pull request open brings to this page.
    shown()

    const band = await screen.findByRole("region", { name: "Answering" })

    expect(band.textContent).toContain("4")
    expect(band.textContent).toContain("reviews")
    expect(band.textContent).toContain("9")
    expect(band.textContent).toContain("replies")
    expect(band.textContent).toContain("pull requests")
  })

  test("says how far the count reaches and where it is blind", async () => {
    shown()

    const band = await screen.findByRole("region", { name: "Answering" })

    expect(band.textContent).toContain("last 90 days")
    expect(band.textContent).toContain("3 repositories")
    expect(band.textContent).toContain("private work is not in it")
  })

  test("says so plainly where they answered nobody", async () => {
    shown({ said: answered({ reviews: 0, replies: 0, pulls: 0, places: 0, last: Option.none() }) })

    const band = await screen.findByRole("region", { name: "Answering" })
    expect(band.textContent).toContain("has answered nobody in public")
  })
})

describe("the few of their repositories that still move", () => {
  test("shows six of them and offers the rest on their own tab", async () => {
    shown()

    const band = await screen.findByRole("region", { name: "Repositories" })

    expect(band.querySelectorAll("li")).toHaveLength(6)
    expect(band.querySelector('a[href="/flazouh?tab=repositories"]')?.textContent).toBe("All 9")
  })

  test("counts every group, so the band agrees with the tab it links to", async () => {
    shown()

    const band = await screen.findByRole("region", { name: "Repositories" })

    expect(band.textContent).toContain("7 moving")
    expect(band.textContent).toContain("1 quiet")
    expect(band.textContent).toContain("1 retired")
  })
})

describe("their column and their tabs", () => {
  test("draws the same column and tab row as their other pages", async () => {
    shown()

    const aside = await screen.findByRole("complementary", { name: "About flazouh" })
    const tabs = await screen.findByRole("navigation", { name: /flazouh/ })

    expect(aside.textContent).toContain("Alex")
    expect(tabs.querySelector('a[aria-current="page"]')?.textContent).toBe("Overview")
  })
})

describe("a read that failed", () => {
  test("keeps the band that answered where the other read failed", async () => {
    // The question this page exists to answer was answered. Handing the whole page back
    // over the list would throw that away for a network that dropped one request.
    shown({ failing: true })

    expect((await screen.findByRole("region", { name: "Answering" })).textContent).toContain(
      "reviews"
    )
    expect((await screen.findByRole("region", { name: "Repositories" })).textContent).toContain(
      "Could not read flazouh's repositories"
    )
    expect(screen.queryByRole("button", { name: "Show GitHub's page" })).toBeNull()
  })

  test("offers their page back where neither read answered", async () => {
    shown({ failing: true, failingAnswering: true })

    expect(await screen.findByRole("button", { name: "Show GitHub's page" })).toBeTruthy()
  })

  test("says so where they own nothing, rather than dropping the band", async () => {
    shown({ owned: { rows: [], reading: false, capped: false } })

    expect((await screen.findByRole("region", { name: "Repositories" })).textContent).toContain(
      "flazouh has no public repository."
    )
  })
})
