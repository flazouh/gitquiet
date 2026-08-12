import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { afterwards } from "../../tests/afterwards"
import { aCheck, aComment, aFile, aSnapshot, aThread, person } from "../../tests/snapshots"
import { loadPullRequest } from "../app/pullRequest"
import type { FetchedDiff, PullRequestSnapshot } from "../domain/PullRequest"
import { layerFromSnapshots } from "../github/GitHubGateway"
import { PullRequestScreen } from "./PullRequestScreen"

afterEach(cleanup)

const showing = (
  snapshot: PullRequestSnapshot,
  fetchDiffs: (paths: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<FetchedDiff>> = () =>
    Effect.succeed([])
) => {
  const layers = layerFromSnapshots([snapshot])
  const reference = snapshot.reference

  return render(
    <PullRequestScreen
      reference={reference}
      load={() => loadPullRequest(reference).pipe(Effect.provide(layers))}
      fetchDiffs={fetchDiffs}
      onStepAside={() => {}}
    />
  )
}

const section = (name: string) => screen.getByRole("region", { name })

/** Every height a panel holds its contents to, which is how anything here hides. */
const ceilings = (panel: HTMLElement) =>
  [...panel.querySelectorAll<HTMLElement>("*")]
    .map((held) => held.style.maxHeight)
    .filter((height) => height !== "")

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
      aCheck("unit / packages", "failed"),
      aCheck("typecheck", "failed"),
      aCheck("lint", "succeeded")
    ],
    merge: {
      isMergeable: false,
      blockers: [
        {
          name: "Repo rules",
          explanation: "a passing build is required",
          bypassable: false,
          files: [],
          mayResolve: false,
          about: Option.some("checks" as const)
        }
      ],
      queue: Option.none(),
      autoMerge: Option.none(),
      mayBypass: false,
      update: Option.none(),
      channels: [],
      stack: Option.none()
    }
  })

describe("a blocker with somewhere to send the reader", () => {
  const undo = afterwards()

  test("puts the section that answers it in front of them", async () => {
    // "A passing build is required" beside a merge button, with the checks two
    // scrolls away, leaves the reader to go and find what failed. This is the
    // half of the sentence GitHub's own card leaves out.
    const went: Array<Element> = []
    const scrolling = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) {
      went.push(this)
    }
    undo(() => {
      Element.prototype.scrollIntoView = scrolling
    })

    // GitHub's own page is still underneath ours, hidden rather than removed,
    // and it labels its regions the same words we do. Whichever of the two
    // comes first in the document is not a detail: theirs is display:none, and
    // scrolling to something invisible looks exactly like a dead button.
    const theirs = document.createElement("section")
    theirs.setAttribute("aria-label", "Checks")
    document.body.prepend(theirs)
    undo(() => theirs.remove())

    const view = showing(aPullRequest())
    await awaitPage()

    await userEvent.click(screen.getByRole("button", { name: "Repo rules" }))

    expect(went).toHaveLength(1)
    expect(went[0]?.getAttribute("aria-label")).toBe("Checks")
    expect(view.container.contains(went[0] ?? null)).toBe(true)
  })
})

describe("the header, which says which pull request this is", () => {
  test("leaves the page's one banner to the bar above it", async () => {
    // Both were a `header` at the top of the document, so both were a banner,
    // and a reader asking their screen reader for the banner was given two with
    // nothing to tell them apart. The bar is the page's; this one is the pull
    // request's, and it is a region with a name.
    showing(aPullRequest())
    await awaitPage()

    expect(screen.getAllByRole("banner")).toHaveLength(1)
  })

  test("says the title, the number, the state and the branches once each", async () => {
    showing(aPullRequest())
    await awaitPage()

    const header = screen.getByRole("region", { name: "This pull request" })
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

    const away = within(screen.getByRole("region", { name: "This pull request" })).getByRole(
      "link",
      { name: /GitHub/ }
    )
    expect(away.getAttribute("href")).toBe("https://github.com/acme/widgets/pull/7")
  })
})

describe("the keyboard", () => {
  const sheet = () => screen.queryByRole("dialog", { name: "Keyboard shortcuts" })

  /** GitHub's own page, which this interface is a guest on rather than a replacement for. */
  const gitHubsOwnMarkup = () => {
    const theirs = document.createElement("div")
    theirs.dataset.theirs = "yes"
    theirs.innerHTML = '<details-menu role="menu">Copy link</details-menu>'
    document.body.append(theirs)
  }

  afterEach(() => {
    for (const one of document.querySelectorAll("[data-theirs]")) one.remove()
  })

  test("still answers on a page carrying thirty menus of GitHub's own", async () => {
    // A pull request page keeps its dropdowns in the document whether they are
    // showing or not, every one of them marked as a menu. Looking at the whole
    // page for something open finds them, decides the reader is in a menu, and
    // the keyboard is silent for the length of the review.
    gitHubsOwnMarkup()
    showing(aPullRequest())
    await awaitPage()

    await userEvent.keyboard("j")

    expect(screen.getByLabelText("Open file").textContent).toContain("README.md")
  })

  test("keeps the question mark for GitHub, having no sheet of its own", async () => {
    // The sheet this used to open is gone: a list of nine chords that had to be
    // maintained beside the bindings, kept behind a key GitHub's own help is
    // also behind. The caps on the buttons say the same thing where the reader
    // is already looking, so the press is left to whoever else wants it.
    showing(aPullRequest())
    await awaitPage()

    await userEvent.keyboard("?")

    expect(sheet()).toBeNull()
    expect(screen.queryByRole("button", { name: "Keyboard shortcuts" })).toBeNull()
  })

  test("moves between files from the page, not only from inside the browser", async () => {
    showing(aPullRequest())
    await awaitPage()

    await userEvent.keyboard("j")

    expect(screen.getByLabelText("Open file").textContent).toContain("README.md")
  })
})

