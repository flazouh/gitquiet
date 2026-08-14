import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { grouped, type Life, type ListedRepository, lifeOf, matching, shares } from "./life"

const now = new Date("2026-08-15T00:00:00Z")

const daysAgo = (days: number): string =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

const row = (over: Partial<ListedRepository> & { readonly repo: string }): ListedRepository => ({
  owner: "flazouh",
  nameWithOwner: `flazouh/${over.repo}`,
  description: Option.none(),
  topics: [],
  language: Option.none(),
  stars: 0,
  forks: 0,
  pushedAt: Option.some(daysAgo(1)),
  isArchived: false,
  forkedFrom: Option.none(),
  isPrivate: false,
  ...over
})

const lives = (one: ListedRepository): Life => lifeOf(one, now)

describe("what a repository is doing", () => {
  test("pushed to inside the window is moving", () => {
    expect(lives(row({ repo: "a", pushedAt: Option.some(daysAgo(2)) }))).toBe("moving")
    expect(lives(row({ repo: "a", pushedAt: Option.some(daysAgo(29)) }))).toBe("moving")
  })

  test("pushed to outside it is quiet", () => {
    expect(lives(row({ repo: "a", pushedAt: Option.some(daysAgo(31)) }))).toBe("quiet")
    expect(lives(row({ repo: "a", pushedAt: Option.some(daysAgo(900)) }))).toBe("quiet")
  })

  test("archived is retired, whatever the date says", () => {
    // The one group the owner said out loud. A repository retired last week was
    // pushed to last week, and reading that as moving argues with its own owner.
    const one = row({ repo: "a", isArchived: true, pushedAt: Option.some(daysAgo(1)) })

    expect(lives(one)).toBe("retired")
  })

  test("archived beats forked too", () => {
    const one = row({
      repo: "a",
      isArchived: true,
      forkedFrom: Option.some("torvalds/linux"),
      pushedAt: Option.some(daysAgo(400))
    })

    expect(lives(one)).toBe("retired")
  })

  test("a fork sitting still is a fork", () => {
    const one = row({ repo: "a", forkedFrom: Option.some("o/r"), pushedAt: Option.some(daysAgo(90)) })

    expect(lives(one)).toBe("forked")
  })

  test("a fork being worked in is work", () => {
    // The case the obvious rule gets wrong. Forks are mostly noise on these pages,
    // and the fork pushed to yesterday is the row the reader came for.
    const one = row({ repo: "a", forkedFrom: Option.some("o/r"), pushedAt: Option.some(daysAgo(3)) })

    expect(lives(one)).toBe("moving")
  })

  test("nothing pushed yet is quiet", () => {
    expect(lives(row({ repo: "a", pushedAt: Option.none() }))).toBe("quiet")
  })

  test("a date that is not one is quiet rather than moving", () => {
    // A row whose date could not be read must not be promoted into the group a
    // reader trusts most.
    expect(lives(row({ repo: "a", pushedAt: Option.some("last tuesday") }))).toBe("quiet")
  })
})

describe("a list as its groups", () => {
  const list = [
    row({ repo: "quiet-one", pushedAt: Option.some(daysAgo(200)) }),
    row({ repo: "moving-old", pushedAt: Option.some(daysAgo(20)) }),
    row({ repo: "retired-one", isArchived: true }),
    row({ repo: "moving-new", pushedAt: Option.some(daysAgo(1)) }),
    row({ repo: "fork-one", forkedFrom: Option.some("o/r"), pushedAt: Option.some(daysAgo(300)) })
  ]

  test("what is happening, then what is here, then what is over, then what is not theirs", () => {
    expect(grouped(list, now).map((group) => group.life)).toEqual([
      "moving",
      "quiet",
      "retired",
      "forked"
    ])
  })

  test("newest push first inside a group", () => {
    const moving = grouped(list, now)[0]

    expect(moving?.rows.map((one) => one.repo)).toEqual(["moving-new", "moving-old"])
  })

  test("draws no heading over nothing", () => {
    const only = [row({ repo: "a", pushedAt: Option.some(daysAgo(2)) })]

    expect(grouped(only, now).map((group) => group.life)).toEqual(["moving"])
  })

  test("keeps every row it was given", () => {
    const kept = grouped(list, now).flatMap((group) => group.rows)

    expect(kept.length).toBe(list.length)
  })

  test("a row with no date sorts after every row that has one", () => {
    const some = [
      row({ repo: "no-date", pushedAt: Option.none() }),
      row({ repo: "dated", pushedAt: Option.some(daysAgo(400)) })
    ]
    const quiet = grouped(some, now)[0]

    expect(quiet?.rows.map((one) => one.repo)).toEqual(["dated", "no-date"])
  })

  test("nothing at all is no groups", () => {
    expect(grouped([], now)).toEqual([])
  })
})

describe("the languages of a list", () => {
  const spoken = (name: string, colour = "#000") =>
    Option.some({ name, colour })

  const list = [
    row({ repo: "a", language: spoken("TypeScript", "#3178c6") }),
    row({ repo: "b", language: spoken("TypeScript", "#3178c6") }),
    row({ repo: "c", language: spoken("Rust", "#dea584") }),
    row({ repo: "d", language: Option.none() })
  ]

  test("largest first, with its part of the whole", () => {
    const bands = shares(list)

    expect(bands.map((band) => band.name)).toEqual(["TypeScript", "Rust"])
    expect(bands[0]?.count).toBe(2)
    expect(bands[0]?.part).toBeCloseTo(2 / 3)
  })

  test("keeps the colour the row carried", () => {
    expect(shares(list)[0]?.colour).toBe("#3178c6")
  })

  test("leaves rows with no language out rather than drawing absence", () => {
    expect(shares(list).reduce((sum, band) => sum + band.count, 0)).toBe(3)
  })

  test("a list with no languages at all draws nothing", () => {
    expect(shares([row({ repo: "a" })])).toEqual([])
  })
})

describe("finding a row", () => {
  const list = [
    row({ repo: "chrono", description: Option.some("Parses dates and times") }),
    row({ repo: "octo-cli", topics: ["cli", "github"] }),
    row({ repo: "swift-thing", language: Option.some({ name: "Swift", colour: "#f05138" }) })
  ]

  const found = (typed: string) => matching(list, typed).map((one) => one.repo)

  test("by name", () => {
    expect(found("chrono")).toEqual(["chrono"])
  })

  test("by what it does, which their own box cannot do", () => {
    // Somebody who saved a library eight months ago remembers that it parsed dates,
    // not that it was called `chrono`.
    expect(found("dates")).toEqual(["chrono"])
  })

  test("by topic", () => {
    expect(found("cli")).toEqual(["octo-cli"])
  })

  test("by language", () => {
    expect(found("swift")).toEqual(["swift-thing"])
  })

  test("every word, in any order", () => {
    expect(found("github octo")).toEqual(["octo-cli"])
    expect(found("github chrono")).toEqual([])
  })

  test("whatever the case", () => {
    expect(found("CHRONO")).toEqual(["chrono"])
  })

  test("nothing typed is everything there is", () => {
    expect(matching(list, "   ").length).toBe(list.length)
  })
})
