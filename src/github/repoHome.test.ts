import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import touches from "../../fixtures/github/repo-home-touches.json"
import payload from "../../fixtures/github/repo-home.json"
import type { Front, Starring } from "../domain/repoHome"
import type { KeptFront } from "./repoHome"
import {
  decodeRepoHome,
  decodeTreeCommitInfo,
  frontFrom,
  frontFromKept,
  keptFrom,
  touchesFrom
} from "./repoHome"

const repo = { owner: "flazouh", repo: "githubpro" }

const read = (given: unknown = payload) =>
  frontFrom(repo, Effect.runSync(decodeRepoHome(given)))

/** The same payload with the one field that decides the order turned over. */
const asCaller = () => {
  const copy = structuredClone(payload) as typeof payload & {
    payload: { codeViewLayoutRoute: { repo: { currentUserCanPush: boolean } } }
  }
  copy.payload.codeViewLayoutRoute.repo.currentUserCanPush = false
  return copy
}

describe("a repository's front page, read off their own payload", () => {
  test("reads the branch and the commit the tree was read at", () => {
    const front = read()
    expect(front.branch).toBe(payload.payload.codeViewRepoRoute.refInfo.name)
    expect(front.head).toBe(payload.payload.codeViewRepoRoute.refInfo.currentOid)
  })

  test("reads every entry of the root, folders first", () => {
    const front = read()
    expect(front.entries).toHaveLength(payload.payload.codeViewRepoRoute.tree.items.length)

    const kinds = front.entries.map((one) => one.kind)
    expect(kinds.lastIndexOf("directory")).toBeLessThan(kinds.indexOf("file"))
  })

  test("carries the README already rendered, so the page costs no second request", () => {
    const welcome = Option.getOrNull(read().welcome)
    expect(welcome?.html.length).toBeGreaterThan(0)
    expect(welcome?.timedOut).toBe(false)
  })

  test("says a reader who can push is a keeper", () => {
    expect(read().footing).toBe("keeper")
  })

  test("says a reader who cannot push is a caller", () => {
    expect(read(asCaller()).footing).toBe("caller")
  })

  /*
   * The case that decides the whole design, and the one a JSON answer always
   * produces: `codeViewLayoutRoute` is absent from every route response and
   * present only in a loaded document.
   */
  test("says caller where the payload never named the reader at all", () => {
    const without = structuredClone(payload) as { payload: Record<string, unknown> }
    delete without.payload.codeViewLayoutRoute
    expect(read(without).footing).toBe("caller")
  })

  test("leaves every row's commit column empty, because that is a second read", () => {
    expect(read().entries.every((one) => Option.isNone(one.touched))).toBe(true)
  })

  /*
   * Measured on a live repository, where the field reads `"2,488"`. Their own
   * page prints this string straight into the Commits button, so it arrives
   * grouped for a reader rather than as a number — and `Number("2,488")` is
   * `NaN`, which showed as no count at all beside a branch with two thousand of
   * them.
   */
  test("reads a count GitHub already grouped with commas", () => {
    const grouped = structuredClone(payload) as {
      payload: { codeViewRepoRoute: { overview: { commitCount: unknown } } }
    }
    grouped.payload.codeViewRepoRoute.overview.commitCount = "2,488"

    expect(Option.getOrNull(read(grouped).commits)).toBe(2488)
  })

  test("reads the About panel where GitHub sent one", () => {
    const about = read().about
    expect(Option.isSome(about.stars)).toBe(true)
    expect(Array.isArray(about.topics)).toBe(true)
  })
})

describe("the commit column, read off their second route", () => {
  const read = () => touchesFrom(Effect.runSync(decodeTreeCommitInfo(touches)))

  test("answers for every path the tree holds", () => {
    expect(read().size).toBe(Object.keys(touches.entries).length)
  })

  test("takes the words out of the anchor GitHub sends instead of a message", () => {
    const said = [...read().values()].map((one) => one.said)
    expect(said.some((one) => one.length > 0)).toBe(true)
    expect(said.every((one) => !one.includes("<a "))).toBe(true)
  })

  test("keeps the date, which is the half of this column nobody argues about", () => {
    const [first] = read().values()
    expect(Number.isNaN(Date.parse(first?.at ?? ""))).toBe(false)
  })
})

describe("what survives the store", () => {
  /** Through JSON as well, because that is what the store does to it. */
  const roundTrip = (front: Front): Front =>
    frontFromKept(repo, JSON.parse(JSON.stringify(keptFrom(front))) as KeptFront)

  const starred = (starring: Starring): Front => {
    const front = read()
    return { ...front, about: { ...front.about, starring } }
  }

  test("brings the star back, rather than making the reader wait for the live read", () => {
    // A reader who starred this in another tab meets a button that would unstar
    // it, for the moment before the live read lands. That is rare, and the price
    // of blanking it was paid on every load instead.
    expect(roundTrip(starred("starred")).about.starring).toBe("starred")
  })

  test("brings back who may not star, so no button is drawn for them", () => {
    expect(roundTrip(starred("barred")).about.starring).toBe("barred")
  })

  test("holds the README back, which is nearly all of the weight", () => {
    expect(Option.isNone(roundTrip(read()).welcome)).toBe(true)
  })
})
