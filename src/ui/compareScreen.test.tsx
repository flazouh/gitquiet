import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "bun:test"
import type { Changed, Comparing } from "../domain/compare"
import { CompareScreen } from "./CompareScreen"

afterEach(cleanup)

const COMPARING: Comparing = {
  repo: { owner: "flazouh", repo: "gitquiet" },
  base: "main",
  head: "claude/gist-screen"
}

const CHANGED: ReadonlyArray<Changed> = [
  { path: "src/domain/gist.ts", anchor: "#diff-aaa111", added: 82, deleted: 7, kind: "modified" },
  { path: "plans/008.md", anchor: "#diff-bbb222", added: 46, deleted: 0, kind: "added" },
  { path: "src/ui/gistSearch.ts", anchor: "#diff-ccc333", added: 0, deleted: 2, kind: "removed" }
]

const showing = (
  changed: ReadonlyArray<Changed> = CHANGED,
  over: { reading?: boolean; failed?: boolean } = {}
) =>
  render(
    <CompareScreen
      comparing={COMPARING}
      changed={changed}
      reading={over.reading ?? false}
      failed={over.failed ?? false}
      onStepAside={() => {}}
    />
  )

const paths = (): ReadonlyArray<string> =>
  screen
    .getAllByRole("link")
    .map((link) => link.textContent ?? "")
    .filter((text) => text.includes("/"))

describe("two refs compared", () => {
  test("names both ends of the range", () => {
    showing()

    expect(screen.getByRole("heading").textContent).toContain("main")
    expect(screen.getByRole("heading").textContent).toContain("claude/gist-screen")
  })

  test("lists every changed file with both counts", () => {
    showing()

    expect(paths()).toEqual(["src/domain/gist.ts", "plans/008.md", "src/ui/gistSearch.ts"])
    expect(screen.getByText("+82")).toBeTruthy()
    expect(screen.getByText("−7")).toBeTruthy()
  })

  test("filters by path, which their own compare page has never done", () => {
    // Community #165765: "GitHub's `/compare` page does not support filtering by path.
    // That means when there a lot of changes in the other projects it gets very hard to
    // read the comparison."
    showing()
    fireEvent.change(screen.getByLabelText("Filter by path"), { target: { value: "gist" } })

    expect(paths()).toEqual(["src/domain/gist.ts", "src/ui/gistSearch.ts"])
  })

  test("counts what is shown rather than what was read", () => {
    showing()
    fireEvent.change(screen.getByLabelText("Filter by path"), { target: { value: "plans" } })

    // The summary counts the shown files, and their additions, not everything read.
    expect(screen.getByText(/1 of 3 file · \+46 −0/)).toBeTruthy()
  })

  test("`/` puts the caret in the filter", () => {
    // On a page whose whole reason to exist is filtering by path, a reader should not
    // have to reach for the mouse to start.
    showing()
    const box = screen.getByLabelText("Filter by path")

    fireEvent.keyDown(document.body, { key: "/" })

    expect(document.activeElement).toBe(box)
  })

  test("keeps their anchor, so one file's diff is still a press away", () => {
    // This screen lists what changed and does not draw the hunks. The way to read one
    // file is GitHub's diff of it, on the page standing behind this one.
    showing()

    // Scoped to the file rows: the bar above them has links of its own.
    const row = screen.getByTitle("src/domain/gist.ts")
    expect(row.getAttribute("href")).toBe("#diff-aaa111")
  })

  test("says it is reading before their fragment answers", () => {
    showing([], { reading: true })

    expect(screen.getByText(/Reading what changed/)).toBeTruthy()
  })

  test("says so when their fragment could not be read", () => {
    showing([], { failed: true })

    expect(screen.getByText(/could not be read/)).toBeTruthy()
  })

  test("tells nothing changed from nothing matching", () => {
    showing([])
    expect(screen.getByText(/Nothing changed between these two/)).toBeTruthy()

    cleanup()
    showing()
    fireEvent.change(screen.getByLabelText("Filter by path"), { target: { value: "zzz" } })
    expect(screen.getByText(/No path here matches/)).toBeTruthy()
  })
})
