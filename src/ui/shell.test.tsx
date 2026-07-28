import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { aCheck, aComment, aFile, aSnapshot, aThread, person } from "../../tests/snapshots"
import { loadPullRequest } from "../app/pullRequest"
import type { FetchedDiff, PullRequestSnapshot } from "../domain/PullRequest"
import { layerFromSnapshots } from "../github/GitHubGateway"
import { PullRequestScreen } from "./PullRequestScreen"

afterEach(cleanup)

const showing = (
  snapshot: PullRequestSnapshot,
  fetchDiffs: (paths: ReadonlyArray<string>) => Promise<ReadonlyArray<FetchedDiff>> = () =>
    Promise.resolve([])
) => {
  const layers = layerFromSnapshots([snapshot])
  const reference = snapshot.reference

  return render(
    <PullRequestScreen
      reference={reference}
      load={() => Effect.runPromise(loadPullRequest(reference).pipe(Effect.provide(layers)))}
      fetchDiffs={fetchDiffs}
      onStepAside={() => {}}
    />
  )
}

const section = (name: string) => screen.getByRole("region", { name })

const awaitPage = async () => {
  await waitFor(() => expect(section("Description")).toBeDefined())
}

const aPullRequest = () =>
  aSnapshot({
    description: {
      markdown: "## Why\n\nThe widget stood still.",
      html: "<h2>Why</h2><p>The widget stood still.</p>"
    },
    files: [aFile("src/spin.ts"), aFile("README.md")],
    threads: [
      aThread("t1", [
        aComment(person("reviewer-person"), "this name reads oddly"),
        aComment(person("author-person"), "renamed")
      ]),
      aThread("t2", [aComment(person("other-person"), "the wrap width is off by one")])
    ],
    checks: [
      aCheck("unit / framework", "failed"),
      aCheck("typecheck", "failed"),
      aCheck("lint", "succeeded")
    ],
    merge: {
      isMergeable: false,
      blockers: [{ name: "Repo rules", explanation: "a passing build is required" }],
      queue: Option.none()
    }
  })

describe("the header, which says which pull request this is", () => {
  test("says the title, the number, the state and the branches once each", async () => {
    showing(aPullRequest())
    await awaitPage()

    const header = screen.getByRole("banner")
    expect(header.textContent).toContain("Make the widget spin")
    expect(header.textContent).toContain("#7")
    expect(header.textContent).toContain("Open")
    expect(header.textContent).toContain("main")
    expect(header.textContent).toContain("spin")
    expect(header.textContent).toContain("author-person")
  })

  test("keeps a way back to the page it replaced", async () => {
    showing(aPullRequest())
    await awaitPage()

    const away = within(screen.getByRole("banner")).getByRole("link", { name: /GitHub/ })
    expect(away.getAttribute("href")).toBe("https://github.com/acme/widgets/pull/7")
  })
})

describe("what the pull request is, in four sections", () => {
  test("shows the description as GitHub renders it, and offers the rest of it", async () => {
    showing(aPullRequest())
    await awaitPage()

    expect(section("Description").querySelector(".markdown-body h2")?.textContent).toBe("Why")
    expect(within(section("Description")).getByRole("button").textContent).toContain("Show all")
  })

  test("says that CI is red, and names what failed", async () => {
    showing(aPullRequest())
    await awaitPage()

    const checks = section("Checks")
    expect(checks.textContent).toContain("2 of 3 failing")
    expect(within(checks).getByText("unit / framework")).toBeDefined()
    expect(within(checks).getByText("typecheck")).toBeDefined()
  })

  test("says plainly when every check passed", async () => {
    showing(aSnapshot({ checks: [aCheck("lint", "succeeded")] }))
    await awaitPage()

    expect(section("Checks").textContent).toContain("All 1 check passed")
  })

  test("keeps what passed folded away, since nobody came here to read it", async () => {
    showing(aPullRequest())
    await awaitPage()

    const folded = section("Checks").querySelector("details")

    expect(folded?.open).toBe(false)
    expect(folded?.textContent).toContain("lint")
  })

  test("opens a failing check in a dialog, with the way to its log", async () => {
    showing(aPullRequest())
    await awaitPage()

    await userEvent.click(screen.getByRole("button", { name: /unit \/ framework/ }))

    const dialog = screen.getByRole("dialog")
    expect(dialog.textContent).toContain("unit / framework")
    expect(within(dialog).getByRole("link", { name: /log/i }).getAttribute("href")).toBe(
      "/checks/unit / framework"
    )
  })

  test("folds every thread to one line, and opens the one asked for", async () => {
    showing(aPullRequest())
    await awaitPage()

    const talk = section("Conversation")
    const [first, second] = [...talk.querySelectorAll("details")]
    expect(first?.open).toBe(false)
    expect(second?.open).toBe(false)
    expect(talk.textContent).toContain("this name reads oddly")
    expect(talk.textContent).toContain("the wrap width is off by one")

    await userEvent.click(within(talk).getAllByText("this name reads oddly")[0]!)

    expect(first?.open).toBe(true)
    expect(second?.open).toBe(false)
  })

  test("says why the merge is blocked rather than offering a button that fails", async () => {
    showing(aPullRequest())
    await awaitPage()

    const merge = section("Merge")
    expect(merge.textContent).toContain("a passing build is required")
    expect(within(merge).getByRole("button", { name: /Squash and merge/ }).hasAttribute("disabled")).toBe(
      true
    )
    expect(within(merge).getByRole("button", { name: /Close pull request/ })).toBeDefined()
  })
})

