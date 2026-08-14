import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { grouped, lifeOf } from "../domain/life"
import {
  hasNextOnPage,
  isTheirRepositories,
  repositoriesOnPage
} from "./personRepos"

/*
 * `/flazouh?tab=repositories` as GitHub served it on 2026-08-14: thirty rows, twelve
 * of them forks, none archived, and no star or fork counts because every count is
 * zero. Every element and attribute a parser touches is theirs, unedited.
 */
const real = await Bun.file("tests/fixtures/personRepos.html").text()

/*
 * `/sindresorhus?tab=repositories`, for the halves the first page has none of: rows
 * whose star and fork counts are drawn, in the thousands and with their own thousands
 * separator.
 */
const counted = await Bun.file("tests/fixtures/personReposCounted.html").text()

/*
 * `/tj?tab=repositories&type=archived`, which is their own filter and the only page of
 * the three that carries an archived row. Four of them, each marked twice — a class on
 * the row and a "Public archive" label beside the name.
 */
const archived = await Bun.file("tests/fixtures/personReposArchived.html").text()

const rows = repositoriesOnPage(real)

describe("reading their repositories tab", () => {
  test("finds every row on the page", () => {
    expect(rows).toHaveLength(30)
  })

  test("reads a row's facts as their page prints them", () => {
    const one = rows.find((row) => row.repo === "unhog")

    expect(one?.owner).toBe("flazouh")
    expect(one?.nameWithOwner).toBe("flazouh/unhog")
    expect(Option.getOrNull(one?.description ?? Option.none())).toContain(
      "menu-bar app that shows what is hogging your CPU"
    )
    expect(one?.topics).toEqual(["macos", "swift", "process-monitor", "swiftui", "menu-bar-app"])
    expect(Option.getOrNull(one?.pushedAt ?? Option.none())).toBe("2026-08-06T00:24:43Z")
    expect(one?.isArchived).toBe(false)
    expect(one?.isPrivate).toBe(false)
  })

  test("keeps the colour GitHub paints the language", () => {
    // Theirs rather than a table of ours, which would be a second copy of their
    // palette and wrong on whatever they added last month.
    const one = rows.find((row) => row.repo === "unhog")

    expect(Option.getOrNull(one?.language ?? Option.none())).toEqual({
      name: "Swift",
      colour: "#F05138"
    })
  })

  test("says what a fork is a fork of", () => {
    const one = rows.find((row) => row.repo === "ego-lite")

    expect(Option.getOrNull(one?.forkedFrom ?? Option.none())).toBe("citrolabs/ego-lite")
  })

  test("leaves a repository of their own with no parent", () => {
    const one = rows.find((row) => row.repo === "unhog")

    expect(one?.forkedFrom).toEqual(Option.none())
  })

  test("reads a count that is not drawn as a nought", () => {
    // GitHub draws no star link at all on a repository nobody has starred, so a
    // missing link is zero rather than a row that failed to read.
    const one = rows.find((row) => row.repo === "unhog")

    expect(one?.stars).toBe(0)
    expect(one?.forks).toBe(0)
  })

  test("and a count that is, whatever the thousands separator", () => {
    const one = repositoriesOnPage(counted).find((row) => row.repo === "eslint-plugin-unicorn")

    expect(one?.stars).toBe(5217)
    expect(one?.forks).toBe(495)
  })

  test("reads archived off the row rather than off the label beside the name", () => {
    // Both say it. The label says it in the reader's own language and the class says
    // it the same way on every page GitHub serves.
    const retired = repositoriesOnPage(archived)

    expect(retired).toHaveLength(4)
    expect(retired.every((row) => row.isArchived)).toBe(true)
  })

  test("comes back empty on a page that is not one of theirs", () => {
    // What the screen sees on an organisation, or on the day their markup changes.
    // Nothing rather than a row of empty strings, so the screen hands the page back.
    expect(repositoriesOnPage("<!doctype html><body><main>an organisation</main>")).toEqual([])
    expect(isTheirRepositories(new DOMParser().parseFromString(real, "text/html"))).toBe(true)
  })
})

describe("whether there is another page", () => {
  test("says so where their pager offers one", () => {
    expect(hasNextOnPage(real)).toBe(true)
  })

  test("and says so from the pager rather than from the count of rows", () => {
    // Thirty is their page size today. A screen that read "thirty means more" would
    // ask for a page that does not exist on every account with exactly thirty
    // repositories, and stop asking on the day they change the number.
    expect(repositoriesOnPage(archived)).toHaveLength(4)
    expect(hasNextOnPage(archived)).toBe(false)
  })
})

describe("what the groups make of a real page", () => {
  // The whole argument for this screen, measured on one real account rather than
  // asserted: thirty rows a reader has to scroll, and four groups that say which
  // of them is being worked on.
  const now = new Date("2026-08-14T00:00:00Z")

  test("divides the page into the groups it has rows for", () => {
    const groups = grouped(rows, now)

    expect(groups.map((group) => group.life)).toEqual(["moving", "quiet", "forked"])
  })

  test("and every row lands in exactly one of them", () => {
    const groups = grouped(rows, now)
    const kept = groups.flatMap((group) => group.rows)

    expect(kept).toHaveLength(rows.length)
    expect(new Set(kept.map((one) => one.nameWithOwner)).size).toBe(rows.length)
  })

  test("puts a fork pushed to lately in the work rather than under somebody else's name", () => {
    const fork = rows.find((row) => Option.isSome(row.forkedFrom) && lifeOf(row, now) === "moving")

    expect(fork).toBeDefined()
  })
})
