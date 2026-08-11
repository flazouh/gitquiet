import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { Repository } from "../domain/repositories"
import { keepRepositories, keptRepositories } from "./keptRepositories"

/* One `localStorage` is shared by every test file in the run. See `visited.test.ts`. */
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const repository = (nameWithOwner: string, over: Partial<Repository> = {}): Repository => {
  const [owner = "", repo = ""] = nameWithOwner.split("/")
  return {
    owner,
    repo,
    nameWithOwner,
    faceUrl: Option.none(),
    ofAnOrganisation: false,
    isPrivate: false,
    isEmpty: false,
    ...over
  }
}

describe("the repository list as the last read left it", () => {
  test("nothing is kept before anything is read", () => {
    expect(keptRepositories()).toEqual([])
  })

  test("gives back what was kept, so a bar mounting can draw it at once", () => {
    const list = [repository("flazouh/octo-repo"), repository("flowline-labs/flowline")]
    keepRepositories(list)

    expect(keptRepositories()).toEqual(list)
  })

  /*
   * The whole reason this is a copy of what GitHub said rather than a list built
   * out of the names in `visited`. A row says "Private" off this field, and a row
   * built from a name alone would say a private repository is public until the read
   * lands — which is a claim this interface has no business making for a tenth of
   * a second.
   */
  test("keeps what a row would otherwise have to guess at", () => {
    keepRepositories([
      repository("flazouh/octo-repo", {
        isPrivate: true,
        ofAnOrganisation: true,
        isEmpty: true,
        faceUrl: Option.some("https://github.com/flazouh.png?size=32")
      })
    ])

    const [one] = keptRepositories()
    expect(one?.isPrivate).toBe(true)
    expect(one?.ofAnOrganisation).toBe(true)
    expect(one?.isEmpty).toBe(true)
    expect(one?.faceUrl).toEqual(Option.some("https://github.com/flazouh.png?size=32"))
  })

  test("keeps a face that GitHub gave none for as none, rather than as nothing at all", () => {
    keepRepositories([repository("flazouh/octo-repo")])

    expect(keptRepositories()[0]?.faceUrl).toEqual(Option.none())
  })

  /*
   * The fault this file caused on the day it was written, and the reason an empty
   * list is not an answer.
   *
   * Every screen that offers a switcher reads the store, and the store answers with
   * nothing whenever the cached list has not been fetched yet or has gone cold. Kept
   * as nothing, that one read threw away a hundred and fifty-seven repositories read
   * ten minutes earlier, and no screen fills this again until the reader opens Home.
   * So the chevron went, and stayed gone.
   *
   * A reader who signs out keeps a switcher they cannot use until they open Home,
   * which is worth less than a control that disappears for good.
   */
  test("an answer of nothing leaves what was kept where it was", () => {
    keepRepositories([repository("flazouh/octo-repo")])
    keepRepositories([])

    expect(keptRepositories().map((one) => one.nameWithOwner)).toEqual(["flazouh/octo-repo"])
  })

  test("the newest read replaces the last, a list being the whole answer", () => {
    keepRepositories([repository("flazouh/octo-repo"), repository("flazouh/gone")])
    keepRepositories([repository("flazouh/octo-repo")])

    expect(keptRepositories().map((one) => one.nameWithOwner)).toEqual(["flazouh/octo-repo"])
  })

  test("keeps nothing when the page has no storage to read", () => {
    // A private window, storage switched off, quota spent. All three mean the chevron
    // waits for the read, which is what it did before this file existed.
    const had = globalThis.localStorage
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("nope")
      }
    })

    expect(keptRepositories()).toEqual([])
    expect(() => keepRepositories([repository("flazouh/octo-repo")])).not.toThrow()

    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: had })
  })

  test("keeps nothing when what was kept is not a list of repositories", () => {
    localStorage.setItem("gitquiet.kept.repositories", "{oh no")

    expect(keptRepositories()).toEqual([])
  })

  test("drops a row that is missing the one name that is an address", () => {
    localStorage.setItem(
      "gitquiet.kept.repositories",
      JSON.stringify([{ owner: "flazouh" }, { owner: "flazouh", repo: "octo-repo", name: "flazouh/octo-repo" }])
    )

    expect(keptRepositories().map((one) => one.nameWithOwner)).toEqual(["flazouh/octo-repo"])
  })
})
