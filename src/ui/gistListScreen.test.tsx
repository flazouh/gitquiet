import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "bun:test"
import type { GistRow } from "../domain/gistList"
import type { KeptGists } from "../domain/gistLabels"
import { GistListScreen } from "./GistListScreen"

afterEach(cleanup)

const row = (over: Partial<GistRow> = {}): GistRow => ({
  id: "aaa111",
  owner: "octocat",
  title: "deploy-notes.md",
  description: "Notes on rolling out staging",
  preview: "Run migrations before the deploy step",
  secret: false,
  updatedAt: "2026-08-27T00:09:42+02:00",
  files: 1,
  forks: 0,
  comments: 0,
  stars: 0,
  ...over
})

const ROWS = [
  row(),
  row({ id: "bbb222", title: "retry.py", description: null, preview: "exponential backoff", secret: true, stars: 9, updatedAt: "2026-07-01T10:00:00Z" }),
  row({ id: "ccc333", title: "config.json", description: "widget config", preview: "theme dark", forks: 4, updatedAt: "2026-06-15T08:30:00Z" })
]

const showing = (
  kept: KeptGists = new Map(),
  rows = ROWS,
  whole = true,
  whose: "own" | "starred" = "own"
) =>
  render(
    <GistListScreen
      rows={rows}
      whose={whose}
      whole={whole}
      kept={kept}
      onChange={() => {}}
      onStepAside={() => {}}
    />
  )

const titles = (): ReadonlyArray<string> =>
  screen.getAllByRole("link").map((link) => link.textContent ?? "").filter((text) => text.endsWith(".md") || text.endsWith(".py") || text.endsWith(".json"))

describe("a reader's own gists", () => {
  test("draws every gist their page carries", () => {
    showing()

    expect(titles()).toEqual(["deploy-notes.md", "retry.py", "config.json"])
  })

  test("searches the file content GitHub's own search does not read", () => {
    // The whole point of slice 2: a reader who remembers what a gist said, not what it
    // was called. "backoff" appears in one preview and in no title or description.
    showing()
    fireEvent.change(screen.getByLabelText("Search your gists"), {
      target: { value: "backoff" }
    })

    expect(titles()).toEqual(["retry.py"])
  })

  test("their Type filter keeps only the one kind", () => {
    showing()
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "secret" } })

    expect(titles()).toEqual(["retry.py"])
  })

  test("orders by things their own page never offered", () => {
    showing()
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "stars" } })

    expect(titles()[0]).toBe("retry.py")
  })

  test("`/` puts the caret in the search box, which GitHub took away in 2024", () => {
    // GitHub Community #131464: "this change was in fact intentional... it wasn't being
    // used very much", against #140427: "it's such a pain compared to how simple it was
    // before".
    showing()
    const box = screen.getByLabelText("Search your gists")
    expect(document.activeElement).not.toBe(box)

    fireEvent.keyDown(document.body, { key: "/" })

    expect(document.activeElement).toBe(box)
  })

  test("leaves a `/` alone when the reader is already typing", () => {
    // A `/` meant for a filename is a `/`. Stealing it is worse than no shortcut.
    showing()
    const box = screen.getByLabelText("Search your gists")
    const elsewhere = document.createElement("input")
    document.body.append(elsewhere)
    elsewhere.focus()

    fireEvent.keyDown(elsewhere, { key: "/" })

    expect(document.activeElement).toBe(elsewhere)
    expect(document.activeElement).not.toBe(box)
    elsewhere.remove()
  })

  test("filters to a Label, which is the folder GitHub never built", () => {
    const kept: KeptGists = new Map([
      ["aaa111", { labels: ["work"], name: null }],
      ["ccc333", { labels: ["work", "widgets"], name: null }]
    ])
    showing(kept)

    fireEvent.click(screen.getByRole("button", { name: "widgets" }))

    expect(titles()).toEqual(["config.json"])
  })

  test("two Labels narrow rather than widen", () => {
    const kept: KeptGists = new Map([
      ["aaa111", { labels: ["work"], name: null }],
      ["ccc333", { labels: ["work", "widgets"], name: null }]
    ])
    showing(kept)

    fireEvent.click(screen.getByRole("button", { name: "work" }))
    expect(titles().length).toBe(2)

    fireEvent.click(screen.getByRole("button", { name: "widgets" }))
    expect(titles()).toEqual(["config.json"])
  })

  test("draws no Label bar until a reader has written one", () => {
    // A row of nothing is a control that teaches nobody what it is for.
    showing()

    expect(screen.queryByRole("button", { name: "work" })).toBeNull()
  })

  test("shows a Name over the filename, and keeps the filename beside it", () => {
    // A Name that replaced the filename outright would leave a reader unable to match
    // this row against the same gist in GitHub's own list, or in a link somebody sent.
    showing(new Map([["aaa111", { labels: [], name: "Staging runbook" }]]))

    expect(screen.getByText("Staging runbook")).toBeTruthy()
    expect(screen.getByText("deploy-notes.md")).toBeTruthy()
  })

  test("says so when their older pages could not be read", () => {
    // A list quietly missing its oldest gists is a search that quietly says no about a
    // gist the reader is sure they wrote.
    showing(new Map(), ROWS, false)

    expect(screen.getByText(/this list is short/)).toBeTruthy()
  })

  test("says nothing matched rather than drawing an empty page", () => {
    showing()
    fireEvent.change(screen.getByLabelText("Search your gists"), {
      target: { value: "nothing here says this" }
    })

    expect(screen.getByText(/Nothing here matches/)).toBeTruthy()
  })

  test("keeps the file preview their list prints, folded", () => {
    // Parity, folded rather than dropped: "browsing through 20 pages of 3-line excerpts"
    // is the complaint, so printing every excerpt at full height is the thing being
    // complained about — but a reader who found a gist by a word in its content should
    // be able to see the word.
    showing()

    const folds = screen.getAllByText("Preview")
    expect(folds.length).toBe(3)
    expect(folds[0]?.closest("details")?.open).toBe(false)
  })

  test("offers a way to make one, which their header carries", () => {
    showing()

    expect(screen.getByRole("link", { name: "New gist" })).toBeTruthy()
  })

  test("offers a copy of the list, which GitHub's own export does not include", () => {
    // "archive my gists" is itself a genre of published script, because GitHub's account
    // export carries no gist data at all.
    showing()

    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy()
  })

  test("offers no copy of an empty list", () => {
    showing(new Map(), [])

    expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(true)
  })

  test("draws the starred list too, without calling it yours", () => {
    // Somebody else's gists and this reader's Labels. Every control means the same
    // thing on both; the one sentence that would be wrong is "your gists".
    showing(new Map(), ROWS, true, "starred")

    expect(screen.getByLabelText("Search your starred gists")).toBeTruthy()
    expect(screen.getByText("3 starred gists")).toBeTruthy()
  })
})
