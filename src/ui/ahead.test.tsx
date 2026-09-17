import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../domain/choices"
import { DEFAULTS } from "../domain/Settings"
import { FileBrowser } from "./FileBrowser"
import { DEFAULT_KEYS } from "../keys/commands"

afterEach(cleanup)

const idled = globalThis.requestIdleCallback
const unidled = globalThis.cancelIdleCallback
const framed = window.requestAnimationFrame

afterEach(() => {
  globalThis.requestIdleCallback = idled
  globalThis.cancelIdleCallback = unidled
  window.requestAnimationFrame = framed
})

const holdIdleTime = () => {
  const waiting = new Map<number, () => void>()
  let asked = 0

  window.requestIdleCallback = ((run: IdleRequestCallback) => {
    asked += 1
    waiting.set(asked, () => run({ didTimeout: false, timeRemaining: () => 0 }))
    return asked
  }) as typeof globalThis.requestIdleCallback
  window.cancelIdleCallback = ((handle: number) => {
    waiting.delete(handle)
  }) as typeof globalThis.cancelIdleCallback

  return {
    pending: () => waiting.size,
    runIdle: () =>
      act(() => {
        const due = [...waiting.values()]
        waiting.clear()
        for (const run of due) run()
      })
  }
}

const diff = { isBinary: false, isTruncated: false, lines: [] }

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 2,
  linesDeleted: 1,
  readByViewer: false,
  diff: Option.some(diff)
})

const browsing = (...paths: ReadonlyArray<string>) =>
  render(
    <FileBrowser
      files={paths.map(file)}
      fetchDiffs={() => Effect.succeed([])}
      diff={diffChoices(DEFAULTS.diff)}
      tree={treeChoices(DEFAULTS.tree)}
      keys={DEFAULT_KEYS}
    />
  )

/** The drawing of one file, whether or not it is the one being looked at. */
const drawingOf = (path: string): HTMLElement | null =>
  document.querySelector(`[data-file="${path}"]`)

const shown = (path: string): boolean => drawingOf(path)?.getAttribute("aria-hidden") === "false"

const open = () => screen.getByLabelText("Open file").textContent

describe("the file after the one being read", () => {
  test("is asked for before anyone opens it, but not drawn", async () => {
    const asked: string[] = []
    const paths = ["src/one.ts", "src/two.ts"]
    const view = render(
      <FileBrowser
        prepareThrough={3}
        files={paths.map(file)}
        fetchDiffs={(wanted) =>
          Effect.sync(() => {
            asked.push(...wanted)
            return wanted.map((path) => ({
              path,
              diff
            }))
          })
        }
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        keys={DEFAULT_KEYS}
      />
    )

    await waitFor(() => expect(asked).toContain("src/two.ts"))
    expect(drawingOf("src/two.ts")).toBeNull()
    expect(shown("src/one.ts")).toBe(true)
    view.unmount()
  })

  test("is drawn when it is asked for, after the press is answered", async () => {
    browsing("src/one.ts", "src/two.ts")
    await userEvent.keyboard("s")

    await waitFor(() => expect(shown("src/two.ts")).toBe(true))
    expect(open()).toContain("two.ts")
  })

  test("leaves the file behind it drawn, since going back is half of a review", async () => {
    browsing("src/one.ts", "src/two.ts")
    const first = drawingOf("src/one.ts")

    await userEvent.keyboard("s")

    expect(drawingOf("src/one.ts")).toBe(first)
    expect(shown("src/one.ts")).toBe(false)
  })

  test("keeps only what has been read, so a long review does not fill the tab", async () => {
    browsing("a.ts", "b.ts", "c.ts", "d.ts", "e.ts")

    await userEvent.keyboard("ss")

    await waitFor(() => expect(shown("c.ts")).toBe(true))
    expect(drawingOf("a.ts")).toBeNull()
    expect(drawingOf("e.ts")).toBeNull()
    expect(document.querySelectorAll("[data-file]")).toHaveLength(3)
  })
})

test("draws a neighbouring file only when it becomes the one being read", async () => {
  const idle = holdIdleTime()
  window.requestAnimationFrame = () => 1
  browsing("src/one.ts", "src/two.ts")

  // The neighbour's patch may be fetched ahead of the reader, but drawing it
  // costs a syntax highlight on the page. That is work a reader has not asked
  // for, and the trace of a real pull request showed it as a 121ms task.
  idle.runIdle()
  expect(drawingOf("src/two.ts")).toBeNull()
  expect(shown("src/one.ts")).toBe(true)
})