describe("the diffs GitHub holds back", () => {
  /** Records every request, and answers with a line of content for each path. */
  const counting = () => {
    const requests: Array<ReadonlyArray<string>> = []
    const fetch = (paths: ReadonlyArray<string>): Promise<ReadonlyArray<FetchedDiff>> => {
      requests.push(paths)
      return Promise.resolve(
        paths.map((path) => ({
          path,
          diff: {
            isBinary: false,
            isTruncated: false,
            lines: [
              {
                kind: "added" as const,
                text: `+content of ${path}`,
                beforeLine: Option.none(),
                afterLine: Option.some(1)
              }
            ]
          }
        }))
      )
    }
    return { requests, fetch }
  }

  test("asks for the open file and reads ahead in the same request", async () => {
    const network = counting()
    showing(aPullRequest(), network.fetch)
    await awaitPage()

    await waitFor(() => expect(network.requests).toEqual([["src/spin.ts", "README.md"]]))
  })

  test("costs nothing to open a file that was read ahead of", async () => {
    const network = counting()
    showing(aPullRequest(), network.fetch)
    await awaitPage()
    await waitFor(() => expect(network.requests).toHaveLength(1))

    await userEvent.click(within(section("Files")).getByRole("button", { name: /Next file/ }))

    expect(network.requests).toHaveLength(1)
  })

  test("asks once for a file opened, left and opened again", async () => {
    const network = counting()
    showing(aPullRequest(), network.fetch)
    await awaitPage()
    await waitFor(() => expect(network.requests).toHaveLength(1))

    await userEvent.click(within(section("Files")).getByRole("button", { name: /Next file/ }))
    await userEvent.click(within(section("Files")).getByRole("button", { name: /Previous/ }))

    expect(network.requests.flat()).toEqual(["src/spin.ts", "README.md"])
  })

  test("says so plainly when GitHub has nothing to give for it", async () => {
    showing(aPullRequest(), () => Promise.resolve([]))
    await awaitPage()

    await waitFor(() => expect(section("Files").textContent).toContain("no content"))
  })
})

describe("a markdown file, which is prose rather than code", () => {
  const readme = (): PullRequestSnapshot =>
    aSnapshot({
      files: [
        {
          ...aFile("README.md"),
          changeType: "added",
          diff: Option.some({
            isBinary: false,
            isTruncated: false,
            lines: [
              {
                kind: "added" as const,
                text: "+# The widget",
                beforeLine: Option.none(),
                afterLine: Option.some(1)
              }
            ]
          })
        }
      ]
    })

  test("opens as the document it becomes, with the change still coloured", async () => {
    showing(readme())
    await awaitPage()

    const added = section("Files").querySelector('[data-change="added"]')
    expect(added?.querySelector("h1")?.textContent).toBe("The widget")
    expect(added?.className).toContain("bg-pass-muted")
  })

  test("marks what the change takes away in red", async () => {
    showing(
      aSnapshot({
        files: [
          {
            ...aFile("README.md"),
            diff: Option.some({
              isBinary: false,
              isTruncated: false,
              lines: [
                {
                  kind: "deleted" as const,
                  text: "-gone for good",
                  beforeLine: Option.some(1),
                  afterLine: Option.none()
                }
              ]
            })
          }
        ]
      })
    )
    await awaitPage()

    const removed = section("Files").querySelector('[data-change="deleted"]')
    expect(removed?.textContent).toContain("gone for good")
    expect(removed?.className).toContain("bg-fail-muted")
  })

  test("can be read as a diff instead", async () => {
    showing(readme())
    await awaitPage()

    await userEvent.click(within(section("Files")).getByRole("button", { name: "Diff" }))

    expect(section("Files").querySelector('[data-change="added"]')).toBeNull()
  })

  test("offers nothing of the sort for code", async () => {
    showing(aPullRequest())
    await awaitPage()

    expect(within(section("Files")).queryByRole("button", { name: "Preview" })).toBeNull()
  })
})

describe("the files, as one thing", () => {
  test("keeps the tree and the code in a single region", async () => {
    showing(aPullRequest())
    await awaitPage()

    const files = section("Files")
    expect(files.textContent).toContain("2 changed")
    // The rail and the code, inside the one region: the file is named by the
    // tree, which keeps its rows in a shadow root of its own.
    // The rail lives inside the region rather than beside it, and it names the
    // open file: its rows are in a shadow root, so the host is what can be seen
    // from out here.
    await waitFor(() => expect(files.querySelector("file-tree-container")).not.toBeNull())
  })

  test("says plainly when a pull request changes nothing", async () => {
    showing(aSnapshot())
    await awaitPage()

    expect(section("Files").textContent).toContain("No files changed")
  })
})
