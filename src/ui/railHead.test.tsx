import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RailHead, type Kept } from "./RailHead"

afterEach(cleanup)

const draw = (kept: Kept = "all", onPick: (kept: Kept) => void = () => {}) => {
  render(<RailHead code={5} tests={2} kept={kept} onPick={onPick} />)
  return within(screen.getByRole("group", { name: "Which files are in the rail" }))
}

describe("the head of the rail", () => {
  test("wears the size of the list each way would leave", () => {
    const head = draw()

    expect(head.getByRole("button", { name: "All, 7 files" })).toBeDefined()
    expect(head.getByRole("button", { name: "Code, 5 files" })).toBeDefined()
    expect(head.getByRole("button", { name: "Tests, 2 files" })).toBeDefined()
  })

  test("hands back the way that was pressed", async () => {
    const picked: Array<Kept> = []
    const head = draw("all", (kept) => picked.push(kept))

    await userEvent.click(head.getByRole("button", { name: "Tests, 2 files" }))
    await userEvent.click(head.getByRole("button", { name: "Code, 5 files" }))

    expect(picked).toEqual(["tests", "code"])
  })

  /* Where the reader is, in the fill the rest of this interface uses for it. */
  test("fills the way that is on", () => {
    const head = draw("tests")
    const on = head.getByRole("button", { name: "Tests, 2 files" })

    expect(on.getAttribute("aria-pressed")).toBe("true")
    expect(on.className).toContain("bg-active")
    expect(head.getByRole("button", { name: "All, 7 files" }).className).not.toContain(
      "bg-active"
    )
  })

  /*
   * A pull request with nothing to split has one way to read it, and a row of
   * three ways that all show the same list costs a row and teaches nothing.
   */
  test("draws nothing where one of the two halves is empty", () => {
    render(<RailHead code={5} tests={0} kept="all" onPick={() => {}} />)
    expect(screen.queryByRole("group")).toBeNull()

    cleanup()

    render(<RailHead code={0} tests={2} kept="all" onPick={() => {}} />)
    expect(screen.queryByRole("group")).toBeNull()
  })
})
