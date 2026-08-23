import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import { Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { apart, type Held } from "../domain/testing"
import { Counts } from "./Counts"

afterEach(cleanup)

const file = (path: string, added: number, deleted: number): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: added,
  linesDeleted: deleted,
  readByViewer: false,
  diff: Option.some({ isBinary: false, isTruncated: false, lines: [] })
})

const draw = (files: ReadonlyArray<ChangedFile>, kept: Held = "all") => {
  render(
    <div data-testid="band">
      <Counts split={apart(files)} kept={kept} />
    </div>
  )
  return screen.getByTestId("band")
}

const BOTH = [file("src/checks.ts", 40, 10), file("src/checks.test.ts", 300, 5)]

describe("how big the change is", () => {
  test("counts the list the rail is drawing, not the pull request behind it", () => {
    const band = within(draw(BOTH, "code"))

    expect(band.getByText(/1 changed/)).toBeDefined()
    expect(band.getByText("+40")).toBeDefined()
    expect(band.getByText("−10")).toBeDefined()
  })

  test("counts the whole pull request where that is what is drawn", () => {
    const band = within(draw(BOTH))

    expect(band.getByText(/2 changed/)).toBeDefined()
    expect(band.getByText("+340")).toBeDefined()
  })

  /* The share is about the pull request, so it says the same thing whichever
     half of it the reader is looking at. */
  test("says what share of the added lines are cases, in words as well", () => {
    for (const kept of ["all", "code", "tests"] as const) {
      const band = draw(BOTH, kept)
      expect(band.querySelector('[title="300 of the 340 added lines are tests"]')).not.toBeNull()
      cleanup()
    }
  })

  test("says nothing about a share where the pull request has no tests", () => {
    const band = draw([file("src/checks.ts", 40, 10)])

    expect(band.querySelector("[title]")).toBeNull()
  })

  /*
   * A pull request that only deletes has nothing to draw a share of, and a bar
   * of no length reads as a bar that failed to load.
   */
  test("draws no share where nothing was added", () => {
    const band = draw([file("src/gone.ts", 0, 90), file("src/gone.test.ts", 0, 40)])

    expect(band.querySelector("[title]")).toBeNull()
    expect(within(band).getByText("−130")).toBeDefined()
  })
})
