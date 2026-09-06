import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
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
  said: [],
  earlierSaid: null,
  files: [
    {
      name: "deploy-notes.md",
      language: "markdown",
      content: "Run migrations before the deploy step",
      rendered: true,
      html: "<h2>Deploying</h2><p>Run migrations before the deploy step</p>",
      raw: "/octocat/aaa111/raw/abc/deploy-notes.md"
    },
    {
      name: "retry.py",
      language: "python",
      content: "def exponential_backoff(attempt):",
      rendered: false,
      html: null,
      raw: "/octocat/aaa111/raw/abc/retry.py"
    }
  ],
  ...over
})

const showing = (
  over: Partial<GistSeen> = {},
  kept: KeptGists = new Map(),
  rest: Partial<Parameters<typeof GistScreen>[0]> = {}
) =>
  render(
    <GistScreen
      gist={gist(over)}
      kept={kept}
      onChange={() => {}}
      onStepAside={() => {}}
      {...rest}
    />
  )

describe("one gist", () => {
  test("draws every file their page carries", () => {
    showing()

    expect(screen.getByText("retry.py")).toBeTruthy()
    expect(screen.getByText(/exponential_backoff/)).toBeTruthy()
  })

  test("keeps what GitHub rendered, rather than flattening it to its text", () => {
    // The text alone is the README with every heading, list and code block folded into
    // one paragraph, which is what this drew first and it looked like a wall of prose.
    showing()

    expect(screen.getByRole("heading", { name: "Deploying" })).toBeTruthy()
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

    // The heading names the owner and the gist, the way the bar of every other screen
    // here names where the reader is.
    expect(screen.getByRole("heading", { name: "octocat / Staging runbook" })).toBeTruthy()
    // Twice: beside the Name that replaced it, and on the file it is the name of.
    expect(screen.getAllByText("deploy-notes.md").length).toBe(2)
    expect(screen.getByText("work")).toBeTruthy()
  })

  test("opens the Label editor in place", () => {
    showing()
    fireEvent.click(screen.getByRole("button", { name: "Label / name…" }))

    expect(screen.getByLabelText(/Labels, separated by commas/)).toBeTruthy()
  })

  test("puts what anybody said beside the files, rather than under all of them", () => {
    // Their own page keeps the conversation under every file, so on a gist of four it is
    // a scroll away from anything. A pull request keeps it beside the code and so does this.
    showing({
      said: [
        {
          id: "4425115",
          author: { login: "hubot", faceUrl: null },
          body: "thanks !",
          html: "<p>thanks !</p>",
          createdAt: "2023-01-05T10:19:52Z"
        }
      ]
    })

    const talk = screen.getByRole("region", { name: "Conversation" })
    expect(within(talk).getByText("thanks !")).toBeTruthy()
    expect(within(talk).queryByText("retry.py")).toBeNull()
  })

  test("says nothing was said, rather than drawing an empty panel", () => {
    showing()

    expect(screen.getByText("nothing said yet")).toBeTruthy()
  })

  test("offers the older comments only where their page held some back", () => {
    showing()
    expect(screen.queryByRole("button", { name: "Load earlier comments" })).toBeNull()

    cleanup()
    showing({ earlierSaid: "/octocat/aaa111/load_comments?before_comment_id=1" }, new Map(), {
      onEarlier: () => {}
    })

    expect(screen.getByRole("button", { name: "Load earlier comments" })).toBeTruthy()
  })

  test("offers no box to write in where GitHub drew none", () => {
    // A reader who is not signed in, or an owner who turned comments off.
    showing()

    expect(screen.queryByRole("button", { name: /Say something/ })).toBeNull()
  })

  test("says what the date on their head actually is", () => {
    // Their head prints "Created" over it. A bare date beside four counts reads as the
    // day something last happened, which on a gist edited this morning is a year out.
    showing()

    expect(screen.getByText(/^Created /)).toBeTruthy()
  })

  test("prints no count their page did not have", () => {
    // Their head omits a zero and so does this.
    showing({ forks: 0, stars: 0, comments: 0, revisions: 0 })

    expect(screen.queryByText(/forks/)).toBeNull()
    expect(screen.queryByText(/stars/)).toBeNull()
  })
})
