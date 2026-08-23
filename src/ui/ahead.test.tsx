import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../domain/choices"
import { DEFAULTS } from "../domain/Settings"
import { FileBrowser } from "./FileBrowser"

afterEach(cleanup)

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 2,
  linesDeleted: 1,
  readByViewer: false,
  diff: Option.some({ isBinary: false, isTruncated: false, lines: [] })
})

const browsing = (...paths: ReadonlyArray<string>) =>
  render(
    <FileBrowser
      files={paths.map(file)}
      fetchDiffs={() => Effect.succeed([])}
      diff={diffChoices(DEFAULTS.diff)}
      tree={treeChoices(DEFAULTS.tree)}
      keys="standard"
    />
  )

/** The drawing of one file, whether or not it is the one being looked at. */
const drawingOf = (path: string): HTMLElement | null =>
  document.querySelector(`[data-file="${path}"]`)

const shown = (path: string): boolean => drawingOf(path)?.getAttribute("aria-hidden") === "false"

const open = () => screen.getByLabelText("Open file").textContent

describe("the file after the one being read", () => {
  test("is drawn before anyone asks for it", async () => {
    // Opening a file costs a parse, a highlight and a few thousand elements —
    // a third of a second on a real pull request, spent inside the keypress
    // that asked for it. Spent while the reader is reading instead, the same
    // work is free.
    browsing("src/one.ts", "src/two.ts")

    await waitFor(() => expect(drawingOf("src/two.ts")).not.toBeNull())
    expect(shown("src/two.ts")).toBe(false)
    expect(drawingOf("src/two.ts")?.style.contentVisibility).toBe("hidden")
    expect(drawingOf("src/two.ts")?.hidden).toBe(true)
    expect(shown("src/one.ts")).toBe(true)
  })

  test("is that same drawing when it is asked for, not a second one", async () => {
    browsing("src/one.ts", "src/two.ts")
    await waitFor(() => expect(drawingOf("src/two.ts")).not.toBeNull())
    const already = drawingOf("src/two.ts")

    await userEvent.keyboard("j")

    expect(drawingOf("src/two.ts")).toBe(already)
    expect(shown("src/two.ts")).toBe(true)
    expect(drawingOf("src/two.ts")?.style.contentVisibility).toBe("")
    expect(drawingOf("src/two.ts")?.hidden).toBe(false)
    expect(open()).toContain("two.ts")
  })

  test("leaves the file behind it drawn, since going back is half of a review", async () => {
    browsing("src/one.ts", "src/two.ts")
    await waitFor(() => expect(drawingOf("src/two.ts")).not.toBeNull())
    const first = drawingOf("src/one.ts")

    await userEvent.keyboard("j")

    expect(drawingOf("src/one.ts")).toBe(first)
    expect(shown("src/one.ts")).toBe(false)
  })

  test("keeps only what is within reach, so a long review does not fill the tab", async () => {
    // Two hundred files drawn at once is a tab that has to be closed. One
    // either side is what a keypress can reach, and is therefore all that is
    // worth holding.
    browsing("a.ts", "b.ts", "c.ts", "d.ts", "e.ts")

    await userEvent.keyboard("jj")
    await waitFor(() => expect(drawingOf("d.ts")).not.toBeNull())

    expect(document.querySelectorAll("[data-file]")).toHaveLength(3)
    expect(drawingOf("a.ts")).toBeNull()
    expect(shown("c.ts")).toBe(true)
  })
})
