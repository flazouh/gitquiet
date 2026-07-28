import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import type { ChangedFile, CommitDetail } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../settings/apply"
import { DEFAULTS } from "../settings/Settings"
import { CommitView } from "./CommitView"

afterEach(cleanup)

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 3,
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
  sha: "97ca0ad5edb4c0d55ab94caee136d6273adf63e8",
  abbreviatedSha: "97ca0ad",
  headline: "fix: restore pi ACP usage plumbing",
  bodyHtml: Option.some("<p>the projection dropped it</p>"),
  author: "flazouh",
  avatarUrl: Option.none(),
  createdAt: "2026-07-25T10:21:12Z",
  files: [file("src/one.ts"), file("src/two.ts")]
}

const view = (
  props: Partial<React.ComponentProps<typeof CommitView>> = {}
): React.ReactElement => (
  <CommitView
    sha={commit.sha}
    load={async () => commit}
    onClose={() => {}}
    diff={diffChoices(DEFAULTS.diff)}
    tree={treeChoices(DEFAULTS.tree)}
    {...props}
  />
)

describe("reading one commit", () => {
  test("says it is reading before the commit arrives", () => {
    render(view({ load: () => new Promise(() => {}) }))

    expect(screen.getAllByText("Reading the commit…").length).toBeGreaterThan(0)
  })

  test("shows the message, the author and the age once it has", async () => {
    render(view())

    await waitFor(() => expect(screen.getByText(commit.headline)).toBeDefined())
    expect(screen.getByLabelText("flazouh")).toBeDefined()
    expect(screen.getByText("97ca0ad")).toBeDefined()
    expect(screen.getByText("the projection dropped it")).toBeDefined()
  })

  test("leads back to the whole branch", async () => {
    let closed = 0
    render(view({ onClose: () => void (closed += 1) }))

    await userEvent.click(screen.getByRole("button", { name: /All changes/ }))

    expect(closed).toBe(1)
  })

  test("says so plainly when the commit cannot be read", async () => {
    render(view({ load: async () => Promise.reject(new Error("HTTP 404")) }))

    await waitFor(() => expect(screen.getByText(/could not be read/)).toBeDefined())
    expect(screen.getByText(/HTTP 404/)).toBeDefined()
  })

  test("shows a commit already in hand without reading it again", async () => {
    let reads = 0
    render(
      view({
        held: () => commit,
        load: async () => {
          reads += 1
          return commit
        }
      })
    )

    // On screen in the first render: no spinner between a click and something
    // that was sitting in memory.
    expect(screen.getByText(commit.headline)).toBeDefined()
    expect(screen.queryByText("Reading the commit…")).toBeNull()
    await waitFor(() => expect(reads).toBe(0))
  })

  test("does not put a late answer on screen after another commit was opened", async () => {
    let settle = (_: CommitDetail) => {}
    const { unmount } = render(
      view({ load: () => new Promise<CommitDetail>((resolve) => (settle = resolve)) })
    )

    unmount()
    settle(commit)

    await waitFor(() => expect(screen.queryByText(commit.headline)).toBeNull())
  })
})
