import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { Entry, Kind, Touch } from "../domain/repoHome"
import { fileUnder, shownOf } from "./RepoTree"

const touch = (over: Partial<Touch> = {}): Touch => ({
  at: "2026-07-30T12:00:00Z",
  said: "Say what this is for",
  url: "/o/r/commit/def",
  oid: Option.some("def"),
  who: Option.none(),
  ...over
})

const entry = (name: string, over: Partial<Entry> = {}): Entry => ({
  name,
  path: name,
  kind: "file",
  touched: Option.none(),
  ...over
})

const folder = (name: string, over: Partial<Entry> = {}): Entry =>
  entry(name, { kind: "directory", path: name, ...over })

describe("which rows the tree shows", () => {
  const root: ReadonlyArray<Entry> = [
    folder("src"),
    entry("README.md", { touched: Option.some(touch()) })
  ]

  test("starts with the root, folders first, which is what the page already holds", () => {
    const rows = shownOf({ entries: root, opened: new Set(), hunting: "" })

    expect(rows.map((one) => one.path)).toEqual(["src", "README.md"])
    expect(rows[0]?.kind).toBe("directory")
    expect(rows[0]?.depth).toBe(0)
  })

  test("opens a folder onto the files under it, once the whole tree has landed", () => {
    const rows = shownOf({
      entries: root,
      whole: ["src/ui/RepoTree.tsx", "src/domain/repoHome.ts", "README.md"],
      opened: new Set(["src"]),
      hunting: ""
    })

    expect(rows.map((one) => `${one.depth}:${one.path}`)).toEqual([
      "0:src",
      "1:src/domain",
      "1:src/ui",
      "0:README.md"
    ])
  })

  test("opens a nested folder the same way", () => {
    const rows = shownOf({
      entries: root,
      whole: ["src/ui/RepoTree.tsx", "src/domain/repoHome.ts"],
      opened: new Set(["src", "src/ui"]),
      hunting: ""
    })

    expect(rows.map((one) => one.path)).toEqual([
      "src",
      "src/domain",
      "src/ui",
      "src/ui/RepoTree.tsx",
      "README.md"
    ])
  })

  test("keeps a closed folder shut, even after the whole tree has landed", () => {
    const rows = shownOf({
      entries: root,
      whole: ["src/ui/RepoTree.tsx"],
      opened: new Set(),
      hunting: ""
    })

    expect(rows.map((one) => one.path)).toEqual(["src", "README.md"])
  })

  test("narrows to matching files and the folders that hold them", () => {
    const rows = shownOf({
      entries: root,
      whole: ["src/ui/RepoTree.tsx", "src/domain/repoHome.ts", "README.md"],
      opened: new Set(),
      hunting: "RepoTree"
    })

    expect(rows.map((one) => one.path)).toEqual(["src", "src/ui", "src/ui/RepoTree.tsx"])
    expect(rows.filter((one) => one.kind === "directory").every((one) => one.open)).toBe(true)
  })

  test("carries the last commit on the row it belongs to", () => {
    const [readme] = shownOf({
      entries: [entry("README.md", { touched: Option.some(touch({ said: "Say what this is for" })) })],
      opened: new Set(),
      hunting: ""
    })

    expect(Option.getOrNull(readme?.touched ?? Option.none())?.said).toBe("Say what this is for")
    expect(Option.getOrNull(readme?.touched ?? Option.none())?.url).toBe("/o/r/commit/def")
  })

  test("says nothing for a row the commit column has not reached", () => {
    const [row] = shownOf({ entries: [entry("README.md")], opened: new Set(), hunting: "" })
    expect(Option.isNone(row?.touched ?? Option.none())).toBe(true)
  })

  test("carries the last commit onto a nested row once that folder's column has landed", () => {
    const nested = touch({ said: "The tree draws itself", url: "/o/r/commit/nested" })
    const rows = shownOf({
      entries: root,
      whole: ["src/ui/RepoTree.tsx"],
      opened: new Set(["src"]),
      hunting: "",
      touches: new Map([["src/ui", nested]])
    })
    const ui = rows.find((one) => one.path === "src/ui")

    expect(Option.getOrNull(ui?.touched ?? Option.none())?.said).toBe("The tree draws itself")
    expect(Option.getOrNull(ui?.touched ?? Option.none())?.url).toBe("/o/r/commit/nested")
  })
})

/** A row of the tree, as the pointer's composed path holds it. */
const row = (path: string, kind: Kind): HTMLElement => {
  const element = document.createElement("button")
  element.dataset.path = path
  element.dataset.kind = kind
  return element
}

const over = (...path: ReadonlyArray<HTMLElement>): PointerEvent =>
  ({ composedPath: () => [...path, document.body] }) as unknown as PointerEvent

describe("the row the pointer is on", () => {
  test("names the file, so the press that follows costs nothing", () => {
    expect(fileUnder(over(row("src/main.ts", "file")))).toBe("src/main.ts")
  })

  test("names nothing for a folder, which has no file to read", () => {
    expect(fileUnder(over(row("src", "directory")))).toBe(null)
  })

  test("names nothing over the tree but off every row", () => {
    expect(fileUnder(over())).toBe(null)
  })
})
