import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Effect } from "effect"
import { afterEach, describe, expect, test } from "bun:test"
import type { GistDraft } from "../domain/gistEdit"
import { GistEditScreen } from "./GistEditScreen"

afterEach(cleanup)

const draft = (over: Partial<GistDraft> = {}): GistDraft => ({
  description: "Notes on rolling out staging",
  open: null,
  files: [
    {
      key: "one",
      oid: "abc",
      name: "deploy-notes.md",
      content: "## Deploying",
      deleted: false
    }
  ],
  ...over
})

const showing = (
  over: Partial<GistDraft> = {},
  onSave: (draft: GistDraft) => Effect.Effect<unknown, unknown> = () => Effect.void
) =>
  render(
    <GistEditScreen
      draft={draft(over)}
      words="Update secret gist"
      onSave={onSave}
      back="/octocat/aaa111"
      onStepAside={() => {}}
    />
  )

const contentsOf = (name: string): HTMLTextAreaElement =>
  screen.getByLabelText(`Contents of ${name}`) as HTMLTextAreaElement

describe("writing a gist", () => {
  test("opens on the gist their form was already holding", () => {
    showing()

    expect((screen.getByLabelText("Gist description") as HTMLInputElement).value).toBe(
      "Notes on rolling out staging"
    )
    expect(contentsOf("deploy-notes.md").value).toBe("## Deploying")
  })

  test("says what their button says, rather than a word of its own", () => {
    showing()

    expect(screen.getByRole("button", { name: "Update secret gist" })).toBeTruthy()
  })

  test("keeps what was typed across a rename", () => {
    // A list keyed by name draws a rename as a file removed and a file added, which loses
    // the caret and everything typed since.
    showing()
    fireEvent.change(contentsOf("deploy-notes.md"), { target: { value: "changed" } })
    fireEvent.change(screen.getByDisplayValue("deploy-notes.md"), {
      target: { value: "runbook.md" }
    })

    expect(contentsOf("runbook.md").value).toBe("changed")
  })

  test("adds a file, and takes one away", () => {
    showing()
    fireEvent.click(screen.getByRole("button", { name: "Add file" }))

    expect(screen.getAllByLabelText("Filename including extension").length).toBe(2)

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]!)

    expect(screen.getAllByLabelText("Filename including extension").length).toBe(1)
  })

  test("offers the visibility only where their form asks for one", () => {
    // GitHub has no route to change a gist's visibility after it exists.
    showing()
    expect(screen.queryByLabelText("Visibility")).toBeNull()

    cleanup()
    showing({ open: false })

    expect((screen.getByLabelText("Visibility") as HTMLSelectElement).value).toBe("secret")
  })

  test("says why a draft cannot be sent, and does not send it", () => {
    // Their own form answers this by reloading the page with the reason at the top, after
    // the reader has lost their place in a textarea.
    let asked = false
    showing({}, () => Effect.sync(() => { asked = true }))

    fireEvent.change(screen.getByDisplayValue("deploy-notes.md"), { target: { value: "  " } })
    fireEvent.click(screen.getByRole("button", { name: "Update secret gist" }))

    expect(screen.getByRole("alert").textContent).toContain("Every file needs a name")
    expect(asked).toBe(false)
  })

  test("sends what is on the screen, not what their form opened with", () => {
    let sent: GistDraft | null = null
    showing({}, (draft) => Effect.sync(() => { sent = draft }))

    fireEvent.change(contentsOf("deploy-notes.md"), { target: { value: "rewritten" } })
    fireEvent.click(screen.getByRole("button", { name: "Update secret gist" }))

    expect((sent as GistDraft | null)?.files[0]?.content).toBe("rewritten")
  })

  test("keeps the words on the screen when GitHub refuses them", () => {
    // Whatever was typed is the one thing here that cannot be fetched again.
    showing({}, () => Effect.fail(new Error("Gist description is too long")))

    fireEvent.change(contentsOf("deploy-notes.md"), { target: { value: "rewritten" } })
    fireEvent.click(screen.getByRole("button", { name: "Update secret gist" }))

    expect(screen.getByRole("alert").textContent).toContain("too long")
    expect(contentsOf("deploy-notes.md").value).toBe("rewritten")
  })

  test("saves on the shortcut every other box on GitHub answers", () => {
    let asked = false
    showing({}, () => Effect.sync(() => { asked = true }))

    fireEvent.keyDown(contentsOf("deploy-notes.md"), { key: "Enter", metaKey: true })

    expect(asked).toBe(true)
  })

  test("gives the one file the room the whole complaint is about", () => {
    // Measured live on 2026-09-02: their editor is 322 pixels tall in an 888 pixel window.
    showing()
    expect(contentsOf("deploy-notes.md").className).toContain("min-h-[60vh]")

    fireEvent.click(screen.getByRole("button", { name: "Add file" }))

    // And less of it each where a gist has several, which is a page somebody can see the
    // shape of rather than four boxes two thirds of a window tall.
    expect(contentsOf("deploy-notes.md").className).toContain("min-h-[24rem]")
  })
})
