import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { afterwards } from "../../tests/afterwards"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { InvolvedIssue } from "../domain/issues"
import { DEFAULTS, type HomeSettings, type Settings } from "../domain/Settings"
import { sittingsIn } from "../domain/sittings"
import type { InvolvedPullRequest, Opinion, Shelf } from "../domain/workingSet"
import type { Store } from "../ports/Settings"
import { SettingsProvider } from "./settings"
import { WorkingSet } from "./WorkingSet"

afterEach(cleanup)

const involved = (
  number: number,
  over: Partial<InvolvedPullRequest> = {}
): InvolvedPullRequest => ({
  reference: { owner: "flazouh", repo: "octo-repo", number },
  id: number * 1000,
  title: `pull request ${number}`,
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.some<Shelf>("needs-action"),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-01T00:00:00Z",
  headSha: `sha${number}`,
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none(),
  ...over
})

const on = (shelf: Shelf, number: number, over: Partial<InvolvedPullRequest> = {}) =>
  involved(number, { shelf: Option.some(shelf), ...over })

const flat = (rows: ReadonlyArray<InvolvedPullRequest>) => sittingsIn(rows, () => Option.none())

const raised = (number: number, over: Partial<InvolvedIssue> = {}): InvolvedIssue => ({
  reference: { owner: "flazouh", repo: "octo-repo", number },
  id: `issue-${number}`,
  title: `issue ${number}`,
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  involvement: "assigned",
  comments: 0,
  labels: [],
  raisedAt: "2026-07-01T00:00:00Z",
  ...over
})

const alongside = (
  rows: ReadonlyArray<InvolvedPullRequest>,
  issues: ReadonlyArray<InvolvedIssue>
) => sittingsIn(rows, () => Option.none(), issues)

/** A reader who has already chosen where their issues go, and a store that says so. */
const chose = (issues: HomeSettings["issues"]): Store => {
  const held: Settings = { ...DEFAULTS, home: { ...DEFAULTS.home, issues } }

  return {
    read: Effect.sync(() => held),
    write: () => Effect.sync(() => undefined),
    watch: () => () => {}
  }
}

const showing = (
  rows: ReadonlyArray<InvolvedPullRequest>,
  onOpen: (reference: PullRequestRef) => void = () => {}
) => render(<WorkingSet sittings={flat(rows)} onOpen={onOpen} />)

