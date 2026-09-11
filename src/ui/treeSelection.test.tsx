import { afterEach, expect, mock, spyOn, test } from "bun:test"
import { act, cleanup, render } from "@testing-library/react"
import { Option } from "effect"
import { FileTree as TreeModel } from "@pierre/trees"
import { treeChoices } from "../domain/choices"
import { DEFAULTS } from "../domain/Settings"
import type { ChangedFile } from "../domain/PullRequest"
import { FileTreePane } from "./Files"

afterEach(() => {
  cleanup()
  mock.restore()
})

const files: ReadonlyArray<ChangedFile> = ["a.ts", "b.ts", "c.ts"].map((path) => ({
  path,
  digest: path,
  changeType: "modified",
  linesAdded: 1,
  linesDeleted: 0,
  readByViewer: false,
  diff: Option.none()
}))
const choices = treeChoices(DEFAULTS.tree)
const selectedPaths = () => Array.from(
  document.querySelector("file-tree-container")!.shadowRoot!.querySelectorAll('[aria-selected="true"]'),
  (row) => row.getAttribute("data-item-path")
)

test("external selection updates the visible tree without waiting for a frame", async () => {
  const reports: string[] = []
  const onSelect = (path: string) => reports.push(path)
  const pane = (path: string) => <FileTreePane files={files} selected={Option.some(path)} onSelect={onSelect} choices={choices} />
  const view = render(pane("a.ts"))
  expect(selectedPaths()).toEqual(["a.ts"])
  spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 42)
  for (const path of ["b.ts", "c.ts", "a.ts", "a.ts"]) {
    await act(async () => { view.rerender(pane(path)) })
    expect(selectedPaths()).toEqual([path])
  }
  expect(reports).toEqual(["b.ts", "c.ts", "a.ts"])
  await act(async () => { view.rerender(pane("missing.ts")) })
  expect(selectedPaths()).toEqual(["a.ts"])
  expect(reports).toEqual(["b.ts", "c.ts", "a.ts"])
})

test("an empty tree has no selected row", () => {
  const reports: string[] = []
  const view = render(<FileTreePane files={[]} selected={Option.none()} onSelect={(path) => reports.push(path)} choices={choices} />)
  expect(view.getByText("No files changed")).toBeDefined()
  expect(reports).toEqual([])
})

test("a file switch never publishes an empty selection to the tree", async () => {
  const selections: ReadonlyArray<string>[] = []
  const subscribe = TreeModel.prototype.subscribe
  spyOn(TreeModel.prototype, "subscribe").mockImplementation(function (this: TreeModel, listener) {
    return subscribe.call(this, () => {
      selections.push([...this.getSelectedPaths()])
      listener()
    })
  })
  const pane = (path: string) => (
    <FileTreePane files={files} selected={Option.some(path)} onSelect={() => {}} choices={choices} />
  )
  const view = render(pane("a.ts"))
  selections.length = 0
  await act(async () => { view.rerender(pane("b.ts")) })
  expect(selectedPaths()).toEqual(["b.ts"])
  expect(selections.length).toBeGreaterThan(0)
  // One notification for selection and one for scrolling it into view.
  expect(selections.length).toBeLessThanOrEqual(2)
  expect(selections.every((paths) => paths.length === 1 && paths[0] === "b.ts")).toBe(true)
})
