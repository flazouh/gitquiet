import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Deferred, Effect, Option } from "effect"
import type { ChangedFile, CommitDetail } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../domain/choices"
import { DEFAULTS } from "../domain/Settings"
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
  headline: "fix: restore pi RPC usage plumbing",
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
    load={() => Effect.succeed(commit)}
    onClose={() => {}}
    diff={diffChoices(DEFAULTS.diff)}
    tree={treeChoices(DEFAULTS.tree)}
    {...props}
  />
)

describe("reading one commit", () => {
  test("says it is reading before the commit arrives", () => {
    render(view({ load: () => Effect.never }))

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

  test("offers no way back on a page that is only ever about this commit", async () => {
    // GitHub's own commit page, where the branch this came from is not on the
    // screen and never was. A button leading back to a file browser nobody has
    // seen would be a promise the page cannot keep.
    render(view({ onClose: undefined }))

    await waitFor(() => expect(screen.getByText(commit.headline)).toBeDefined())
    expect(screen.queryByText("All changes")).toBeNull()
  })

  test("says so plainly when the commit cannot be read", async () => {
    render(view({ load: () => Effect.fail(new Error("HTTP 404")) }))

    await waitFor(() => expect(screen.getByText(/could not be read/)).toBeDefined())
    expect(screen.getByText(/HTTP 404/)).toBeDefined()
  })

  test("shows a commit already in hand without reading it again", async () => {
    let reads = 0
    render(
      view({
        held: () => commit,
        load: () =>
          Effect.sync(() => {
            reads += 1
            return commit
          })
      })
    )

    // On screen in the first render: no spinner between a click and something
    // that was sitting in memory.
    expect(screen.getByText(commit.headline)).toBeDefined()
    expect(screen.queryByText("Reading the commit…")).toBeNull()
    await waitFor(() => expect(reads).toBe(0))
  })

  /**
   * GitHub embeds diffs for the first few files of a commit and sends the rest as
   * names, so opening one of those has to go back for it — exactly as the whole
   * branch's file browser does. This panel used to be wired to a fetcher that
   * answered nothing, on the belief that a commit always came whole.
   *
   * What is asserted is the asking. Whether the lines then draw is the diff
   * renderer's business, and it is a built artefact that no test here has.
   */
  test("asks GitHub for a file whose content the commit page held back", async () => {
    const asked: Array<ReadonlyArray<string>> = []
    render(
      view({
        keys: "standard",
        load: () =>
          Effect.succeed({
            ...commit,
            files: [file("src/one.ts"), { ...file("src/held.ts"), diff: Option.none() }]
          }),
        fetchDiffs: (paths) =>
          Effect.sync(() => {
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
          })
      })
    )

    // Onto the second file, which is the one GitHub did not send.
    await userEvent.keyboard("j")

    await waitFor(() => expect(asked.flat()).toContain("src/held.ts"))
    // Drawn as a file with content rather than one there is nothing to say
    // about, which is what the answer arriving does.
    expect(document.querySelector('[data-file="src/held.ts"]')).not.toBeNull()
  })

  test("does not put a late answer on screen after another commit was opened", async () => {
    const reading = Deferred.makeUnsafe<CommitDetail>()
    const { unmount } = render(view({ load: () => Deferred.await(reading) }))

    unmount()
    Deferred.doneUnsafe(reading, Effect.succeed(commit))

    await waitFor(() => expect(screen.queryByText(commit.headline)).toBeNull())
  })
})
