import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Shelf } from "../app/shelf"
import type { Entry, Footing, Front } from "../domain/repoHome"
import { RepoHomeScreen } from "./RepoHomeScreen"
import type { Load } from "./useLive"

/**
 * What a repository's front page shows, in what order, and for whom.
 *
 * The order is the only thing this screen decides. Everything else on it is on it
 * for every reader, and the tests that matter most here are the ones that say so.
 */

afterEach(cleanup)

const entry = (name: string, over: Partial<Entry> = {}): Entry => ({
  name,
  path: name,
  kind: "file",
  touched: Option.none(),
  ...over
})

const front = (footing: Footing, over: Partial<Front> = {}): Front => ({
  repo: { owner: "flowline-labs", repo: "flowline" },
  footing,
  branch: "main",
  head: "abc123",
  entries: [
    entry("src", { kind: "directory", path: "src" }),
    entry("README.md", {
        touched: Option.some({
        at: "2026-07-30T12:00:00Z",
        said: "Say what this is for",
        url: "/flowline-labs/flowline/commit/def",
        oid: Option.some("def"),
        who: Option.none()
      })
    })
  ],
  welcome: Option.some({
    name: "README.md",
    path: "README.md",
    html: "<h1>Flowline</h1><p>A queue, a worker and somewhere to watch them.</p>",
    timedOut: false
  }),
  about: {
    description: Option.some("Speak a language by speaking it."),
    stars: Option.some(1204),
    forks: Option.some(38),
    topics: ["speech", "language"],
    starring: "unstarred"
  },
  commits: Option.some(140),
  ...over
})

const showing = (load: Load<Front>, over: Partial<Parameters<typeof RepoHomeScreen>[0]> = {}) =>
  render(
    <RepoHomeScreen
      repo={{ owner: "flowline-labs", repo: "flowline" }}
      load={load}
      onStepAside={() => {}}
      signedIn={() => true}
      {...over}
    />
  )

/**
 * Which of the two blocks the reader meets first, by where they sit in the page.
 *
 * The two, and not the card of facts above them. That one is always first and is
 * not what any of this decides, so counting it would make every one of these
 * tests fail the day it was added — which is what it did.
 */
const BLOCKS: ReadonlyArray<string> = ["Readme", "Files"]

const orderOf = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll("section[aria-label]"))
    .map((block) => block.getAttribute("aria-label") ?? "")
    .filter((label) => BLOCKS.includes(label))