describe("what the pull request is, in four sections", () => {
  test("shows the top of the description as GitHub renders it, and offers the rest", async () => {
    showing(aPullRequest())
    await awaitPage()

    const about = section("Description")
    expect(about.querySelector(".markdown h2")?.textContent).toBe("Why")
    expect(ceilings(about)).toEqual(["13rem"])
    expect(within(about).getByRole("button").textContent).toContain("Show all")
  })

  test("opens the description to all of it, with no second window onto it", async () => {
    showing(aPullRequest())
    await awaitPage()

    await userEvent.click(within(section("Description")).getByText("Show all of it"))

    const about = section("Description")
    expect(about.textContent).toContain("The widget stood still.")
    // What the ceiling used to become: opened, it was a shorter box that
    // scrolled inside the card, which is the hiding this was meant to end.
    expect(ceilings(about)).toEqual([])
    expect(within(about).getByRole("button").textContent).toContain("Show less")
  })

  test("says that CI is red, and names what failed", async () => {
    showing(aPullRequest())
    await awaitPage()

    const checks = section("Checks")
    expect(checks.textContent).toContain("2 of 3 failing")
    expect(within(checks).getByText("unit / packages")).toBeDefined()
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

    await userEvent.click(screen.getByRole("button", { name: /unit \/ packages/ }))

    const dialog = screen.getByRole("dialog")
    expect(dialog.textContent).toContain("unit / packages")
    expect(within(dialog).getByRole("link", { name: /log/i }).getAttribute("href")).toBe(
      "/checks/unit / packages"
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
    const fetch = (paths: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<FetchedDiff>> =>
      Effect.sync(() => {
        requests.push(paths)
        return paths.map((path) => ({
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
      })
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
    showing(aPullRequest(), () => Effect.succeed([]))
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
  test("keeps patch-based review progress and expires it when the patch changes", async () => {
    localStorage.clear()
    const diff = (text: string) => ({
      isBinary: false,
      isTruncated: false,
      lines: [
        {
          kind: "added" as const,
          text,
          beforeLine: Option.none<number>(),
          afterLine: Option.some(1)
        }
      ]
    })
    const snapshot = aSnapshot({
      files: [
        { ...aFile("src/one.ts"), diff: Option.some(diff("const one = 1")) },
        { ...aFile("src/two.ts"), diff: Option.some(diff("const two = 2")) }
      ]
    })

    const first = showing(snapshot)
    await awaitPage()
    await userEvent.click(within(section("Files")).getByRole("button", { name: "Review mode" }))

    expect(within(section("Files")).getByText("0 of 2 read")).toBeDefined()

    await userEvent.click(within(section("Files")).getByRole("button", { name: /^Next file/ }))
    await waitFor(() => expect(within(section("Files")).getByText("1 of 2 read")).toBeDefined())

    first.unmount()
    const resumed = showing(snapshot)
    await awaitPage()
    await userEvent.click(within(section("Files")).getByRole("button", { name: "Review mode" }))

    expect(within(section("Files")).getByText("1 of 2 read")).toBeDefined()

    resumed.unmount()
    showing({
      ...snapshot,
      files: [
        { ...snapshot.files[0]!, diff: Option.some(diff("const one = 10")) },
        snapshot.files[1]!
      ]
    })
    await awaitPage()
    await userEvent.click(within(section("Files")).getByRole("button", { name: "Review mode" }))

    expect(within(section("Files")).getByText("0 of 2 read")).toBeDefined()
    localStorage.clear()
  })

  test("keeps the same file workspace through full-screen review mode", async () => {
    showing(aPullRequest())
    await awaitPage()

    const files = section("Files")

    await userEvent.click(within(files).getByRole("button", { name: "Review mode" }))

    expect(section("Files")).toBe(files)
    expect(files.className).toContain("fixed")
    expect(document.documentElement.hasAttribute("data-gitquiet-reviewing")).toBe(true)

    await userEvent.keyboard("{Escape}")

    expect(section("Files")).toBe(files)
    expect(files.className).not.toContain("fixed")
    expect(document.documentElement.hasAttribute("data-gitquiet-reviewing")).toBe(false)
  })

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
