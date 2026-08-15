import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { Happening } from "./activity"
import { answering, WINDOW } from "./answering"

const now = new Date("2026-08-15T00:00:00Z")

const daysAgo = (days: number): string =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

const act = (
  kind: Happening["kind"],
  where: string,
  days: number
): Happening => {
  const [owner = "", repo = ""] = where.split("/")

  return {
    kind,
    at: daysAgo(days),
    by: [{ login: "alex", faceUrl: Option.none() }],
    repo: { owner, repo },
    ref: Option.none(),
    howMany: Option.none(),
    howOften: 1,
    number: Option.none(),
    title: Option.none(),
    url: `https://github.com/${where}`
  }
}

describe("whether somebody answers anybody", () => {
  test("counts the three acts that are somebody answering, and nothing else", () => {
    const said = answering(
      [
        act("reviewed", "facebook/react", 2),
        act("commented", "facebook/react", 3),
        act("opened", "vercel/next.js", 4),
        // Their own work, and a star, which say nothing about answering anybody.
        act("reviewed", "alex/gitquiet", 1),
        act("pushed", "facebook/react", 1),
        act("starred", "facebook/react", 1)
      ],
      "alex",
      now
    )

    expect(said.reviews).toBe(1)
    expect(said.replies).toBe(1)
    expect(said.pulls).toBe(1)
  })

  test("counts the repositories those acts were in, not the acts", () => {
    const said = answering(
      [
        act("reviewed", "facebook/react", 2),
        act("commented", "facebook/react", 3),
        act("reviewed", "vercel/next.js", 4)
      ],
      "alex",
      now
    )

    expect(said.places).toBe(2)
  })

  test("says when the last of them was", () => {
    const said = answering(
      [act("reviewed", "facebook/react", 9), act("commented", "vercel/next.js", 2)],
      "alex",
      now
    )

    expect(Option.getOrNull(said.last)).toBe(daysAgo(2))
  })

  /*
   * The whole reason a window exists: a reader is asking what this person is like now,
   * and a review left in 2023 answers a different question. Ninety days is the window
   * GitHub's own events cover, so it is also all there is to count.
   */
  test("leaves out what happened before the window", () => {
    const said = answering([act("reviewed", "facebook/react", WINDOW + 1)], "alex", now)

    expect(said.reviews).toBe(0)
    expect(Option.isNone(said.last)).toBe(true)
  })

  test("reads a login the way GitHub does, which is either case", () => {
    const said = answering([act("reviewed", "Alex/gitquiet", 1)], "alex", now)

    expect(said.reviews).toBe(0)
  })

  test("is empty rather than absent where somebody answered nobody", () => {
    const said = answering([], "alex", now)

    expect(said).toEqual({
      reviews: 0,
      replies: 0,
      pulls: 0,
      places: 0,
      last: Option.none(),
      days: WINDOW
    })
  })
})