describe("the Working Set", () => {
  test("gives each Court a heading of its own", () => {
    showing([
      on("needs-action", 1),
      on("waiting-for-review", 2, { reviewed: Option.some<Opinion>("review-required") }),
      on("merge-queue", 3),
      on("needs-action", 4, { state: "merged" })
    ])

    expect(screen.getByRole("region", { name: "Needs You" })).toBeDefined()
    expect(screen.getByRole("region", { name: "Waiting" })).toBeDefined()
    expect(screen.getByRole("region", { name: "Running" })).toBeDefined()
    expect(screen.getByRole("region", { name: "Settled" })).toBeDefined()
  })

  test("puts a green pull request nobody must approve under Needs You", () => {
    // The row GitHub's own dashboard files under a wait. Nothing is required of
    // anybody else, the run is green, and the merge button is live — so a heading
    // saying somebody else owes the next step would hide the one row on the page
    // that could land this morning.
    showing([
      on("waiting-for-review", 7, {
        title: "price claude turns from the streamed usage",
        checks: Option.some({ state: "passing", total: 13, passed: 13 })
      })
    ])

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).getByText("price claude turns from the streamed usage")).toBeDefined()
    expect(screen.queryByRole("region", { name: "Waiting" })).toBeNull()
  })

  test("says how many are in a Court beside its name", () => {
    showing([on("needs-action", 1), on("needs-action", 2)])

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).getByText("2")).toBeDefined()
  })

  test("names a pull request by its repository and number as well as its title", () => {
    // A Working Set crosses repositories, so a title on its own is not an
    // address: two repositories can each have a "fix the flaky test".
    showing([involved(1457, { title: "price claude turns from the streamed usage" })])

    expect(screen.getByRole("link", { name: /price claude turns/ })).toBeDefined()
    expect(screen.getByText("#1457")).toBeDefined()

    // The repository by name, with the owner in the picture beside it rather than
    // in eight more characters of monospace — and the address in full for a
    // pointer that rests on it and for anything reading the row aloud.
    expect(screen.getByText("octo-repo")).toBeDefined()
    expect(within(screen.getByTitle("flazouh/octo-repo")).getByRole("img")).toBeDefined()
    expect(screen.getByRole("link", { name: /flazouh\/octo-repo#1457/ })).toBeDefined()
  })

  /*
   * The reason a row is a grid rather than a line of flexbox. Two rows holding
   * different facts used to put their columns in different places: the checks
   * landed wherever the title ran out, so a reader comparing four pull requests
   * read four rows one at a time instead of one column four times.
   */
  test("puts every row's facts in the same columns, whichever facts a row has", () => {
    showing([
      involved(1, { title: "a short one", comments: 0, size: Option.none() }),
      involved(2, {
        title:
          "a title long enough that the flexbox row it replaced would have pushed everything after it",
        comments: 12,
        size: Option.some({ added: 4120, deleted: 998 }),
        reviewed: Option.some<Opinion>("changes-requested")
      })
    ])

    const rows = screen.getAllByRole("link", { name: /flazouh\/octo-repo#/ })
    const tracks = rows.map((row) => row.style.gridTemplateColumns)

    expect(tracks[0]).toBe(tracks[1])
    // Every column is a cell on every row, empty or not: a row that skipped its
    // empty cells would slide the ones after it into the wrong track.
    expect(rows[0]?.childElementCount).toBe(rows[1]?.childElementCount)
  })

  test("sizes shared fact columns from the values in this list", () => {
    showing([
      involved(1, {
        reference: { owner: "openrouter", repo: "ori", number: 1 },
        why: Option.some("READY_TO_MERGE"),
        checks: Option.some({ state: "failing", passed: 1, total: 10 }),
        comments: 1,
        size: Option.some({ added: 77, deleted: 43 })
      })
    ])

    const row = screen.getByRole("link", { name: /openrouter\/ori#1/ })
    const tracks = row.style.gridTemplateColumns

    expect(tracks).toContain("calc(1.25rem + 3ch)")
    expect(tracks).toContain("calc(1rem + 14ch)")
    expect(tracks).toContain("calc(1rem + 7ch)")
    expect(tracks).toContain("calc(1rem + 1ch)")
    expect(tracks).toContain("calc(0.25rem + 6ch)")
  })

  test("keeps no column for a fact no row in the list has", () => {
    // Seven rems held open on every line for a reason none of these rows has is
    // width taken from the titles, which are the part worth reading.
    showing([involved(1), involved(2)])

    const row = screen.getAllByRole("link", { name: /flazouh\/octo-repo#/ })[0]

    expect(row?.style.gridTemplateColumns).not.toContain("7.5rem")
  })

  test("says how many lines a pull request changes", () => {
    // The one thing a row could never say, and the thing that decides which of
    // twenty-five to open: a forty-line fix and a four-thousand-line rewrite
    // were the same row until this arrived.
    showing([involved(1457, { size: Option.some({ added: 120, deleted: 8 }) })])

    const row = screen.getByRole("link", { name: /pull request 1457/ })

    expect(within(row).getByText("+120")).toBeDefined()
    expect(within(row).getByText("−8")).toBeDefined()
  })

  test("says nothing about size until the read that counts the lines has landed", () => {
    // Rows are drawn a second before their sizes arrive. A zero in the meantime
    // would be a number the reader has no reason to doubt.
    showing([involved(1457)])

    const row = screen.getByRole("link", { name: /pull request 1457/ })

    expect(row.textContent).not.toContain("+0")
  })

  test("drops the repository from a row when the list is that repository's own", () => {
    // A repository's own list names it once above the rows, and every row is in it.
    // Repeated down the page it is a column of identical text taking width from the
    // titles beside it — and the number, which is the part that differs, stays.
    render(
      <WorkingSet
        sittings={flat([involved(1457, { title: "price claude turns" })])}
        onOpen={() => {}}
        within={{ owner: "flazouh", repo: "octo-repo" }}
      />
    )

    const row = screen.getByRole("link", { name: /price claude turns/ })

    expect(row.textContent).not.toContain("flazouh/octo-repo")
    expect(within(row).getByText("#1457")).toBeDefined()
  })

  test("puts the number beside the icon, where a reader is already looking", () => {
    // The number is how a pull request is spoken about — in a branch name, in a
    // commit message, in the sentence asking someone to look at it — and it was
    // at the far end of the row, past a title long enough to push it off screen.
    // It is said once: repeating it in the trailing address would be two of the
    // same fact a hand's width apart.
    showing([involved(1457, { title: "price claude turns from the streamed usage" })])

    const row = screen.getByRole("link", { name: /price claude turns/ })
    const said = [...row.querySelectorAll("span")]
      .map((span) => (span.textContent ?? "").trim())
      .filter((words) => words.length > 0)

    expect(said.indexOf("#1457")).toBeLessThan(said.indexOf("price claude turns from the streamed usage"))
    expect(said.filter((words) => words.includes("1457"))).toEqual(["#1457"])
  })

  test("shows the face of whoever opened it", () => {
    showing([involved(1, { author: { login: "octocat", isAutomated: false, faceUrl: Option.none() } })])

    expect(screen.getByLabelText("octocat")).toBeDefined()
  })

  test("says how many checks passed when some did not", () => {
    // "8 of 11" is what fits on a row. Eleven names do not, and the count is
    // what decides whether this is worth opening now.
    showing([
      involved(1, { checks: Option.some({ state: "failing", total: 11, passed: 8 }) })
    ])

    expect(screen.getByText("8 of 11")).toBeDefined()
  })

  test("marks one the reader has not seen since it changed", () => {
    showing([involved(1, { readByViewer: false })])

    expect(screen.getByRole("link", { name: /Unread/ })).toBeDefined()
  })

  test("carries GitHub's own reason across, where it gave one", () => {
    showing([involved(1, { why: Option.some("CI_FAILING") })])

    expect(screen.getByText("CI failing")).toBeDefined()
  })

  test("does not call a stranger's merge rule their required review", () => {
    showing([
      involved(1, {
        shelf: Option.none(),
        reviewed: Option.some<Opinion>("review-required")
      })
    ])

    const row = screen.getByRole("link", { name: /pull request 1/ })

    expect(within(row).queryByText("Review required")).toBeNull()
  })

  test("says so plainly when there is nothing at all", () => {
    // An empty Working Set is good news and should read as good news, not as a
    // page that failed to load.
    showing([])

    expect(screen.getByText(/Nothing needs you/)).toBeDefined()
  })
})

describe("Involved Issues in the Working Set", () => {
  const flaky = raised(7, { title: "the flaky test", involvement: "assigned" })

  test("puts an issue in the Court that owes it, beside the pull requests", () => {
    // A Court holding only the pull-request half of what is owed is not a Court,
    // which is the whole argument for the default being mixed.
    render(<WorkingSet sittings={alongside([on("needs-action", 1)], [flaky])} onOpen={() => {}} />)

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).getByText("the flaky test")).toBeDefined()
  })

  test("says an issue's number, repository, remarks, labels and when it was raised", () => {
    const morning = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    render(
      <WorkingSet
        sittings={alongside(
          [],
          [raised(7, { title: "the flaky test", comments: 3, labels: ["bug", "flaky"], raisedAt: morning })]
        )}
        onOpen={() => {}}
      />
    )

    const row = screen.getByRole("link", { name: /the flaky test/ })

    expect(row.getAttribute("href")).toBe("/flazouh/octo-repo/issues/7")
    expect(within(row).getByText("#7")).toBeDefined()
    expect(within(row).getByText("octo-repo")).toBeDefined()
    expect(within(row).getByText("3")).toBeDefined()
    expect(within(row).getByText("bug")).toBeDefined()
    expect(within(row).getByText("flaky")).toBeDefined()
    expect(within(row).getByText("2h ago")).toBeDefined()
  })

  test("draws an issue in the tracks the pull requests use, with the rest left empty", () => {
    // One list rather than two lists sharing a heading: an issue that cut its own
    // columns would put the ages of half the rows in a different place from the
    // other half, which is the zig-zag the tracks exist to end.
    render(
      <WorkingSet
        sittings={alongside(
          [involved(1, { checks: Option.some({ state: "failing", total: 11, passed: 8 }) })],
          [raised(7, { title: "the flaky test", labels: ["bug", "flaky"] })]
        )}
        onOpen={() => {}}
      />
    )

    const pull = screen.getByRole("link", { name: /pull request 1/ })
    const issue = screen.getByRole("link", { name: /the flaky test/ })

    // The tracks stay the pull request's, which is what keeps the ages of both kinds in
    // one column and the repository chips under each other. What changes is that the
    // issue no longer holds four of them open with nothing inside: its labels and remarks
    // span them instead, so the row has no holes and still lines up.
    expect(issue.style.gridTemplateColumns).toBe(pull.style.gridTemplateColumns)
    expect(issue.childElementCount).toBeLessThan(pull.childElementCount)

    const spanning = [...issue.children].find((one) =>
      (one as HTMLElement).style.gridColumn.startsWith("span")
    )
    expect(spanning).toBeDefined()

    // Checks, a review decision and a diff are things an issue does not have and
    // never will. Nothing stands in for them.
    expect(issue.textContent).not.toContain("of 11")
    expect(issue.textContent).not.toContain("+")
  })

  test("names two labels and counts the rest, rather than lining a row with pills", () => {
    // The count was here because six coloured pills fight the title, which is the part
    // worth reading. Two quiet words at the far end of the row, where a pull request keeps
    // its diff, say what the issue is about; the rest is a number, as it was.
    render(
      <WorkingSet
        sittings={alongside(
          [],
          [raised(7, { title: "the flaky test", labels: ["bug", "flaky", "ci", "p2"] })]
        )}
        onOpen={() => {}}
      />
    )

    const row = screen.getByRole("link", { name: /the flaky test/ })

    expect(within(row).getByText("bug")).toBeDefined()
    expect(within(row).getByText("flaky")).toBeDefined()
    expect(within(row).getByText("+2")).toBeDefined()
    expect(row.textContent).not.toContain("ci")
  })

  test("seams the issues off the pull requests inside a Court that holds both", () => {
    // Interleaved by age, nine pull requests and fifteen issues read as one long list of
    // two rhythms. The seam keeps the Court's count honest — everything owed is still in
    // it — while letting each kind be read as itself.
    render(
      <WorkingSet
        sittings={alongside([on("needs-action", 1)], [raised(7, { title: "the flaky test" })])}
        onOpen={() => {}}
      />
    )

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).getByText(/^Issues$/)).toBeDefined()
    expect(within(court).getByText(/^Pull requests$/)).toBeDefined()
    expect(within(court).getByText("the flaky test")).toBeDefined()
  })

  test("counts each kind at the edge where the ages line up", async () => {
    // The number belongs in the age column rather than beside the words: there it reads as the
    // end of a row, and the Court's own total above has something to add up from.
    render(
      <WorkingSet
        sittings={alongside(
          [on("needs-action", 1), on("needs-action", 2)],
          [raised(7), raised(8), raised(9)]
        )}
        onOpen={() => {}}
      />
    )

    const court = screen.getByRole("region", { name: "Needs You" })
    const bands = [...court.querySelectorAll("div")].filter((one) =>
      /^(Pull requests|Issues)/.test(one.textContent ?? "")
    )

    expect(bands.some((one) => one.textContent === "Pull requests2")).toBe(true)
    expect(bands.some((one) => one.textContent === "Issues3")).toBe(true)
  })

  test("draws no seam in a Court that holds nothing but issues", () => {
    // A seam is a line between two things. One kind of row under a heading that already
    // names the Court needs no second heading telling it what it is.
    render(
      <WorkingSet
        sittings={alongside([], [raised(7, { title: "the flaky test" })])}
        onOpen={() => {}}
      />
    )

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).queryByText(/^Issues$/)).toBeNull()
  })

  test("gives a Court holding nothing no heading at all", () => {
    // The screens that read a list derive their Courts and so never send an empty
    // one. The screens that hold a shape while they read do send them, and four
    // headings each counting nought is a page answering before it has read.
    render(
      <WorkingSet
        sittings={[
          { court: "needs-you", count: 0, piles: [], issues: [] },
          ...alongside([on("waiting-for-review", 2)], [])
        ]}
        onOpen={() => {}}
      />
    )

    expect(screen.queryByRole("region", { name: "Needs You" })).toBeNull()
    expect(screen.getByRole("region", { name: "Waiting" })).toBeDefined()
  })

  test("draws no seam in a Court that holds nothing but pull requests", () => {
    // The mirror of the case above, and the one that was wrong: a Court of pull
    // requests carried a band reading `Issues 0` with nothing under it. A band is a
    // line between two kinds, so a kind that is not there gets no line.
    render(<WorkingSet sittings={alongside([on("needs-action", 1)], [])} onOpen={() => {}} />)

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).queryByText(/^Issues$/)).toBeNull()
    expect(within(court).queryByText(/^Pull requests$/)).toBeNull()
  })

  test("gathers the issues under a heading of their own for a reader who asked for them apart", async () => {
    await act(async () => {
      render(
        <SettingsProvider store={chose("separate")}>
          <WorkingSet sittings={alongside([on("needs-action", 1)], [flaky])} onOpen={() => {}} />
        </SettingsProvider>
      )
    })

    const apart = screen.getByRole("region", { name: /Involved Issues/ })

    expect(within(apart).getByText("the flaky test")).toBeDefined()
    expect(
      within(screen.getByRole("region", { name: "Needs You" })).queryByText("the flaky test")
    ).toBeNull()
  })

  test("walks onto an issue as well as onto a pull request", async () => {
    render(<WorkingSet sittings={alongside([on("needs-action", 1)], [flaky])} onOpen={() => {}} />)

    await userEvent.keyboard("jj")

    expect(screen.getByRole("link", { name: /the flaky test/ }).getAttribute("aria-current")).toBe(
      "true"
    )
  })

  /*
   * A live afternoon put eleven issues of one repository under one Court and pushed every
   * pull request in the next Court off the screen. The pull requests are the moves; the
   * issues are what is also owed. A tail nobody asked for cannot be allowed to bury them.
   */
  test("holds back a long tail of issues behind a count of what is left", () => {
    render(
      <WorkingSet
        sittings={alongside(
          [on("needs-action", 1)],
          [1, 2, 3, 4, 5, 6, 7, 8].map((number) => raised(number))
        )}
        onOpen={() => {}}
      />
    )

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).getAllByRole("link", { name: /Issue flazouh\/octo-repo#/ })).toHaveLength(5)
    expect(within(court).getByRole("button", { name: "3 more issues" })).toBeDefined()
    // The Court still counts everything it holds, shown or not: the count answers
    // "how much is owed", which a fold does not change.
    expect(within(court).getByText("9")).toBeDefined()
  })

  test("shows the rest of the issues when asked", async () => {
    render(
      <WorkingSet
        sittings={alongside(
          [on("needs-action", 1)],
          [1, 2, 3, 4, 5, 6, 7, 8].map((number) => raised(number))
        )}
        onOpen={() => {}}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "3 more issues" }))

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).getAllByRole("link", { name: /Issue flazouh\/octo-repo#/ })).toHaveLength(8)
    expect(within(court).queryByRole("button", { name: /more issues/ })).toBeNull()
  })

  /*
   * Otherwise the walk would step onto a row that is not on the screen: `j` past the fold
   * would move the selection into nothing and the reader would press it again to escape.
   */
  test("unfolds the tail when the walk steps into it", async () => {
    render(
      <WorkingSet
        sittings={alongside(
          [on("needs-action", 1)],
          [1, 2, 3, 4, 5, 6, 7, 8].map((number) => raised(number))
        )}
        onOpen={() => {}}
      />
    )

    // Past the pull request and past all five issues that the fold leaves showing.
    await userEvent.keyboard("jjjjjjj")

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).getAllByRole("link", { name: /Issue flazouh\/octo-repo#/ })).toHaveLength(8)
    expect(screen.getByRole("link", { name: /^issue 6\./ }).getAttribute("aria-current")).toBe("true")
  })

  test("opens the issue the walk is standing on", async () => {
    render(<WorkingSet sittings={alongside([on("needs-action", 1)], [flaky])} onOpen={() => {}} />)

    // The row is a link to GitHub's own page for the issue, and nothing here
    // intercepts a press on one, so following it is what opening it means. Held
    // back in the test because a test has nowhere to go.
    let followed = 0
    screen.getByRole("link", { name: /the flaky test/ }).addEventListener("click", (event) => {
      event.preventDefault()
      followed += 1
    })

    await userEvent.keyboard("jj{Enter}")

    expect(followed).toBe(1)
  })
})

