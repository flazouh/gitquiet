import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import { Option } from "effect"
import type { Doer, Happening, RepositoryActivity } from "../domain/activity"
import { Activity } from "./Activity"

afterEach(cleanup)

/** Noon, so that "yesterday" and "3 hours ago" are both a whole number of hours away. */
const NOW = new Date("2026-07-31T12:00:00Z")

const ago = (minutes: number): string =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString()

const doer = (login: string): Doer => ({ login, faceUrl: Option.none() })

const happening = (over: Partial<Happening> = {}): Happening => ({
  kind: "pushed",
  at: ago(4),
  by: [doer("flazouh")],
  repo: { owner: "flazouh", repo: "octo-repo" },
  ref: Option.none(),
  howMany: Option.none(),
  howOften: 1,
  number: Option.none(),
  title: Option.none(),
  url: "https://github.com/flazouh/octo-repo",
  ...over
})

const inRepository = (
  nameWithOwner: string,
  happenings: ReadonlyArray<Happening>
): RepositoryActivity => {
  const [owner = "", repo = ""] = nameWithOwner.split("/")
  return {
    repo: { owner, repo },
    at: happenings[0]?.at ?? ago(0),
    happenings
  }
}

const showing = (
  activity: ReadonlyArray<RepositoryActivity>,
  over: { readonly waiting?: boolean } = {}
) => render(<Activity activity={activity} now={NOW} {...over} />)

/** Every repository with a section, in the order the page put them in. */
const sections = () => screen.getAllByRole("heading").map((one) => one.textContent)

/**
 * One line as it is said out loud, which is everything in it that is not decoration.
 *
 * A line begins with a face, and where GitHub gave no picture that face is the person's
 * initial — marked as decoration, since the login is in the words beside it. Dropped here
 * for exactly the reason a screen reader drops it, leaving the sentence the line is.
 */
const spoken = (one: Element): string => {
  const said = one.cloneNode(true) as Element
  for (const decoration of Array.from(said.querySelectorAll("[aria-hidden='true']"))) {
    decoration.remove()
  }
  return (said.textContent ?? "").replace(/\s+/g, " ").trim()
}

/** Every line in one repository's section, in the order they are on the page. */
const lines = (nameWithOwner: string) =>
  within(screen.getByRole("list", { name: `What happened in ${nameWithOwner}` }))
    .getAllByRole("link")
    .map(spoken)

/**
 * The Destination that gives the reader back the chronological feed.
 *
 * GitHub replaced it with a ranked one, and the replacement was measured rather than
 * grumbled about: their feed answers with follows, merges, trending repositories and
 * recommendations, and with no pushes at all, while the same account's events in the same
 * minute were two thirds pushes. So the tests below are about what happened being on the
 * screen, in the order it happened, and in words somebody would say.
 */
