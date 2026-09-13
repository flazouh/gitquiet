import { afterEach, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../domain/choices"
import { DEFAULTS } from "../domain/Settings"
import { FileBrowser, type FileBrowserProps } from "./FileBrowser"

afterEach(cleanup)
const file = (path: string): ChangedFile => ({
  path, digest: path, changeType: "modified", linesAdded: 1, linesDeleted: 0,
  readByViewer: false, diff: Option.some({ isBinary: false, isTruncated: false, lines: [] })
})
const files = [file("a.ts"), file("b.ts"), file("c.ts")]
const fetchDiffs = () => Effect.succeed([])
const diff = diffChoices(DEFAULTS.diff)
const tree = treeChoices(DEFAULTS.tree)
const card = (current: readonly ChangedFile[], wanted?: FileBrowserProps["wanted"]) =>
  <FileBrowser files={current} wanted={wanted} fetchDiffs={fetchDiffs} diff={diff} tree={tree} />
const opened = () => screen.getByLabelText("Open file").textContent

test("a file refresh preserves the reader's selection after a linked file opened", async () => {
  const request = { path: "a.ts" }
  const view = render(card(files, request))
  await userEvent.click(screen.getByRole("button", { name: "Next file" }))
  expect(opened()).toContain("b.ts")
  view.rerender(card(files.map(one => ({ ...one, linesAdded: 2 })), request))
  expect(opened()).toContain("b.ts")
  await userEvent.click(screen.getByRole("button", { name: "Next file" }))
  expect(opened()).toContain("c.ts")
})

test("a new request can open the same linked file again", async () => {
  const view = render(card(files, { path: "a.ts" }))
  await userEvent.click(screen.getByRole("button", { name: "Next file" }))
  expect(opened()).toContain("b.ts")
  view.rerender(card(files, { path: "a.ts" }))
  expect(opened()).toContain("a.ts")
})

test("a missing requested file opens when it arrives without repeated resets", async () => {
  const request = { path: "b.ts" }
  const view = render(card([], request))
  view.rerender(card([files[0]!], request))
  expect(opened()).toContain("a.ts")
  view.rerender(card(files, request))
  expect(opened()).toContain("b.ts")
  await userEvent.click(screen.getByRole("button", { name: "Next file" }))
  expect(opened()).toContain("c.ts")
  view.rerender(card([...files], request))
  expect(opened()).toContain("c.ts")
})

test("a newer request supersedes a missing file request", () => {
  const view = render(card([files[0]!], { path: "b.ts" }))
  view.rerender(card(files, { path: "c.ts" }))
  expect(opened()).toContain("c.ts")
})

test("clearing a request lets its original object be requested again", async () => {
  const request = { path: "a.ts" }
  const view = render(card(files, request))
  view.rerender(card(files))
  await userEvent.click(screen.getByRole("button", { name: "Next file" }))
  view.rerender(card(files, request))
  expect(opened()).toContain("a.ts")
})