describe("a stack in the Working Set", () => {
  const chain = [
    on("needs-action", 1, { title: "the foundation" }),
    on("ready-to-merge", 2, { title: "the middle" }),
    on("ready-to-merge", 3, { title: "the top" })
  ]

  const stacked = sittingsIn(chain, (one) =>
    Option.some(
      [
        { baseBranch: "main", headBranch: "stack-1" },
        { baseBranch: "stack-1", headBranch: "stack-2" },
        { baseBranch: "stack-2", headBranch: "stack-3" }
      ][one.reference.number - 1]!
    )
  )

  const theCard = (): HTMLElement => {
    const card = document.querySelector("[data-stack]")
    if (!(card instanceof HTMLElement)) throw new Error("No stack card on the page")
    return card
  }

  test("draws the stack as one card of flat rows, base first, with no tree semantics", () => {
    render(<WorkingSet sittings={stacked} onOpen={() => {}} />)

    // A card of flat rows rather than a tree widget: these are links to pages,
    // and the tree role brings arrow-key expectations nobody is met with here.
    expect(screen.queryByRole("tree")).toBeNull()
    expect(document.querySelector('[role="treeitem"]')).toBeNull()

    const rows = within(theCard()).getAllByRole("link")
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("the foundation"),
      expect.stringContaining("the middle"),
      expect.stringContaining("the top")
    ])
  })

  test("keeps the whole stack in one Court, under its foundation", () => {
    render(<WorkingSet sittings={stacked} onOpen={() => {}} />)

    const court = screen.getByRole("region", { name: "Needs You" })

    expect(within(court).getByText(/the top/)).toBeDefined()
    expect(screen.queryByRole("region", { name: "Waiting" })).toBeNull()
  })

  test("gives every stack position its own column without padding the row", () => {
    render(<WorkingSet sittings={stacked} onOpen={() => {}} />)

    const [base, middle, top] = within(theCard()).getAllByRole("link")

    expect(base?.style.paddingLeft).toBe("")
    expect(middle?.style.paddingLeft).toBe("")
    expect(top?.style.paddingLeft).toBe("")
    expect(base?.style.gridTemplateColumns.startsWith("1.25rem ")).toBe(true)
    expect(middle?.style.gridTemplateColumns).toBe(base?.style.gridTemplateColumns)
    expect(top?.style.gridTemplateColumns).toBe(base?.style.gridTemplateColumns)
    expect(
      [...theCard().querySelectorAll("[data-stack-position]")].map((position) =>
        position.textContent?.trim()
      )
    ).toEqual(["#1", "#2", "#3"])
  })

  test("keeps a double-digit stack position on one line", () => {
    const ten = Array.from({ length: 10 }, (_, at) =>
      on(at === 0 ? "needs-action" : "ready-to-merge", at + 1)
    )
    const tenStacked = sittingsIn(ten, (one) =>
      Option.some({
        baseBranch: one.reference.number === 1 ? "main" : `stack-${one.reference.number - 1}`,
        headBranch: `stack-${one.reference.number}`
      })
    )

    render(<WorkingSet sittings={tenStacked} onOpen={() => {}} />)

    const positions = [...theCard().querySelectorAll<HTMLElement>("[data-stack-position]")]
    expect(positions.at(-1)?.textContent).toBe("#10")
    expect(positions.at(-1)?.classList.contains("whitespace-nowrap")).toBe(true)
  })

  test("draws no connector or relation icon", () => {
    render(<WorkingSet sittings={stacked} onOpen={() => {}} />)

    expect(theCard().querySelector("svg[data-stack-relations]")).toBeNull()
    expect(theCard().querySelector(".t-stack-mark")).toBeNull()
  })

  test("keeps one stack icon beside the card label", () => {
    render(<WorkingSet sittings={stacked} onOpen={() => {}} />)

    const label = theCard().querySelector("[data-stack-label]")

    expect(label?.textContent).toBe("Stack")
    expect(label?.querySelectorAll("svg")).toHaveLength(1)
  })

  test("says each stack position aloud", () => {
    render(<WorkingSet sittings={stacked} onOpen={() => {}} />)

    expect(screen.getByRole("link", { name: /the middle.*Stack position #2 of 3/ })).toBeDefined()
  })

  test("gives the title the width left after its visible facts", () => {
    render(
      <WorkingSet
        sittings={alongside(
          stacked.flatMap((sitting) => sitting.piles.map((pile) => pile.one)),
          [raised(7, { labels: ["bug"] })]
        )}
        onOpen={() => {}}
      />
    )

    const row = screen.getByRole("link", { name: /the foundation/ })

    expect(row.style.gridTemplateColumns).toContain("minmax(0,1fr)")
    expect(row.style.gridTemplateColumns).not.toContain("minmax(0,4rem)")
  })
})

describe("narrowing the Working Set down", () => {
  const many = [
    involved(1, { title: "price claude turns" }),
    involved(2, { title: "cache the tokenizer" }),
    involved(3, { title: "drop the old migration", readByViewer: false })
  ]

  test("hides what does not match as the reader types, without asking GitHub again", async () => {
    // The whole Working Set is already here. Filtering it is a question about
    // what is on the screen, and a question already answered should not cost a
    // request or a spinner.
    showing(many)

    await userEvent.type(screen.getByRole("searchbox", { name: /Filter/ }), "tokenizer")

    expect(screen.getByText(/cache the tokenizer/)).toBeDefined()
    expect(screen.queryByText(/price claude turns/)).toBeNull()
  })

  test("matches on the repository and number too, not only the title", async () => {
    showing(many)

    await userEvent.type(screen.getByRole("searchbox", { name: /Filter/ }), "octo-repo#3")

    expect(screen.getByText(/drop the old migration/)).toBeDefined()
    expect(screen.queryByText(/cache the tokenizer/)).toBeNull()
  })

  test("can be narrowed to one repository, which is what a reader of this list asks about", async () => {
    // The Working Set spans everything the reader is involved in, and half the
    // questions brought to it are about the one repository they are working in
    // this afternoon.
    showing([
      involved(1, { title: "price claude turns" }),
      involved(2, {
        title: "cache the tokenizer",
        reference: { owner: "oven-sh", repo: "bun", number: 2 }
      })
    ])

    await userEvent.click(screen.getByRole("button", { name: /Repository/ }))
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /bun/ }))

    expect(screen.getByText(/cache the tokenizer/)).toBeDefined()
    expect(screen.queryByText(/price claude turns/)).toBeNull()
  })

  test("takes the issues in a Court with it, since an issue is in a repository too", async () => {
    render(
      <WorkingSet
        sittings={alongside(
          [
            involved(1, {
              title: "cache the tokenizer",
              reference: { owner: "oven-sh", repo: "bun", number: 1 }
            })
          ],
          [raised(7, { title: "the flaky test" })]
        )}
        onOpen={() => {}}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: /Repository/ }))
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /bun/ }))

    expect(screen.getByText(/cache the tokenizer/)).toBeDefined()
    expect(screen.queryByText(/the flaky test/)).toBeNull()
  })

  test("offers no repository to choose between where every row is in one", () => {
    // A repository's own list, and a Working Set that holds one repository this
    // morning. A chip whose single term matches every row cannot narrow anything.
    showing(many)

    expect(screen.queryByRole("button", { name: /Repository/ })).toBeNull()
  })

  test("can be narrowed to only what has changed since the reader last looked", async () => {
    showing(many)

    await userEvent.click(screen.getByRole("button", { name: /Activity/ }))
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /Unread/ }))

    expect(screen.getByText(/drop the old migration/)).toBeDefined()
    expect(screen.queryByText(/price claude turns/)).toBeNull()
  })

  test("a chip and the box are the same filter, so pointing leaves something to edit", async () => {
    // The chip writes a term into the box the reader is typing in. Two filters
    // that could disagree would mean a list nobody can explain from the screen.
    showing(many)

    await userEvent.click(screen.getByRole("button", { name: /Activity/ }))
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /Unread/ }))

    const box = screen.getByRole("searchbox", { name: /Filter/ })

    expect(box instanceof HTMLInputElement ? box.value : "").toBe("is:unread")
  })

  test("comes back filtered the way it was left", async () => {
    // Filtering is how this screen is used, not a thing done once: a reader who
    // works from `author:me is:failing` should not retype it every time they open
    // a repository.
    localStorage.setItem("gitquiet:filter:working-set", "is:unread")

    render(<WorkingSet sittings={flat(many)} onOpen={() => {}} scope="working-set" />)

    const box = screen.getByRole("searchbox", { name: /Filter/ })
    expect(box instanceof HTMLInputElement ? box.value : "").toBe("is:unread")
    expect(screen.queryByText(/price claude turns/)).toBeNull()

    localStorage.clear()
  })

  test("writes down what it was filtered to, under this list's own name", async () => {
    render(<WorkingSet sittings={flat(many)} onOpen={() => {}} scope="flazouh/octo-repo" />)

    await userEvent.type(screen.getByRole("searchbox", { name: /Filter/ }), "is:unread")

    expect(localStorage.getItem("gitquiet:filter:flazouh/octo-repo")).toBe("is:unread")
    expect(localStorage.getItem("gitquiet:filter:working-set")).toBeNull()

    localStorage.clear()
  })

  test("remembers nothing for a list that was never given a name to remember it by", async () => {
    render(<WorkingSet sittings={flat(many)} onOpen={() => {}} />)

    await userEvent.type(screen.getByRole("searchbox", { name: /Filter/ }), "is:unread")

    expect(localStorage.length).toBe(0)
  })

  test("waits, rather than blaming the filter, while the checks are still being read", async () => {
    // Checks arrive in a read after the rows, so a remembered `is:passing` judges a
    // whole list of rows nothing has been asked about. Saying "Nothing matches that."
    // there tells the reader their filter is wrong when the page is unfinished — and
    // for the second it lasts, the list has a heading and nothing under it.
    localStorage.setItem("gitquiet:filter:working-set", "is:passing")

    render(<WorkingSet sittings={flat(many)} onOpen={() => {}} scope="working-set" />)

    expect(screen.queryByText("Nothing matches that.")).toBeNull()
    expect(screen.getByRole("status").textContent).toContain("Still reading")

    localStorage.clear()
  })

  test("says the filter matched nothing once every row has been judged", async () => {
    const failing = Option.some({
      state: "failing" as const,
      total: 3,
      passed: 1,
      failed: 2,
      running: 0
    })
    localStorage.setItem("gitquiet:filter:working-set", "is:passing")

    render(
      <WorkingSet
        sittings={flat([on("needs-action", 1, { checks: failing })])}
        onOpen={() => {}}
        scope="working-set"
      />
    )

    expect(screen.getByText("Nothing matches that.")).toBeDefined()

    localStorage.clear()
  })

  test("narrows by a term typed rather than pointed at", async () => {
    showing(many)

    await userEvent.type(screen.getByRole("searchbox", { name: /Filter/ }), "is:unread")

    expect(screen.getByText(/drop the old migration/)).toBeDefined()
    expect(screen.queryByText(/price claude turns/)).toBeNull()
  })

  test("says when the filter has hidden everything, rather than looking empty", async () => {
    showing(many)

    await userEvent.type(screen.getByRole("searchbox", { name: /Filter/ }), "nothing matches this")

    expect(screen.getByText(/Nothing matches/)).toBeDefined()
  })

  test("keeps a stack whole when one of its members matches", async () => {
    // A stack is one piece of work. Half of it on the screen would misrepresent
    // what lands with what.
    render(<WorkingSet sittings={stackedChain()} onOpen={() => {}} />)

    await userEvent.type(screen.getByRole("searchbox", { name: /Filter/ }), "the top")

    expect(screen.getByText(/the foundation/)).toBeDefined()
  })
})

