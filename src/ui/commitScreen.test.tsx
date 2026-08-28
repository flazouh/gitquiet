import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
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
  <CommitScreen reference={reference} load={() => Effect.succeed(commit)} {...props} />
)

describe("a commit on the page GitHub keeps for it", () => {
  test("reads the commit named in the address", async () => {
    let asked = ""
    render(
      screenOf({
        load: (sha) =>
          Effect.sync(() => {
            asked = sha
            return commit
          })
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

    await userEvent.keyboard("s")

    expect(screen.getByLabelText("Open file").textContent).toContain("two.ts")
  })

  test("goes back for a file the commit page arrived without", async () => {
    // Their page embeds diffs until it has spent a byte budget and sends the
    // rest as names, so on any commit of size most files start out held back.
    const asked: Array<ReadonlyArray<string>> = []
    render(
      screenOf({
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

    await waitFor(() => expect(screen.getByLabelText("Open file")).toBeDefined())
    await userEvent.keyboard("s")

    await waitFor(() => expect(asked.flat()).toContain("src/held.ts"))
  })

  test("offers no way back to a branch this page was never part of", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(commit.headline)).toBeDefined())
    expect(screen.queryByText("All changes")).toBeNull()
  })

  test("keeps the way out to GitHub's own page, when there is one to go back to", async () => {
    // In the bar rather than in this panel's corner, where it was a labelled
    // button of its own. The same control was in four places under three names,
    // so a reader who wanted their page had to work out which screen they were
    // on first. The bar is above all of them.
    let handed = 0
    render(screenOf({ onUseGitHub: () => void (handed += 1) }))

    const away = await screen.findByRole("button", { name: "Show GitHub's own page" })
    await userEvent.click(away)

    expect(handed).toBe(1)
  })

  test("says nothing about a way out where there is none", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByText(commit.headline)).toBeDefined())
    expect(screen.queryByRole("button", { name: "Show GitHub's own page" })).toBeNull()
  })

  test("has the display settings the rest of the interface has", async () => {
    render(screenOf())

    await waitFor(() => expect(screen.getByLabelText("Display settings")).toBeDefined())
    // And the menu at the end of the files band, which holds the same knobs. The
    // two are named apart on purpose: two buttons answering to one name are two
    // identical buttons to anybody listening to the page instead of looking at it.
    expect(screen.getByLabelText("How the files are drawn")).toBeDefined()
  })
})

/**
 * The page a reader walks back onto, having gone from a commit to its parent and back.
 *
 * This was the one page of the eleven that opened cold every time: no memory of a commit
 * was kept at all, so the header, the message and the whole tree were a spinner for as long
 * as GitHub took. A commit that has landed never changes, which makes the memory here the
 * truest one the store holds.
 */
describe("a commit drawn from what was kept", () => {
  /** The commit as it comes out of the store: every file a name, no diff behind it. */
  const kept: CommitDetail = {
    ...commit,
    files: commit.files.map((one) => ({ ...one, diff: Option.none() }))
  }

  test("draws the commit at once, rather than waiting for GitHub to agree", async () => {
    // A read that never lands, so that anything on the screen came out of the store. With a
    // read that answered in half a second, this test passed on the read.
    render(
      screenOf({
        load: () => Effect.never,
        preload: () => Effect.succeed(Option.some(kept))
      })
    )

    // The header and the tree, on the screen while the read is still in the air.
    expect(await screen.findByText(commit.headline)).toBeTruthy()
    expect(screen.getByLabelText("Open file").textContent).toContain("one.ts")
  })

  test("takes the read's own answer over the one that was kept", async () => {
    const stale: CommitDetail = { ...kept, headline: "The line the store had" }
    render(
      screenOf({
        load: () => Effect.sleep("20 millis").pipe(Effect.as(commit)),
        preload: () => Effect.succeed(Option.some(stale))
      })
    )

    expect(await screen.findByText(stale.headline)).toBeTruthy()
    // Silently: what the corner used to say about this is in `Toasts.tsx`.
    await waitFor(() => expect(screen.getByText(commit.headline)).toBeDefined())
  })
})
