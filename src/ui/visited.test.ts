import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { visited, visiting } from "./visited"

/*
 * Before as well as after, because one `localStorage` is shared by every test
 * file in the run and the first test here asserts an empty one. `theBar.test.tsx`
 * visits repositories too, so whichever file bun happened to run first decided
 * whether "nowhere has been visited" was true, and the suite failed three times
 * in one run and six in the next.
 */
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe("the repositories most recently read", () => {
  test("nowhere has been visited before anywhere has", () => {
    expect(visited()).toEqual([])
  })

  test("the last one read comes first", () => {
    visiting("flazouh/octo-repo")
    visiting("flowline-labs/flowline")

    expect(visited()).toEqual(["flowline-labs/flowline", "flazouh/octo-repo"])
  })

  test("a second visit moves one up rather than listing it twice", () => {
    visiting("flazouh/octo-repo")
    visiting("flowline-labs/flowline")
    visiting("flazouh/octo-repo")

    expect(visited()).toEqual(["flazouh/octo-repo", "flowline-labs/flowline"])
  })

  test("keeps eight, a switcher having no room to say more than that", () => {
    // The band exists to save a reader the scroll. A band of forty is the scroll.
    for (let at = 0; at < 12; at += 1) visiting(`flazouh/one-${at}`)

    const found = visited()
    expect(found).toHaveLength(8)
    expect(found[0]).toBe("flazouh/one-11")
    expect(found).not.toContain("flazouh/one-3")
  })

  test("says nowhere at all when the page has no storage to read", () => {
    // A private window, storage switched off, quota spent. All three are a switcher in
    // GitHub's own order, never a bar that fails to draw.
    const had = globalThis.localStorage
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("nope")
      }
    })

    expect(visited()).toEqual([])
    expect(() => visiting("flazouh/octo-repo")).not.toThrow()

    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: had })
  })

  test("says nowhere when what was kept is not a list of addresses", () => {
    localStorage.setItem("gitquiet.lately", "{oh no")

    expect(visited()).toEqual([])
  })
})
