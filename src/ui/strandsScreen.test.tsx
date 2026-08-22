import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { strandsIn } from "../domain/strand"
import type { Listed } from "../domain/strand"
import { StrandsScreen } from "./StrandsScreen"

afterEach(cleanup)

const repo = { owner: "octo-org", repo: "octo-repo" }

const listed = (
  what: Partial<Listed> & Pick<Listed, "number" | "startedAt" | "ref">
): Listed => ({
  run: `30${what.number}`,
  url: `/octo-org/octo-repo/actions/runs/30${what.number}`,
  workflow: "ci",
  file: "ci.yml",
  title: "fix(worker): bound live tail memory and keep it observable",
  state: "succeeded",
  seconds: 234,
  actor: "flazouh",
  trigger: "synchronize",
  pullRequest: null,
  ...what
})

const onBranch = (name: string) => ({ kind: "branch", name }) as const
const onPull = (number: string) => ({ kind: "pull", number }) as const

const show = (runs: ReadonlyArray<Listed>) =>
  render(
    <StrandsScreen repo={repo} load={() => Effect.succeed(strandsIn(runs))} onStepAside={() => {}} />
  )

const threeOfOneBranch = [
  listed({
    number: "9856",
    startedAt: "2026-08-04T11:31:00Z",
    ref: onBranch("alex/live-tail-liveness"),
    pullRequest: "1760",
    state: "failed"
  }),
  listed({
    number: "9018",
    startedAt: "2026-08-04T11:07:00Z",
    ref: onPull("1760"),
    workflow: "CodeQL",
    file: "github-code-scanning/codeql",
    seconds: 200
  }),
  listed({
    number: "9849",
    startedAt: "2026-08-04T10:44:00Z",
    ref: onBranch("alex/live-tail-liveness"),
    pullRequest: "1760",
    title: "fix(worker): an earlier go at it"
  })
]

