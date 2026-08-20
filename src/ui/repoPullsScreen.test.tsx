import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Listed } from "../app/repoList"
import { sittingsIn } from "../domain/sittings"
import type { InvolvedPullRequest, Shelf } from "../domain/workingSet"
import { RepoPullsScreen } from "./RepoPullsScreen"
import type { Load } from "./useLive"

/**
 * What a repository's list shows while it is reading, when it cannot read, and once
 * it has — and the one thing it says that the Working Set does not, which is how many
 * pull requests there are in total.
 */

afterEach(cleanup)

const involved = (number: number, over: Partial<InvolvedPullRequest> = {}): InvolvedPullRequest => ({
  reference: { owner: "vercel", repo: "next.js", number },
  id: number,
  title: `pull request ${number}`,
  author: { login: "icyJoseph", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.none<Shelf>(),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-02T00:00:00Z",
  headSha: "abc",
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none(),
  ...over
})

const listed = (rows: ReadonlyArray<InvolvedPullRequest>, pages?: Listed["pages"]): Listed => ({
  sittings: sittingsIn(rows, () => Option.none()),
  pages: pages ?? Option.none()
})

const showing = (
  load: Load<Listed>,
  over: Partial<Parameters<typeof RepoPullsScreen>[0]> = {}
) =>
  render(
    <RepoPullsScreen
      repo={{ owner: "vercel", repo: "next.js" }}
      load={load}
      onOpen={() => {}}
      onStepAside={() => {}}
      signedIn={() => true}
      {...over}
    />
  )

const never = () => Effect.never as Effect.Effect<Listed>

describe("a repository's pull request list", () => {
  test("says it is reading before it has anything to show", async () => {
    showing(never)

    // Not at once: a wait too short to be read is one the reader is told
    // nothing about, out loud or on the screen.
    expect(await screen.findByText(/Reading this repository/)).toBeTruthy()
  })

  test("shows a stage of the read while the rest of it is still going", async () => {
    // A repository's list takes four reads of GitHub and one of them is worth waiting
    // for; holding the rows back until the sixth round of branch reads is what made
    // this page feel slow when there was nothing slow left to do.
    showing((partly) => {
      partly(listed([involved(1), involved(2)]))
      return never()
    })

    expect(await screen.findByText("2 pull requests")).toBeTruthy()
    expect(screen.getByText("pull request 2")).toBeTruthy()
  })

  test("keeps a finished list rather than stepping back to a stage of the next read", async () => {
    // A re-read starts over from the rows, and letting its first stage on to the screen
    // would drop the Courts and the stacks out of a list that already had them.
    let stage: ((listed: Listed) => void) | undefined
    showing((partly) => {
      stage = partly
      return Effect.succeed(listed([involved(1), involved(2)]))
    })

    await screen.findByText("2 pull requests")
    stage?.(listed([involved(1)]))

    await waitFor(() => expect(screen.getByText("2 pull requests")).toBeTruthy())
  })

  test("names the repository it is showing", async () => {
    showing(() => Effect.succeed(listed([involved(1)])))

    expect(await screen.findByText("vercel/next.js")).toBeTruthy()
  })

  test("leaves the repository off the rows, having named it once above them", async () => {
    // Every row here is in the same repository, and the heading says which. The
    // address on each one is a column of the same twelve characters repeated
    // down the page, taking width from the titles it sits beside.
    showing(() => Effect.succeed(listed([involved(1)])))

    const row = await screen.findByRole("link", { name: /pull request 1/ })

    expect(row.textContent).not.toContain("vercel/next.js")
    expect(within(row).getByText("#1")).toBeTruthy()
  })

  test("says how much of a cut list is showing, when the read stopped at its cap", async () => {
    // The read gathers every page onto this one, and leaves the paging info only
    // when it had to stop. A thousand rows drawn as everything there is would be
    // the most misleading true-looking thing on the screen.
    showing(() =>
      Effect.succeed(
        listed([involved(1)], Option.some({ current: 1, total: 80, count: 1989 }))
      )
    )

    expect(await screen.findByText(/1 of 1,989 pull requests/)).toBeTruthy()
  })

  test("counts the rows itself when every page is here", async () => {
    showing(() => Effect.succeed(listed([involved(1), involved(2)])))

    expect(await screen.findByText("2 pull requests")).toBeTruthy()
  })

  test("offers no pager: every pull request is on this one page", async () => {
    showing(() =>
      Effect.succeed(listed([involved(1)], Option.some({ current: 1, total: 80, count: 1989 })))
    )

    await screen.findByText("vercel/next.js")

    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull()
  })

  test("blames GitHub rather than itself when a read fails", async () => {
    showing(() => Effect.fail(new Error("500")))

    expect(await screen.findByText(/Something GitHub sends has changed/)).toBeTruthy()
  })

  test("blames the session when nobody is signed in", async () => {
    // Every route answers as if the repository is empty to a signed-out reader, which
    // looks exactly like a payload that changed shape.
    showing(() => Effect.fail(new Error("500")), { signedIn: () => false })

    expect(await screen.findByText(/signed out of GitHub/)).toBeTruthy()
  })

  test("hands the page back to GitHub when asked", async () => {
    let handed = false
    showing(() => Effect.fail(new Error("500")), { onStepAside: () => void (handed = true) })

    await userEvent.click(await screen.findByRole("button", { name: "Show GitHub's list" }))

    await waitFor(() => expect(handed).toBe(true))
  })
})
