import { describe, expect, test } from "bun:test"
import { WANTED } from "../src/app/screens"
import { VIEWS } from "./views"

/**
 * Views that are a second layout of a screen already covered, rather than a screen of their own.
 *
 * One entry so far. An organisation's discussions and a repository's are one screen — the same
 * parser, the same components, the same rule — drawn into two page layouts GitHub keeps apart,
 * and the second is where GitHub runs its own product feedback. A picture of one is not a picture
 * of the other, so both are on the stage.
 *
 * Named here rather than allowed by loosening the test. A view that belongs to no screen at all
 * is a picture of something nobody can reach, and that is still worth failing over.
 */
const LAYOUTS: ReadonlyArray<string> = ["org-discussions"]

describe("the performance stage", () => {
  const names = VIEWS.map((view) => view.name)

  test("photographs every screen this extension has", () => {
    expect([...WANTED].filter((wanted) => !names.includes(wanted))).toEqual([])
  })

  test("photographs nothing that is not a screen, beyond the layouts named here", () => {
    expect(names.filter((name) => !([...WANTED] as ReadonlyArray<string>).includes(name))).toEqual([
      ...LAYOUTS
    ])
  })
})