describe("a repository's runs", () => {
  test("draws one row for the work, not one for each run", async () => {
    show(threeOfOneBranch)

    const listing = await screen.findByRole("region", { name: "Runs" })
    // Three runs went in. One commit title comes out, and the earlier one is not a row.
    expect(within(listing).getAllByRole("link", { name: /^fix\(worker\)/ })).toHaveLength(1)
  })

  test("heads the row with the commit the work is on", async () => {
    show(threeOfOneBranch)

    const head = await screen.findByRole("link", {
      name: "fix(worker): bound live tail memory and keep it observable"
    })
    expect(head).toBeTruthy()
  })

  /*
   * The failing run and not the newest. A reader pressing a red row is asking what went wrong,
   * and the newest run of that head is the CodeQL one that passed.
   */
  test("opens the run that explains the standing", async () => {
    show(threeOfOneBranch)

    const head = await screen.findByRole("link", {
      name: "fix(worker): bound live tail memory and keep it observable"
    })
    expect(head.getAttribute("href")).toBe("/octo-org/octo-repo/actions/runs/309856")
  })

  test("names every workflow that ran against the head", async () => {
    show(threeOfOneBranch)

    const listing = await screen.findByRole("region", { name: "Runs" })
    expect(within(listing).getByTitle(/^ci /)).toBeTruthy()
    expect(within(listing).getByTitle(/^CodeQL /)).toBeTruthy()
  })

  /*
   * Counted, not drawn. A run against a commit the branch has moved past is a result for
   * something the reader has already left behind.
   */
  test("counts the runs against an earlier commit without drawing them", async () => {
    show(threeOfOneBranch)

    expect(await screen.findByText("1 on earlier commits")).toBeTruthy()
    expect(screen.queryByRole("link", { name: /an earlier go at it/ })).toBeNull()
  })

  /*
   * The correction the live page forced. A re-run answers for the attempt it re-ran, so the
   * row shows what the head came to and counts the rest.
   */
  test("counts a superseded attempt without drawing it, and stands on the re-run", async () => {
    show([
      listed({
        number: "9881",
        startedAt: "2026-08-04T12:10:00Z",
        ref: onBranch("alex/live-tail"),
        state: "running",
        seconds: 0
      }),
      listed({
        number: "9880",
        startedAt: "2026-08-04T11:40:00Z",
        ref: onBranch("alex/live-tail"),
        state: "cancelled"
      })
    ])

    const listing = await screen.findByRole("region", { name: "Runs" })
    expect(within(listing).getByText("1 superseded")).toBeTruthy()
    // One chip, for the run that answered, and it is the one still going.
    expect(within(listing).getAllByTitle(/run #/)).toHaveLength(1)
    expect(within(listing).getByTitle("ci in progress, run #9881")).toBeTruthy()
    expect(within(listing).getByLabelText("In progress")).toBeTruthy()
  })

  test("says how many runs the rows stand for", async () => {
    show(threeOfOneBranch)

    expect(await screen.findByText("1 strand, from 3 runs")).toBeTruthy()
  })

  test("shows the pull request the work belongs to", async () => {
    show(threeOfOneBranch)

    const pull = await screen.findByRole("link", { name: "#1760" })
    expect(pull.getAttribute("href")).toBe("/octo-org/octo-repo/pull/1760")
  })

  test("keeps two branches apart, newest first", async () => {
    show([
      listed({ number: "9800", startedAt: "2026-08-04T08:00:00Z", ref: onBranch("alex/old"), title: "an old one" }),
      listed({ number: "9857", startedAt: "2026-08-04T11:58:00Z", ref: onBranch("alex/new"), title: "a new one" })
    ])

    const listing = await screen.findByRole("region", { name: "Runs" })
    const heads = within(listing).getAllByRole("link", { name: /one$/ })
    expect(heads.map((head) => head.textContent)).toEqual(["a new one", "an old one"])
  })

  test("says so plainly where nothing has ever run", async () => {
    show([])

    expect(await screen.findByText("Nothing has run in this repository yet.")).toBeTruthy()
  })

  /*
   * Their Actions tab is read out of the markup of a whole page of theirs, so it opens from
   * the store and is checked behind what the reader sees. A list of runs that is a minute old
   * looks exactly like a current one — every row of it says "in progress" or "failed" about a
   * moment that has since passed — so the checking has to be said out loud.
   */
  /*
   * Put Away, which `docs/spec/actions.md` specified and left for the list screen to exist
   * first. The press is on the chip of the Workflow itself, because that is the only place on
   * the screen where the reader is already looking at the thing they want gone — and a pane of
   * checkboxes down the side would be the filter the `ACTIONS` place argues against.
   */
  test("puts a workflow away on a press beside its own chip", async () => {
    show(threeOfOneBranch)

    const listing = await screen.findByRole("region", { name: "Runs" })
    await userEvent.click(within(listing).getByRole("button", { name: "Put CodeQL away" }))

    expect(within(listing).queryByTitle(/^CodeQL /)).toBeNull()
    expect(within(listing).getByTitle(/^ci /)).toBeTruthy()
  })

  test("counts the runs it is no longer showing out of the tally", async () => {
    show(threeOfOneBranch)

    expect(await screen.findByText("1 strand, from 3 runs")).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Put CodeQL away" }))

    expect(screen.getByText("1 strand, from 2 runs")).toBeTruthy()
  })

  /*
   * Away and reachable. Their own answer to this request is a Workflow filter that holds one
   * value and forgets it on the next page load; the opposite mistake would be a decision the
   * reader cannot find again, so what is away is named above the rows for as long as it is away.
   */
  test("says what is away, and brings it back on a press", async () => {
    show(threeOfOneBranch)

    const listing = await screen.findByRole("region", { name: "Runs" })
    await userEvent.click(within(listing).getByRole("button", { name: "Put CodeQL away" }))

    const back = screen.getByRole("button", { name: "Bring CodeQL back" })
    expect(back.textContent).toContain("CodeQL")
    await userEvent.click(back)

    expect(within(listing).getByTitle(/^CodeQL /)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Bring CodeQL back" })).toBeNull()
  })

  test("says nothing about putting things away until something is away", async () => {
    show(threeOfOneBranch)

    await screen.findByRole("region", { name: "Runs" })
    expect(screen.queryByText("Put away")).toBeNull()
  })

  test("draws the known runs at once, rather than waiting for GitHub to agree", async () => {
    const kept = strandsIn(threeOfOneBranch)

    // A read that never lands, so anything on the screen came out of the store.
    render(
      <StrandsScreen
        repo={repo}
        load={() => Effect.never}
        preload={() => Effect.succeed(Option.some(kept))}
        onStepAside={() => {}}
      />
    )

    expect(await screen.findByRole("region", { name: "Runs" })).toBeTruthy()
  })
})
