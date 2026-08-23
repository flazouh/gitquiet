import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import { Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
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

const code = [file("src/checks.ts", 40, 10)]
const tests = [file("src/checks.test.ts", 300, 5)]

const draw = (onRail: ReadonlyArray<ChangedFile>, which = { code, tests }) => {
  render(
    <div data-testid="band">
      <Counts onRail={onRail} code={which.code} tests={which.tests} />
    </div>
  )
  return screen.getByTestId("band")
}

describe("how big the change is", () => {
  test("counts what the rail is holding, not the pull request behind it", () => {
    const band = within(draw(code))

    expect(band.getByText(/1 changed/)).toBeDefined()
    expect(band.getByText("+40")).toBeDefined()
    expect(band.getByText("−10")).toBeDefined()
  })

  test("says what share of the added lines are cases", () => {
    const band = draw([...code, ...tests])

    expect(band.querySelector('[title="300 of the 340 added lines are tests"]')).not.toBeNull()
  })

  /* Nothing to compare, so nothing to draw: a bar of one colour is a bar that
     says a pull request is entirely itself. */
  test("draws no share where the pull request has no tests", () => {
    const band = draw(code, { code, tests: [] })

    expect(band.querySelector("[title$='added lines are tests']")).toBeNull()
  })

  /*
   * A pull request that only deletes has nothing to draw a share of, and a bar
   * of no length reads as a bar that failed to load.
   */
  test("draws no share where nothing was added", () => {
    const gone = [file("src/gone.ts", 0, 90)]
    const goneTests = [file("src/gone.test.ts", 0, 40)]
    const band = draw([...gone, ...goneTests], { code: gone, tests: goneTests })

    expect(band.querySelector("[title$='added lines are tests']")).toBeNull()
  })
})
