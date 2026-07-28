import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import type { ChangedFile, CommitDetail } from "../domain/PullRequest"
import { CommitScreen } from "./CommitScreen"

afterEach(cleanup)

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 2,
  linesDeleted: 1,
  readByViewer: false,
  diff: Option.some({
    isBinary: false,
    isTruncated: false,
    lines: [
      { kind: "hunk", text: "@@ -1,2 +1,2 @@", beforeLine: Option.none(), afterLine: Option.none() },
      { kind: "added", text: "+ next", beforeLine: Option.none(), afterLine: Option.some(1) }
    ]
  })
})

const commit: CommitDetail = {
  sha: "9f0c4c6f48503a651d4582a767e5f06e83300931",
  abbreviatedSha: "9f0c4c6",
  headline: "Read a merged pull request GitHub requires nothing of",
  bodyHtml: Option.none(),
  author: "flazouh",
  avatarUrl: Option.none(),
  createdAt: "2026-07-28T20:07:00Z",
  files: [file("src/one.ts"), file("src/two.ts")]
}

const reference = { owner: "flazouh", repo: "githubpro", sha: commit.sha }

const screenOf = (props: Partial<React.ComponentProps<typeof CommitScreen>> = {}) => (
  <CommitScreen reference={reference} load={async () => commit} {...props} />
)

describe("a commit on the page GitHub keeps for it", () => {
  test("reads the commit named in the address", async () => {
    let asked = ""
    render(
      screenOf({
        load: async (sha) => {
          asked = sha
          return commit
        }
      })
    )

    await waitFor(() => expect(screen.getByText(commit.headline)).toBeDefined())
    expect(asked).toBe(commit.sha)
  })

  test("opens the first file it changed, as the branch's own browser does", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByLabelText("Open file").textContent).toContain("one.ts"))
  })

  test("moves to the next file on the key that does it everywhere else", async () => {
    render(screenOf())
    await waitFor(() => expect(screen.getByLabelText("Open file")).toBeDefined())

    await userEvent.keyboard("j")

    expect(screen.getByLabelText("Open file").textContent).toContain("two.ts")
  })

  test("goes back for a file the commit page arrived without", async () => {
    // Their page embeds diffs until it has spent a byte budget and sends the
    // rest as names, so on any commit of size most files start out held back.
    const asked: Array<ReadonlyArray<string>> = []
    render(
      screenOf({
        load: async () => ({
          ...commit,
          files: [file("src/one.ts"), { ...file("src/held.ts"), diff: Option.none() }]
        }),
        fetchDiffs: async (paths) => {
          asked.push(paths)
          return [
            {
              path: "src/held.ts",
              diff: {
                isBinary: false,
                isTruncated: false,
                lines: [
                  {
                    kind: "added" as const,
                    text: "+ it came back",
                    beforeLine: Option.none(),
                    afterLine: Option.some(1)
                  }
                ]
              }
            }
          ]
        }
      })
    )

    await waitFor(() => expect(screen.getByLabelText("Open file")).toBeDefined())
    await userEvent.keyboard("j")

    await waitFor(() => expect(asked.flat()).toContain("src/held.ts"))
  })

  test("offers no way back to a branch this page was never part of", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(commit.headline)).toBeDefined())
    expect(screen.queryByText("All changes")).toBeNull()
  })

  test("keeps the way out to GitHub's own page, when there is one to go back to", async () => {
    let handed = 0
    render(screenOf({ onUseGitHub: () => void (handed += 1) }))

    await waitFor(() => expect(screen.getByText("GitHub's page")).toBeDefined())
    await userEvent.click(screen.getByText("GitHub's page"))

    expect(handed).toBe(1)
  })

  test("says nothing about a way out where there is none", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(commit.headline)).toBeDefined())
    expect(screen.queryByText("GitHub's page")).toBeNull()
  })

  test("has the display settings the rest of the interface has", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByLabelText("Display settings")).toBeDefined())
  })
})
