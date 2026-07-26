import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Layer } from "effect"
import { aComment, aFile, aSnapshot, aThread, person } from "../../tests/snapshots"
import { correctCourt, loadPullRequest } from "../app/pullRequest"
import { layerMemory } from "../attention/CourtOverrides"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import { layerFromSnapshots } from "../github/GitHubGateway"
import { PullRequestScreen } from "./PullRequestScreen"

afterEach(cleanup)

const showing = (snapshot: PullRequestSnapshot) => {
  const layers = Layer.merge(layerFromSnapshots([snapshot]), layerMemory())
  const reference = snapshot.reference

  return render(
    <PullRequestScreen
      reference={reference}
      load={() => Effect.runPromise(loadPullRequest(reference).pipe(Effect.provide(layers)))}
      correct={(override) =>
        Effect.runPromise(correctCourt(reference, override).pipe(Effect.provide(layers)))
      }
      onStepAside={() => {}}
    />
  )
}

const tab = (name: string) => screen.getByRole("tab", { name })

const openTab = async (name: string) => {
  await userEvent.click(tab(name))
  return screen.getByRole("tabpanel", { name })
}

const awaitTabs = async () => {
  await waitFor(() => expect(screen.getByRole("tablist")).toBeDefined())
}

const withChangesAndTalk = () =>
  aSnapshot({
    files: [aFile("src/spin.ts"), aFile("README.md")],
    threads: [aThread("t1", [aComment(person("reviewer-person"), "this name reads oddly")])]
  })

describe("moving between the three views of a pull request", () => {
  test("opens on what needs the Participant, not on the changes", async () => {
    showing(withChangesAndTalk())
    await awaitTabs()

    expect(tab("Overview").getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("region", { name: "Your Move" })).toBeDefined()
  })

  test("counts the changed files and the threads on the tabs themselves", async () => {
    showing(withChangesAndTalk())
    await awaitTabs()

    expect(tab("Files 2")).toBeDefined()
    expect(tab("Conversation 1")).toBeDefined()
  })

  test("shows the changed files, and puts the Control Center away while it does", async () => {
    showing(withChangesAndTalk())
    await awaitTabs()

    const files = await openTab("Files 2")

    expect(files.textContent).toContain("src/spin.ts")
    expect(screen.queryByRole("region", { name: "Your Move" })).toBeNull()
  })

  test("shows what people said about the changes", async () => {
    showing(withChangesAndTalk())
    await awaitTabs()

    const talk = await openTab("Conversation 1")

    expect(talk.textContent).toContain("this name reads oddly")
    expect(talk.textContent).toContain("reviewer-person")
  })

  test("walks between views from the keyboard, one arrow at a time", async () => {
    showing(withChangesAndTalk())
    await awaitTabs()

    await userEvent.click(tab("Overview"))
    await userEvent.keyboard("{ArrowRight}")

    expect(tab("Files 2").getAttribute("aria-selected")).toBe("true")
    expect(document.activeElement).toBe(tab("Files 2"))
  })

  test("says so plainly when a pull request changes nothing and no one has spoken", async () => {
    showing(aSnapshot())
    await awaitTabs()

    expect((await openTab("Files")).textContent).toContain("No files changed")
    expect((await openTab("Conversation")).textContent).toContain("Nothing said yet")
  })
})
