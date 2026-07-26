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

const asideCalls: Array<number> = []

const mount = (reference: PullRequestRef, layers: AppLayers) => {
  const load = () =>
    Effect.runPromise(loadPullRequest(reference).pipe(Effect.provide(layers)))
  const correct = (override: Parameters<typeof correctCourt>[1]) =>
    Effect.runPromise(correctCourt(reference, override).pipe(Effect.provide(layers)))

  return render(
    <PullRequestScreen
      reference={reference}
      load={load}
      correct={correct}
      onStepAside={() => asideCalls.push(1)}
    />
  )
}

const court = (name: string) => screen.getByRole("region", { name })

/** The disclosure per kind of thing, which is what a Court is a handful of. */
const courtRows = () =>
  ["Your Move", "Waiting On Others", "Settled"].flatMap((name) =>
    within(court(name)).queryAllByRole("group")
  )

const correctCourtOf = async (title: string, to: string) => {
  await userEvent.click(screen.getByLabelText(`Court for ${title}`))
  await userEvent.click(await screen.findByRole("menuitemradio", { name: to }))
}

const awaitControlCenter = async () => {
  await waitFor(() => expect(court("Your Move")).toBeDefined())
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

  test("opens what needs the Participant and leaves the rest folded away", async () => {
    mount(draft, recorded(draft))
    await awaitControlCenter()

    const open = (name: string) =>
      within(court(name))
        .queryAllByRole("group")
        .map((group) => (group as HTMLDetailsElement).open)

    expect(open("Your Move").every(Boolean)).toBe(true)
    expect(open("Settled").some(Boolean)).toBe(false)
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

    await correctCourtOf("a.ts", "Settled")

    await waitFor(() => expect(screen.getByText("1 thing needs you")).toBeDefined())
  })

  test("the correction is still there when the pull request is opened again", async () => {
    const layers = constructed(snapshot)

    const first = mount(draft, layers)
    await awaitControlCenter()
    await correctCourtOf("a.ts", "Settled")
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

    expect(courtRows().length).toBeLessThanOrEqual(9)
    expect(within(court("Your Move")).getByText("25 threads")).toBeDefined()
    expect(within(court("Your Move")).getByText("30 files")).toBeDefined()
    expect(within(court("Settled")).getByText("100 checks")).toBeDefined()
  })

  test("a hundred settled checks stay folded away until they are asked for", async () => {
    mount(draft, constructed(large))
    await awaitControlCenter()

    const settled = within(court("Settled")).getAllByRole("group")[0] as HTMLDetailsElement
    expect(settled.open).toBe(false)

    await userEvent.click(within(settled).getByText("100 checks"))

    expect(settled.open).toBe(true)
  })
})

describe("when the pull request cannot be read", () => {
  test("says so and gives GitHub's own conversation back", async () => {
    mount(draft, Layer.merge(layerFromSnapshots([]), layerMemory()))

    await waitFor(() =>
      expect(screen.getByText("Something GitHub sends has changed")).toBeDefined()
    )

    const before = asideCalls.length
    await userEvent.click(screen.getByRole("button", { name: "Show GitHub's conversation" }))

    expect(asideCalls.length).toBe(before + 1)
  })
})
