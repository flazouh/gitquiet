import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Layer } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import { aCheck, aFile, aSnapshot, aThread, aComment, asAuthor, person } from "../../tests/snapshots"
import { correctCourt, loadPullRequest } from "../app/pullRequest"
import { CourtOverrides, layerMemory } from "../attention/CourtOverrides"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import {
  GitHubGateway,
  layerFromRecordings,
  layerFromSnapshots
} from "../github/GitHubGateway"
import { PullRequestScreen } from "./PullRequestScreen"

afterEach(cleanup)

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }

type AppLayers = Layer.Layer<GitHubGateway | CourtOverrides>

const mount = (reference: PullRequestRef, layers: AppLayers) => {
  const load = () =>
    Effect.runPromise(loadPullRequest(reference).pipe(Effect.provide(layers)))
  const correct = (override: Parameters<typeof correctCourt>[1]) =>
    Effect.runPromise(correctCourt(reference, override).pipe(Effect.provide(layers)))

  return render(
    <PullRequestScreen reference={reference} load={load} correct={correct} />
  )
}

const court = (name: string) => screen.getByRole("region", { name })

const awaitControlCenter = async () => {
  await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeDefined())
}

const recorded = (reference: PullRequestRef) =>
  Layer.merge(
    layerFromRecordings([{ reference, payloads: draftWithBotFindings }]),
    layerMemory()
  )

const constructed = (snapshot: PullRequestSnapshot) =>
  Layer.merge(layerFromSnapshots([snapshot]), layerMemory())

describe("opening a pull request as a Reviewer", () => {
  test("shows what needs the Participant, from real GitHub payloads", async () => {
    mount(draft, recorded(draft))
    await awaitControlCenter()

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Polish multi-file diffs in Agents window"
    )
    expect(within(court("Your Move")).getByText("2 bot findings")).toBeDefined()
    expect(within(court("Your Move")).getByText("5 files")).toBeDefined()
  })

  test("states plainly how much is owed", async () => {
    mount(draft, recorded(draft))
    await awaitControlCenter()

    expect(screen.getByText("7 things need you")).toBeDefined()
  })

  test("shows all three Courts, with what others owe kept apart from what is done", async () => {
    mount(draft, recorded(draft))
    await awaitControlCenter()

    expect(within(court("Waiting On Others")).getByText("2 checks")).toBeDefined()
    expect(within(court("Waiting On Others")).getByText("3 merge blockers")).toBeDefined()
    expect(within(court("Settled")).getByText("27 checks")).toBeDefined()
  })
})

describe("the same pull request seen by its Author", () => {
  const parts = {
    reference: draft,
    files: [aFile("a.ts"), aFile("b.ts")],
    checks: [aCheck("build", "failed")]
  }

  test("a Reviewer is asked to read the files", async () => {
    mount(draft, constructed(aSnapshot(parts)))
    await awaitControlCenter()

    expect(within(court("Your Move")).getByText("2 files")).toBeDefined()
    expect(screen.getByText(/you are reviewing/)).toBeDefined()
  })

  test("the Author is asked to fix the build instead", async () => {
    mount(draft, constructed(asAuthor(parts)))
    await awaitControlCenter()

    const yourMove = court("Your Move")
    expect(within(yourMove).getByText("1 check")).toBeDefined()
    expect(within(yourMove).queryByText("2 files")).toBeNull()
    expect(screen.getByText(/you opened this/)).toBeDefined()
  })
})

describe("correcting a Court by hand", () => {
  const snapshot = aSnapshot({ reference: draft, files: [aFile("a.ts"), aFile("b.ts")] })

  test("the correction is reflected at once and the count drops", async () => {
    mount(draft, constructed(snapshot))
    await awaitControlCenter()
    expect(screen.getByText("2 things need you")).toBeDefined()

    await userEvent.selectOptions(screen.getByLabelText("Court for a.ts"), "settled")

    await waitFor(() => expect(screen.getByText("1 thing needs you")).toBeDefined())
  })

  test("the correction is still there when the pull request is opened again", async () => {
    const layers = constructed(snapshot)

    const first = mount(draft, layers)
    await awaitControlCenter()
    await userEvent.selectOptions(screen.getByLabelText("Court for a.ts"), "settled")
    await waitFor(() => expect(screen.getByText("1 thing needs you")).toBeDefined())
    first.unmount()

    mount(draft, layers)
    await awaitControlCenter()

    expect(screen.getByText("1 thing needs you")).toBeDefined()
    expect(within(court("Settled")).getByText("1 file")).toBeDefined()
  })
})

describe("a pull request large enough to bury the point", () => {
  const large = aSnapshot({
    reference: draft,
    files: Array.from({ length: 30 }, (_, index) => aFile(`file-${index}.ts`)),
    threads: Array.from({ length: 25 }, (_, index) =>
      aThread(`${index}`, [aComment(person("someone"))])
    ),
    checks: Array.from({ length: 100 }, (_, index) => aCheck(`check-${index}`, "succeeded")),
    commits: []
  })

  test("collapses 155 items into a handful of rows, which is what makes it fit", async () => {
    mount(draft, constructed(large))
    await awaitControlCenter()

    const rows = screen.getAllByRole("button").filter((button) => button.tagName === "BUTTON")

    expect(rows.length).toBeLessThanOrEqual(9)
    expect(within(court("Your Move")).getByText("25 threads")).toBeDefined()
    expect(within(court("Your Move")).getByText("30 files")).toBeDefined()
    expect(within(court("Settled")).getByText("100 checks")).toBeDefined()
  })

  test("the page itself does not scroll", async () => {
    mount(draft, constructed(large))
    await awaitControlCenter()

    const main = screen.getByRole("main")
    expect(main.className).toContain("h-screen")
    expect(main.className).toContain("overflow-hidden")
  })
})

describe("when the pull request cannot be read", () => {
  test("says so and offers GitHub's own page rather than showing half of it", async () => {
    mount(draft, Layer.merge(layerFromSnapshots([]), layerMemory()))

    await waitFor(() =>
      expect(screen.getByText("Something GitHub sends has changed")).toBeDefined()
    )
    expect(screen.getByRole("link", { name: "Open on GitHub" }).getAttribute("href")).toBe(
      "https://github.com/microsoft/vscode/pull/327442"
    )
  })
})
