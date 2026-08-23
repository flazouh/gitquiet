import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { apart, type Held } from "../domain/testing"
import { RailHead } from "./RailHead"

afterEach(cleanup)

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 4,
  linesDeleted: 1,
  readByViewer: false,
  diff: Option.some({ isBinary: false, isTruncated: false, lines: [] })
})

const FIVE = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"].map((one) => file(`src/${one}`))
const TWO = ["a.test.ts", "b.test.ts"].map((one) => file(`src/${one}`))

const draw = (
  files: ReadonlyArray<ChangedFile>,
  kept: Held = "all",
  onPick: (kept: Held) => void = () => {}
) => {
  render(<RailHead split={apart(files)} kept={kept} onPick={onPick} />)
  return within(screen.getByRole("group", { name: "Which files are in the rail" }))
}

describe("the head of the rail", () => {
  test("wears the size of the list each way would leave", () => {
    const head = draw([...FIVE, ...TWO])

    expect(head.getByRole("button", { name: "All, 7 files" })).toBeDefined()
    expect(head.getByRole("button", { name: "Code, 5 files" })).toBeDefined()
    expect(head.getByRole("button", { name: "Tests, 2 files" })).toBeDefined()
  })

  test("hands back the way that was pressed", async () => {
    const picked: Array<Held> = []
    const head = draw([...FIVE, ...TWO], "all", (kept) => picked.push(kept))

    await userEvent.click(head.getByRole("button", { name: "Tests, 2 files" }))
    await userEvent.click(head.getByRole("button", { name: "Code, 5 files" }))

    expect(picked).toEqual(["tests", "code"])
  })

  test("says which way is on", () => {
    const head = draw([...FIVE, ...TWO], "tests")

    expect(
      head.getByRole("button", { name: "Tests, 2 files" }).getAttribute("aria-pressed")
    ).toBe("true")
    expect(head.getByRole("button", { name: "All, 7 files" }).getAttribute("aria-pressed")).toBe(
      "false"
    )
  })

  /*
   * A pull request with nothing to split has one way to read it, and a row of
   * three ways that all draw the same list costs a row and teaches nothing.
   */
  test("draws nothing where one of the two halves is empty", () => {
    render(<RailHead split={apart(FIVE)} kept="all" onPick={() => {}} />)
    expect(screen.queryByRole("group")).toBeNull()

    cleanup()

    render(<RailHead split={apart(TWO)} kept="all" onPick={() => {}} />)
    expect(screen.queryByRole("group")).toBeNull()
  })
})
