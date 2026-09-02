import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ListedIssues } from "../app/issueList"
import type { ListedIssue } from "../domain/issues"
import { IssueListScreen } from "./IssueListScreen"

afterEach(cleanup)

const repo = { owner: "flowline-labs", repo: "flowline" }

const issue = (number: number, over: Partial<ListedIssue> = {}): ListedIssue => ({
  reference: { ...repo, number },
  id: `I_${number}`,
  title: `Something is wrong, number ${number}`,
  author: { login: "aleks", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  comments: 0,
  labels: [],
  raisedAt: "2026-07-01T09:00:00Z",
  ...over
})

const listed = (
  rows: ReadonlyArray<ListedIssue>,
  pages: ListedIssues["pages"] = Option.none()
): ListedIssues => ({ rows, pages })

const onePage = (rows: ReadonlyArray<ListedIssue>, over: Partial<ListedIssues> = {}) =>
  render(
    <IssueListScreen
      repo={repo}
      load={() => Effect.succeed({ ...listed(rows), ...over })}
      onStepAside={() => {}}
      onPage={() => {}}
    />
  )

describe("a repository's issues", () => {
  test("draws one row for each, in the order GitHub gave them", async () => {
    onePage([issue(31), issue(12), issue(7)])

    const rows = await screen.findAllByRole("link", { name: /Issue #/ })
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/flowline-labs/flowline/issues/31",
      "/flowline-labs/flowline/issues/12",
      "/flowline-labs/flowline/issues/7"
    ])
  })

  test("says the kind and the number, and claims no Court", async () => {
    // The Court is the whole of what Home concludes and this page concludes
    // nothing: one question was asked, about a repository.
    onePage([issue(31, { title: "Login loops on Safari" })])

    const row = await screen.findByRole("link", { name: /Login loops on Safari/ })
    expect(row.getAttribute("aria-label")).toBe("Login loops on Safari. Issue #31.")
  })

  test("does not repeat the repository on every row, since the bar above says it", async () => {
    onePage([issue(31), issue(12)])

    // Written thirty times down a list whose own bar already says it once is the
    // raggedness this page's rows are cut to avoid.
    for (const row of await screen.findAllByRole("link", { name: /Issue #/ })) {
      expect(row.textContent).not.toContain("flowline")
    }
  })

  test("counts them, so a first page of three hundred is not a list of ten", async () => {
    onePage([issue(31)], {
      pages: Option.some({ current: 1, total: 31, count: 303 })
    })

    expect(await screen.findByText(/303 issues/)).toBeTruthy()
    expect(screen.getByText(/page 1 of 31/)).toBeTruthy()
  })

  /*
   * The count is drawn for one reason and it is the test above. Below it the
   * reader can see how many there are by looking, and a filter narrowing the
   * rows leaves the count at what GitHub answered — so three rows sat under the
   * word twelve.
   */
  test("does not count them where every one of them is on the screen", async () => {
    onePage([issue(31), issue(12)])
    await screen.findAllByRole("link", { name: /Issue #/ })

    expect(screen.queryByText("2 issues")).toBeNull()
  })

  test("does not count them where GitHub said there is one page of them", async () => {
    onePage([issue(31)], { pages: Option.some({ current: 1, total: 1, count: 1 }) })
    await screen.findAllByRole("link", { name: /Issue #/ })

    expect(screen.queryByText("1 issue")).toBeNull()
    expect(screen.queryByText(/page 1 of/)).toBeNull()
  })

  test("offers the way to raise one, which is the only thing this page does", async () => {
    onePage([issue(31)])

    const raise = await screen.findByRole("link", { name: "New issue" })
    expect(raise.getAttribute("href")).toBe("/flowline-labs/flowline/issues/new")
  })

  test("offers it on a repository with none open, which is where it is wanted most", async () => {
    onePage([])

    expect(await screen.findByRole("link", { name: "New issue" })).toBeTruthy()
  })

  test("says so plainly when the repository has none open", async () => {
    onePage([])
    expect(await screen.findByText(/No open issues/)).toBeTruthy()
  })
})

describe("the way to the rest of them", () => {
  test("is not drawn where every one of them is already here", async () => {
    onePage([issue(31)], { pages: Option.some({ current: 1, total: 1, count: 1 }) })
    await screen.findAllByRole("link", { name: /Issue #/ })

    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
  })

  test("asks for the next page, by the number", async () => {
    let asked: number | undefined
    render(
      <IssueListScreen
        repo={repo}
        load={() =>
          Effect.succeed(listed([issue(31)], Option.some({ current: 2, total: 31, count: 303 })))
        }
        onStepAside={() => {}}
        onPage={(page) => {
          asked = page
        }}
      />
    )

    const next = await screen.findByRole("button", { name: "Next" })
    next.click()
    expect(asked).toBe(3)
  })

  test("offers no way back from the first page", async () => {
    onePage([issue(31)], { pages: Option.some({ current: 1, total: 31, count: 303 }) })

    const previous = await screen.findByRole("button", { name: "Previous" })
    expect((previous as HTMLButtonElement).disabled).toBe(true)
  })

  test("offers no way on from the last one", async () => {
    onePage([issue(31)], { pages: Option.some({ current: 31, total: 31, count: 303 }) })

    const next = await screen.findByRole("button", { name: "Next" })
    expect((next as HTMLButtonElement).disabled).toBe(true)
  })
})

describe("the filter above them", () => {
  test("narrows the list to what was typed", async () => {
    const user = userEvent.setup()
    onePage([issue(31, { title: "Login loops on Safari" }), issue(12, { title: "Slow startup" })])
    await screen.findAllByRole("link", { name: /Issue #/ })

    await user.type(screen.getByRole("searchbox"), "safari")

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Issue #/ }).length).toBe(1)
    })
    expect(screen.getByRole("link", { name: /Login loops on Safari/ })).toBeTruthy()
  })

  test("says nothing matched, rather than leaving the list looking empty", async () => {
    const user = userEvent.setup()
    onePage([issue(31, { title: "Login loops on Safari" })])
    await screen.findAllByRole("link", { name: /Issue #/ })

    await user.type(screen.getByRole("searchbox"), "nothinglikethis")

    expect(await screen.findByText("Nothing matches that.")).toBeTruthy()
  })

  test("offers no chip for a thing an issue cannot answer", async () => {
    // Checks and reviews belong to pull requests. A chip for one here would
    // empty the list every time it was pressed.
    onePage([issue(31)])
    await screen.findAllByRole("link", { name: /Issue #/ })

    expect(screen.queryByRole("button", { name: /Checks/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Review/ })).toBeNull()
    expect(screen.getByRole("button", { name: /State/ })).toBeTruthy()
  })
})

describe("a read that failed", () => {
  test("says so, and offers GitHub's own list", async () => {
    render(
      <IssueListScreen
        repo={repo}
        load={() => Effect.fail(new Error("no"))}
        onStepAside={() => {}}
        onPage={() => {}}
        signedIn={() => true}
      />
    )

    expect(await screen.findByText(/The issues in flowline-labs\/flowline/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Show GitHub's list" })).toBeTruthy()
  })
})

/* The same mark every list publishes now. See `repoPullsScreen.test.tsx` for why. */
describe("which address this list claims to have drawn", () => {
  const drawn = () => document.documentElement.getAttribute("data-gitquiet-at")

  afterEach(() => document.documentElement.removeAttribute("data-gitquiet-at"))

  test("claims the pathname it stands for once rows are drawn", async () => {
    render(
      <IssueListScreen
        repo={repo}
        at="/flowline-labs/flowline/issues"
        load={() => Effect.succeed(listed([issue(31)]))}
        onStepAside={() => {}}
        onPage={() => {}}
      />
    )

    await screen.findByRole("link", { name: /Issue #/ })
    await waitFor(() => expect(drawn()).toBe("/flowline-labs/flowline/issues"))
  })

  test("claims nothing while it is still reading", async () => {
    render(
      <IssueListScreen
        repo={repo}
        at="/flowline-labs/flowline/issues"
        load={() => Effect.never as Effect.Effect<ListedIssues>}
        onStepAside={() => {}}
        onPage={() => {}}
      />
    )

    await screen.findByText(/Reading this repository's issues/)
    expect(drawn()).toBeNull()
  })
})