describe("the Activity Destination", () => {
  test("gives each repository a section of its own, the one that stirred last at the top", () => {
    // Handed to it in the wrong order deliberately. Chronology is this page's whole claim,
    // so it is the page's to guarantee rather than the caller's to be trusted with.
    showing([
      inRepository("flazouh/githubpro", [happening({ at: ago(90) })]),
      inRepository("flazouh/octo-repo", [happening({ at: ago(4) })])
    ])

    expect(sections()).toEqual(["flazouh/octo-repo", "flazouh/githubpro"])
  })

  test("takes a press on a repository's name to the repository", () => {
    showing([inRepository("flazouh/octo-repo", [happening()])])

    expect(screen.getByRole("link", { name: "flazouh/octo-repo" }).getAttribute("href")).toBe(
      "/flazouh/octo-repo"
    )
  })

  test("puts the newest thing that happened in a repository at the top of its section", () => {
    showing([
      inRepository("flazouh/octo-repo", [
        happening({ at: ago(200), kind: "starred" }),
        happening({ at: ago(4), ref: Option.some("main") })
      ])
    ])

    expect(lines("flazouh/octo-repo")).toEqual([
      "flazouh pushed to main 4 minutes ago",
      "flazouh starred 3 hours ago"
    ])
  })

  test("says who did what, and takes a press to where it happened", () => {
    showing([
      inRepository("flazouh/octo-repo", [
        happening({
          ref: Option.some("main"),
          url: "https://github.com/flazouh/octo-repo/commits/main"
        })
      ])
    ])

    expect(
      screen
        .getByRole("link", { name: "flazouh pushed to main 4 minutes ago" })
        .getAttribute("href")
    ).toBe("https://github.com/flazouh/octo-repo/commits/main")
  })

  test("says how long ago in words rather than in a timestamp", () => {
    showing([
      inRepository("flazouh/octo-repo", [
        happening({ at: ago(4) }),
        happening({ at: ago(180) }),
        happening({ at: ago(26 * 60) })
      ])
    ])

    const said = screen.getAllByRole("time").map((one) => one.textContent)

    expect(said).toEqual(["4 minutes ago", "3 hours ago", "yesterday"])
  })

  test("keeps the exact moment on the line, since 'yesterday' cannot answer everything", () => {
    // A reader working out when something broke needs the clock time, and going to GitHub
    // for it is the round trip this page exists to save.
    showing([inRepository("flazouh/octo-repo", [happening({ at: ago(4) })])])

    const moment = screen.getByRole("time")

    expect(moment.getAttribute("datetime")).toBe(ago(4))
    expect(moment.getAttribute("title")).toMatch(/2026/)
  })

  test("says which branch a push went to", () => {
    // The functionality #173638 is about. Their new feed shows no push at all, so the
    // branch is the least this can say and still be worth reading.
    showing([inRepository("flazouh/octo-repo", [happening({ ref: Option.some("widen-the-rail") })])])

    expect(lines("flazouh/octo-repo")).toEqual(["flazouh pushed to widen-the-rail 4 minutes ago"])
  })

  test("counts a push's commits only when GitHub said how many", () => {
    // Their public events answer with the ref alone, so most pushes have no count. An
    // invented one would be indistinguishable from a real one and wrong.
    showing([
      inRepository("flazouh/octo-repo", [
        happening({ at: ago(4), ref: Option.some("main"), howMany: Option.some(3) }),
        happening({ at: ago(5), ref: Option.some("main") })
      ])
    ])

    expect(lines("flazouh/octo-repo")).toEqual([
      "flazouh pushed 3 commits to main 4 minutes ago",
      "flazouh pushed to main 5 minutes ago"
    ])
  })

  test("names a pull request by its number and its branch, and invents no title for it", () => {
    // Measured rather than assumed: their pull request events carry a number and a head
    // branch and no title anywhere, so the branch is what stands in for a name.
    showing([
      inRepository("flazouh/octo-repo", [
        happening({
          at: ago(4),
          kind: "opened",
          number: Option.some(4),
          ref: Option.some("widen-the-rail"),
          url: "https://github.com/flazouh/octo-repo/pull/4"
        }),
        happening({ at: ago(5), kind: "merged", number: Option.some(3) })
      ])
    ])

    expect(lines("flazouh/octo-repo")).toEqual([
      "flazouh opened #4 from widen-the-rail 4 minutes ago",
      "flazouh merged #3 5 minutes ago"
    ])
  })

  test("names an issue by its title, which an issue actually has", () => {
    showing([
      inRepository("flazouh/octo-repo", [
        happening({
          at: ago(4),
          kind: "raised",
          number: Option.some(12),
          title: Option.some("The Rail collapses too far")
        }),
        happening({
          at: ago(5),
          kind: "commented",
          number: Option.some(12),
          title: Option.some("The Rail collapses too far")
        })
      ])
    ])

    expect(lines("flazouh/octo-repo")).toEqual([
      "flazouh raised #12 The Rail collapses too far 4 minutes ago",
      "flazouh commented on #12 The Rail collapses too far 5 minutes ago"
    ])
  })

  test("spends one line on a crowd that all did the same thing", () => {
    // Fourteen stars in a row cost one line rather than fourteen, and the first name is
    // kept because a reader who recognises somebody learns more from it than from 14.
    const crowd = ["flazouh", ...Array.from({ length: 13 }, (_, at) => `person${at}`)]

    showing([
      inRepository("flazouh/octo-repo", [
        happening({ kind: "starred", by: crowd.map(doer) })
      ])
    ])

    expect(lines("flazouh/octo-repo")).toEqual(["flazouh and 13 others starred 4 minutes ago"])
  })

  test("names both of them when a crowd is two people, since both fit", () => {
    showing([
      inRepository("flazouh/octo-repo", [
        happening({ kind: "starred", by: [doer("flazouh"), doer("seawatts")] })
      ])
    ])

    expect(lines("flazouh/octo-repo")).toEqual(["flazouh and seawatts starred 4 minutes ago"])
  })

  test("says it is still reading when nothing has arrived yet", () => {
    showing([], { waiting: true })

    expect(screen.getByRole("status").textContent).toContain("Still reading")
    expect(screen.queryByText(/Nothing has happened/)).toBeNull()
  })

  test("says nothing has happened once the read has landed and nothing had", () => {
    // Told apart from the wait deliberately: "nothing here" and "not read yet" look the
    // same on the screen and mean opposite things to somebody deciding whether to wait.
    showing([])

    expect(screen.getByText(/Nothing has happened/)).toBeDefined()
    expect(screen.queryByRole("status")).toBeNull()
  })
})

describe("a run of pushes to one branch", () => {
  test("is one line that says how many times", () => {
    // Twenty-five consecutive lines of one person pushing to one branch is what the live
    // page showed before this rule existed, and it is the feed nobody could read.
    showing([
      inRepository("flazouh/octo-repo", [
        happening({
          kind: "pushed",
          howOften: 6,
          ref: Option.some("widen-the-rail"),
          at: ago(9)
        })
      ])
    ])

    expect(screen.getByText(/pushed 6 times/)).toBeDefined()
    expect(screen.getByText("widen-the-rail")).toBeDefined()
  })

  test("says it plainly when it happened once", () => {
    showing([
      inRepository("flazouh/octo-repo", [
        happening({ kind: "pushed", ref: Option.some("main") })
      ])
    ])

    expect(screen.getByText(/pushed/).textContent).not.toContain("times")
  })
})

describe("a repository with more lines than fit", () => {
  const twelve = Array.from({ length: 12 }, (_, index) =>
    happening({
      kind: "opened",
      number: Option.some(index + 1),
      at: ago(index + 1),
      url: `https://github.com/flazouh/octo-repo/pull/${index + 1}`
    })
  )

  test("shows the newest eight and offers the rest", () => {
    showing([inRepository("flazouh/octo-repo", twelve)])

    expect(screen.getAllByRole("listitem")).toHaveLength(8)
    expect(screen.getByRole("button", { name: /4 more/ })).toBeDefined()
  })

  test("shows the rest when asked", async () => {
    showing([inRepository("flazouh/octo-repo", twelve)])

    screen.getByRole("button", { name: /4 more/ }).click()

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(12))
    expect(screen.queryByRole("button", { name: /more/ })).toBeNull()
  })

  test("leaves a short repository alone", () => {
    showing([inRepository("flazouh/octo-repo", twelve.slice(0, 3))])

    expect(screen.queryByRole("button", { name: /more/ })).toBeNull()
  })
})