describe("a repository's front page", () => {
  test("says it is reading before it has anything to show", async () => {
    showing(() => Effect.never as Effect.Effect<Front>)

    expect(await screen.findByText(/Reading this repository/)).toBeTruthy()
  })

  test("gives a caller the README first, which is what they came to read", async () => {
    showing(() => Effect.succeed(front("caller")))

    await screen.findByText("Flowline")
    expect(orderOf()).toEqual(["Readme", "Files"])
  })

  test("gives a keeper the files first, which is what they came to open", async () => {
    showing(() => Effect.succeed(front("keeper")))

    await screen.findByText("Flowline")
    expect(orderOf()).toEqual(["Files", "Readme"])
  })

  test("keeps the files on the page for a caller as well", async () => {
    // The one rule the six extensions that tried this broke. A file list behind a
    // toggle reads as a page that failed to load, so the order changes and the
    // contents do not.
    //
    // Said of the section rather than of the rows: the tree is checked in
    // `repoTree.test.ts` and `repoTree.view.test.tsx`.
    showing(() => Effect.succeed(front("caller")))

    await screen.findByText("Flowline")
    expect(screen.getByLabelText("Files")).toBeTruthy()
  })

  test("keeps the README on the page for a keeper as well", async () => {
    showing(() => Effect.succeed(front("keeper")))

    expect(await screen.findByText("Flowline")).toBeTruthy()
  })

  test("puts the branch and the history over the tree they are about", async () => {
    // Not on the card above it, where they read as two stray words beside a
    // description. GitHub keeps them here and the reason holds: which branch
    // this is only becomes a question once the files are in front of you.
    showing(() => Effect.succeed(front("caller")))

    const files = within(await screen.findByLabelText("Files"))
    expect(files.getByRole("button", { name: "Branch: main" })).toBeTruthy()
    expect(files.getByText("140 commits").getAttribute("href")).toBe(
      "/flowline-labs/flowline/commits/main"
    )
  })

  test("reads a linked file from GitHub's resolved branch", async () => {
    const asked: Array<readonly [string, string]> = []
    const shelf: Shelf = {
      ask: (branch, path) => {
        asked.push([branch, path])
        return Effect.succeed({ path, lines: ["const dispatch = true"], rendered: Option.none() })
      },
      held: () => undefined,
      warm: () => {}
    }

    showing(() => Effect.succeed(front("keeper")), {
      reading: "framework/engine/threads/src/service.ts",
      readingBranch: "alexdepape/ori-harness-default",
      shelf
    })

    await waitFor(() => {
      expect(asked).toEqual([
        ["alexdepape/ori-harness-default", "framework/engine/threads/src/service.ts"]
      ])
    })
  })

  test("does not show the same path from a branch read earlier", async () => {
    const load = () => Effect.succeed(front("keeper"))
    const shelf: Shelf = {
      ask: (branch, path) =>
        branch === "branch-a"
          ? Effect.succeed({
              path,
              lines: ["from branch A"],
              rendered: Option.some("<p>from branch A</p>")
            })
          : Effect.never,
      held: () => undefined,
      warm: () => {}
    }
    const reading = "notes.md"
    const view = showing(load, { reading, readingBranch: "branch-a", shelf })

    expect(await screen.findByText("from branch A")).toBeTruthy()

    view.rerender(
      <RepoHomeScreen
        repo={{ owner: "flowline-labs", repo: "flowline" }}
        load={load}
        onStepAside={() => {}}
        signedIn={() => true}
        reading={reading}
        readingBranch="branch-b"
        shelf={shelf}
      />
    )

    expect(await screen.findByText("Reading this file…")).toBeTruthy()
    expect(screen.queryByText("from branch A")).toBeNull()
  })

  test("offers the other branches from that control rather than only naming this one", async () => {
    showing(() => Effect.succeed(front("caller")))

    const files = within(await screen.findByLabelText("Files"))
    const picker = files.getByRole("button", { name: "Branch: main" })

    expect(picker.getAttribute("aria-expanded")).toBe("false")
  })

  test("shows what the repository says it is, and the numbers people judge it by", async () => {
    showing(() => Effect.succeed(front("caller")))

    expect(await screen.findByText("Speak a language by speaking it.")).toBeTruthy()
    expect(screen.getByText("140 commits")).toBeTruthy()
    // The star's own count is on its button, beside the press that changes it,
    // rather than said twice on one card.
    const star = within(screen.getByLabelText("About")).getByRole("button")
    expect(within(star).getByText("1,204")).toBeTruthy()
  })

  test("leaves a count of nothing off the line rather than drawing a zero", async () => {
    // Every private repository reads "0 stars 0 forks", which is three words
    // saying that nobody starred something nobody outside the company can see.
    showing(() =>
      Effect.succeed(
        front("keeper", {
          about: {
            description: Option.none(),
            stars: Option.some(0),
            forks: Option.some(0),
            topics: [],
            starring: "unstarred"
          }
        })
      )
    )

    await screen.findByText("Flowline")
    expect(screen.queryByText("0 stars")).toBeNull()
    expect(screen.queryByText("0 forks")).toBeNull()
  })

  test("says so plainly when GitHub gave up on rendering the README", async () => {
    showing(() =>
      Effect.succeed(
        front("caller", {
          welcome: Option.some({ name: "README.md", path: "README.md", html: "", timedOut: true })
        })
      )
    )

    expect(await screen.findByText(/could not render this README/)).toBeTruthy()
  })

  /*
   * The README is markdown like every other body on this interface, so it is
   * parsed here rather than taken as GitHub's rendering of it. Their HTML wears
   * their own table, their own headings and their own code fences, which is a
   * second interface inside this one on the one page most readers meet first.
   */
  test("draws the README from its source, in this interface's own chrome", async () => {
    showing(() => Effect.succeed(front("caller")), {
      loadReadme: () =>
        Effect.succeed("| Group | Means |\n| --- | --- |\n| Needs You | You can act on it now. |")
    })

    expect(await screen.findByText("Needs You")).toBeTruthy()
    expect(document.querySelector(".markdown-table")).toBeTruthy()
  })

  test("asks for the README by the path GitHub named, on the branch it is on", async () => {
    const asked: Array<readonly [string, string]> = []

    showing(
      () =>
        Effect.succeed(
          front("caller", {
            welcome: Option.some({
              name: "README",
              path: "docs/README.md",
              html: "<h1>Flowline</h1>",
              timedOut: false
            })
          })
        ),
      {
        loadReadme: (branch, path) => {
          asked.push([branch, path])
          return Effect.succeed("# Flowline")
        }
      }
    )

    await screen.findByText("Flowline")
    expect(asked).toEqual([["main", "docs/README.md"]])
  })

  /*
   * A README that cannot be read is worse than one wearing GitHub's chrome, and
   * their rendering of it is already in hand at no cost.
   */
  test("keeps GitHub's rendering where the source cannot be read", async () => {
    showing(() => Effect.succeed(front("caller")), {
      loadReadme: () => Effect.fail(new Error("no"))
    })

    expect(await screen.findByText("Flowline")).toBeTruthy()
  })

  test("asks for nothing where GitHub could not render the README either", async () => {
    let asked = 0

    showing(
      () =>
        Effect.succeed(
          front("caller", {
            welcome: Option.some({ name: "README.md", path: "README.md", html: "", timedOut: true })
          })
        ),
      {
        loadReadme: () => {
          asked += 1
          return Effect.succeed("# Flowline")
        }
      }
    )

    await screen.findByText(/could not render this README/)
    expect(asked).toBe(0)
  })

  test("offers GitHub's own page back when the read fails", async () => {
    showing(() => Effect.fail(new Error("no")) as unknown as Effect.Effect<Front>)

    expect(await screen.findByText(/Show GitHub's page/)).toBeTruthy()
  })

  test("keeps the way out to GitHub's own page in the bar, even when this one has loaded", async () => {
    // In the bar rather than only on the failure card. The pane replaces their
    // file toolbar, and a reader who still wants something on their page had
    // no way to reach it once ours had drawn.
    let handed = 0
    showing(() => Effect.succeed(front("caller")), {
      onStepAside: () => {
        handed += 1
      }
    })

    const away = await screen.findByRole("button", { name: "Show GitHub's own page" })
    await userEvent.click(away)

    expect(handed).toBe(1)
  })
})