const stackedChain = () =>
  sittingsIn(
    [
      on("needs-action", 1, { title: "the foundation" }),
      on("ready-to-merge", 2, { title: "the middle" }),
      on("ready-to-merge", 3, { title: "the top" })
    ],
    (one) =>
      Option.some(
        [
          { baseBranch: "main", headBranch: "stack-1" },
          { baseBranch: "stack-1", headBranch: "stack-2" },
          { baseBranch: "stack-2", headBranch: "stack-3" }
        ][one.reference.number - 1]!
      )
  )

describe("moving through the Working Set without the mouse", () => {
  const undone = afterwards()

  const three = [
    involved(1, { title: "first", changedAt: "2026-07-03T00:00:00Z" }),
    involved(2, { title: "second", changedAt: "2026-07-02T00:00:00Z" }),
    involved(3, { title: "third", changedAt: "2026-07-01T00:00:00Z" })
  ]

  test("j goes down and k comes back", async () => {
    showing(three)

    await userEvent.keyboard("j")
    expect(screen.getByRole("link", { name: /first/ }).getAttribute("aria-current")).toBe("true")

    await userEvent.keyboard("j")
    expect(screen.getByRole("link", { name: /second/ }).getAttribute("aria-current")).toBe("true")

    await userEvent.keyboard("k")
    expect(screen.getByRole("link", { name: /first/ }).getAttribute("aria-current")).toBe("true")
  })

  test("goes round to the last row from the first, and comes back round from there", async () => {
    showing(three)

    // The first press is the top whichever direction it was, there being nowhere
    // to go round from yet. The second is the wrap.
    await userEvent.keyboard("kk")
    expect(screen.getByRole("link", { name: /third/ }).getAttribute("aria-current")).toBe("true")

    await userEvent.keyboard("j")
    expect(screen.getByRole("link", { name: /first/ }).getAttribute("aria-current")).toBe("true")
  })

  test("opens the one it is on", async () => {
    let opened: string | undefined

    showing(three, (reference) => {
      opened = `${reference.owner}/${reference.repo}#${reference.number}`
    })

    await userEvent.keyboard("j")
    await userEvent.keyboard("{Enter}")

    expect(opened).toBe("flazouh/octo-repo#1")
  })

  test("Shift+O puts the one it is on in a tab of its own", async () => {
    // Triage is opening four things to come back to. Leaving the list for each
    // one means finding your place in it again, which a pointer never had to do
    // and the keyboard had no way to avoid.
    const asked: Array<ReadonlyArray<unknown>> = []
    const put = (value: Window["open"]) => {
      Object.defineProperty(window, "open", { configurable: true, writable: true, value })
    }
    const before = window.open

    put(((...args: ReadonlyArray<unknown>) => {
      asked.push(args)
      return null
    }) as unknown as Window["open"])
    undone(() => put(before))

    let opened: string | undefined
    showing(three, (reference) => {
      opened = `${reference.owner}/${reference.repo}#${reference.number}`
    })

    await userEvent.keyboard("j")
    await userEvent.keyboard("{Shift>}O{/Shift}")

    expect(asked).toEqual([["/flazouh/octo-repo/pull/1", "_blank", "noopener"]])
    // And this tab stayed where it was, which is the whole point of the key.
    expect(opened).toBeUndefined()
  })

  test("walks into a stack rather than stepping over it", async () => {
    // Every row is walkable, foundation and everything above it, because a
    // reader moving down the list is moving through pull requests.
    render(<WorkingSet sittings={stackedChain()} onOpen={() => {}} />)

    await userEvent.keyboard("jj")

    expect(screen.getByRole("link", { name: /^the middle\./ }).getAttribute("aria-current")).toBe(
      "true"
    )
  })

  /**
   * The row itself, which is the wrapper around the link rather than the link.
   *
   * A row is two things — everything that is read, which is the anchor, and the
   * menu at its end, which cannot be inside one — so the entrance, the hover and
   * the chosen tint all belong to what holds both.
   */
  const rowOf = (name: RegExp): HTMLElement => {
    const row = screen.getByRole("link", { name }).parentElement
    if (row === null) throw new Error(`No row around ${String(name)}`)
    return row
  }

  test("the first set of rows does not arrive, since the skeleton it replaced is leaving", () => {
    // Two entrances for one event, each hiding half of the other: the screen fades
    // a skeleton off the top of this list at the same four hundred milliseconds a
    // row would rise through. The dissolve is that moment's motion, so the first
    // set is simply here — and every stage after it genuinely arrives.
    render(<WorkingSet sittings={flat([on("needs-action", 1)])} onOpen={() => {}} />)

    expect(rowOf(/pull request 1/).className).not.toContain("t-row-in")
  })

  test("a row that was already here does not arrive again when a later row does", () => {
    // A repository's list is read in stages and each one only adds to the rows already
    // drawn. Keyed to the element, the entrance would replay on every stage — and
    // folding a row into a stack rebuilds its element, so it would replay hardest
    // exactly where the list is already moving.
    const { rerender } = render(
      <WorkingSet sittings={flat([on("needs-action", 1)])} onOpen={() => {}} />
    )

    rerender(
      <WorkingSet
        sittings={flat([on("needs-action", 1), on("needs-action", 2)])}
        onOpen={() => {}}
      />
    )

    expect(rowOf(/pull request 1/).className).not.toContain("t-row-in")
    expect(rowOf(/pull request 2/).className).toContain("t-row-in")
  })

  test("stops staggering arrivals after a handful of rows", () => {
    // Forty milliseconds each, uncapped, is two and a half seconds before the last row
    // of a busy repository shows up — which is the wait this was meant to remove.
    // Asked of a stage rather than of the first draw, which is the only place rows
    // arrive in a run at all.
    const { rerender } = render(<WorkingSet sittings={flat([on("needs-action", 1)])} onOpen={() => {}} />)

    rerender(
      <WorkingSet
        sittings={flat(Array.from({ length: 10 }, (_, at) => on("needs-action", at + 1)))}
        onOpen={() => {}}
      />
    )

    const arriving = screen
      .getAllByRole("link")
      .map((link) => link.parentElement)
      .filter((row): row is HTMLElement => row !== null && row.className.includes("t-row-in"))

    expect(arriving[0]?.style.getPropertyValue("--row-at")).toBe("0")
    expect(arriving[5]?.style.getPropertyValue("--row-at")).toBe("5")
    expect(arriving.at(-1)?.style.getPropertyValue("--row-at")).toBe("5")
  })
})
