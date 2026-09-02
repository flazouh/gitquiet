import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ListedIssues } from "../app/issueList"
import type { Involvement, ListedIssue } from "../domain/issues"
import { IssuesScreen } from "./IssuesScreen"

afterEach(cleanup)

const issue = (number: number, over: Partial<ListedIssue> = {}): ListedIssue => ({
  reference: { owner: "flowline-labs", repo: "flowline", number },
  id: `I_${number}`,
  title: `Something is wrong, number ${number}`,
  author: { login: "aleks", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  comments: 0,
  labels: [],
  raisedAt: "2026-07-01T09:00:00Z",
  ...over
})

const shown = (
  rows: ReadonlyArray<ListedIssue>,
  over: Partial<ListedIssues> = {},
  involvement: Involvement = "assigned",
  onGo: (involvement: Involvement) => void = () => {}
) =>
  render(
    <IssuesScreen
      involvement={involvement}
      load={() => Effect.succeed({ rows, pages: Option.none(), ...over })}
      onStepAside={() => {}}
      onPage={() => {}}
      onGo={onGo}
    />
  )

describe("the reader's own issues, across everything", () => {
  test("draws one row for each", async () => {
    shown([issue(31), issue(12)])

    const rows = await screen.findAllByRole("link", { name: /Issue / })
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/flowline-labs/flowline/issues/31",
      "/flowline-labs/flowline/issues/12"
    ])
  })

  test("names the repository on every row, because they come from everywhere", async () => {
    // The opposite of a repository's own list, where the bar says it once. Here
    // there is no one repository, so the row is the only place it can be said.
    shown([issue(31)])

    const row = await screen.findByRole("link", { name: /Issue / })
    expect(row.textContent).toContain("flowline")
  })

  test("hands its rows to ⌘K, so a half-remembered title finds one", async () => {
    // The spec's promise for Home: "every repository, plus every pull request and issue
    // the Courts hold". Only the Working Set kept it, so a reader could be looking at an
    // issue on this page, press ⌘K, type its title and be told there is nothing.
    shown([issue(31), issue(12)])
    await screen.findAllByRole("link", { name: /Issue / })

    await userEvent.keyboard("{Meta>}k{/Meta}")
    await userEvent.type(screen.getByRole("combobox"), "number 31")

    expect(screen.getAllByRole("option").map((one) => one.textContent)).toEqual([
      expect.stringContaining("number 31")
    ])
  })

  test("offers GitHub's three tabs", async () => {
    shown([issue(31)])
    await screen.findAllByRole("link", { name: /Issue / })

    for (const name of ["Assigned", "Created", "Mentioned"]) {
      expect(screen.getByRole("tab", { name })).toBeTruthy()
    }
  })

  test("says which tab the reader is on", async () => {
    shown([issue(31)], {}, "mentioned")
    await screen.findAllByRole("link", { name: /Issue / })

    expect(screen.getByRole("tab", { name: "Mentioned" }).getAttribute("aria-selected")).toBe(
      "true"
    )
    expect(screen.getByRole("tab", { name: "Assigned" }).getAttribute("aria-selected")).toBe(
      "false"
    )
  })

  test("asks for another tab by the involvement, not by GitHub's word for it", async () => {
    let asked: Involvement | undefined
    shown([issue(31)], {}, "assigned", (involvement) => {
      asked = involvement
    })
    await screen.findAllByRole("link", { name: /Issue / })

    screen.getByRole("tab", { name: "Created" }).click()
    expect(asked).toBe("authored")
  })

  test("leaves a tab opened into a new window to the browser", async () => {
    // The press is caught to decide where it goes, not to take the address off
    // the reader. A ⌘-press that this screen answered would be a link that
    // cannot be opened beside the one being read.
    let asked: Involvement | undefined
    shown([issue(31)], {}, "assigned", (involvement) => {
      asked = involvement
    })
    await screen.findAllByRole("link", { name: /Issue / })

    const tab = screen.getByRole("tab", { name: "Created" })
    const press = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true })
    tab.dispatchEvent(press)

    expect(asked).toBeUndefined()
    expect(press.defaultPrevented).toBe(false)
    expect(tab.getAttribute("href")).toBe("/issues/created")
  })

  test("says so plainly when a tab has nothing on it", async () => {
    shown([], {}, "mentioned")
    expect(await screen.findByText(/No open issues mention you/)).toBeTruthy()
  })

  test("counts them", async () => {
    shown([issue(31)], { pages: Option.some({ current: 1, total: 5, count: 44 }) })
    expect(await screen.findByText(/44 issues/)).toBeTruthy()
  })
})

describe("an address that already asked for something", () => {
  const withSeed = (seed: string, rows: ReadonlyArray<ListedIssue>) =>
    render(
      <IssuesScreen
        involvement="assigned"
        load={() => Effect.succeed({ rows, pages: Option.none() })}
        onStepAside={() => {}}
        onPage={() => {}}
        onGo={() => {}}
        seed={seed}
      />
    )

  test("says so in the box, because the rows were fetched by it", async () => {
    withSeed("is:closed", [issue(31, { state: "closed" })])

    const box = await screen.findByRole("searchbox")
    expect((box as HTMLInputElement).value).toBe("is:closed")
  })

  test("narrows to the same rows the search did, so the box is not a lie", async () => {
    // The seed is a claim about what is on the screen. A row the box excludes
    // must not be on the screen, or the box describes a list nobody is looking at.
    withSeed("is:closed", [issue(31, { state: "closed" }), issue(12, { state: "open" })])

    const rows = await screen.findAllByRole("link", { name: /Issue / })
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/flowline-labs/flowline/issues/31"
    ])
  })

  test("leaves the box empty where the address asked for nothing", async () => {
    shown([issue(31)])

    const box = await screen.findByRole("searchbox")
    expect((box as HTMLInputElement).value).toBe("")
  })
})

describe("a read that failed", () => {
  test("says so, and offers GitHub's own list", async () => {
    render(
      <IssuesScreen
        involvement="assigned"
        load={() => Effect.fail(new Error("no"))}
        onStepAside={() => {}}
        onPage={() => {}}
        onGo={() => {}}
        signedIn={() => true}
      />
    )

    expect(await screen.findByText(/The issues assigned to you/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Show GitHub's list" })).toBeTruthy()
  })
})

/* The same mark every list publishes now. See `repoPullsScreen.test.tsx` for why. */
describe("which address this list claims to have drawn", () => {
  const drawn = () => document.documentElement.getAttribute("data-gitquiet-at")

  afterEach(() => document.documentElement.removeAttribute("data-gitquiet-at"))

  test("claims the pathname it stands for once rows are drawn", async () => {
    render(
      <IssuesScreen
        involvement="assigned"
        at="/issues/assigned"
        load={() => Effect.succeed({ rows: [issue(31)], pages: Option.none() })}
        onStepAside={() => {}}
        onPage={() => {}}
        onGo={() => {}}
      />
    )

    await screen.findByRole("link", { name: /Issue / })
    await waitFor(() => expect(drawn()).toBe("/issues/assigned"))
  })

  test("claims nothing while it is still reading", async () => {
    render(
      <IssuesScreen
        involvement="assigned"
        at="/issues/assigned"
        load={() => Effect.never as Effect.Effect<ListedIssues>}
        onStepAside={() => {}}
        onPage={() => {}}
        onGo={() => {}}
      />
    )

    await screen.findByText(/Reading your issues/)
    expect(drawn()).toBeNull()
  })
})
