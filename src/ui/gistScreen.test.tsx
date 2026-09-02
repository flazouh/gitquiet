import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "bun:test"
import type { GistSeen } from "../domain/gist"
import type { KeptGists } from "../domain/gistLabels"
import { GistScreen } from "./GistScreen"

afterEach(cleanup)

const gist = (over: Partial<GistSeen> = {}): GistSeen => ({
  owner: "octocat",
  id: "aaa111",
  title: "deploy-notes.md",
  description: "Notes on rolling out staging",
  secret: false,
  updatedAt: "2026-08-27T00:09:42+02:00",
  revisions: 4,
  forks: 6,
  stars: 4,
  comments: 2,
  files: [
    {
      name: "deploy-notes.md",
      language: "markdown",
      content: "Run migrations before the deploy step",
      rendered: true,
      raw: "/octocat/aaa111/raw/abc/deploy-notes.md"
    },
    {
      name: "retry.py",
      language: "python",
      content: "def exponential_backoff(attempt):",
      rendered: false,
      raw: "/octocat/aaa111/raw/abc/retry.py"
    }
  ],
  ...over
})

const showing = (over: Partial<GistSeen> = {}, kept: KeptGists = new Map()) =>
  render(
    <GistScreen gist={gist(over)} kept={kept} onChange={() => {}} onStepAside={() => {}} />
  )

describe("one gist", () => {
  test("draws every file their page carries", () => {
    showing()

    expect(screen.getByText("retry.py")).toBeTruthy()
    expect(screen.getByText(/exponential_backoff/)).toBeTruthy()
  })

  test("draws prose as prose and code as code", () => {
    // A markdown file in a monospace column with its heading markers showing is the
    // thing `rendered` exists to prevent.
    showing()

    expect(screen.getByText(/Run migrations/).tagName).toBe("P")
    expect(screen.getByText(/exponential_backoff/).tagName).toBe("PRE")
  })

  test("keeps every control their page has, as links to their own pages", () => {
    // Editing, deleting and starring are writes with no route this extension has any
    // business inventing a second way to make.
    showing()

    for (const words of ["Edit", "Revisions", "Download ZIP"]) {
      expect(screen.getByRole("link", { name: words })).toBeTruthy()
    }
    // One per file, which is where their page puts it too.
    expect(screen.getAllByRole("link", { name: "Raw" }).length).toBe(2)
  })

  test("says what Secret means, on the gist that carries it", () => {
    // Recorded across Reddit 2019, Hacker News 2022 and 2025: people acting on the
    // belief that a secret gist is access-controlled. It is not.
    showing({ secret: true })

    expect(screen.getByText(/it is not private/)).toBeTruthy()
  })

  test("says nothing about Secret on a gist that is not", () => {
    showing({ secret: false })

    expect(screen.queryByText(/it is not private/)).toBeNull()
  })

  test("shows a Name over the filename, keeping the filename beside it", () => {
    showing({}, new Map([["aaa111", { labels: ["work"], name: "Staging runbook" }]]))

    expect(screen.getByRole("heading", { name: "Staging runbook" })).toBeTruthy()
    expect(screen.getByText("work")).toBeTruthy()
  })

  test("opens the Label editor in place", () => {
    showing()
    fireEvent.click(screen.getByRole("button", { name: "Label / name…" }))

    expect(screen.getByLabelText(/Labels, separated by commas/)).toBeTruthy()
  })

  test("prints no count their page did not have", () => {
    // Their head omits a zero and so does this.
    showing({ forks: 0, stars: 0, comments: 0, revisions: 0 })

    expect(screen.queryByText(/forks/)).toBeNull()
    expect(screen.queryByText(/stars/)).toBeNull()
  })
})
