import { describe, expect, test } from "bun:test"
import { kept, refusedFor, withFile, withOneMore, without, type GistDraft } from "./gistEdit"

const draft = (over: Partial<GistDraft> = {}): GistDraft => ({
  description: "Notes",
  open: null,
  files: [
    { key: "one", oid: "abc", name: "deploy-notes.md", content: "## Deploying", deleted: false }
  ],
  ...over
})

describe("a gist being written", () => {
  test("follows a file across a rename, by a key that is not its name", () => {
    // A list keyed by name draws a rename as a file removed and a file added, which loses
    // the caret and everything typed since.
    const renamed = withFile(draft(), "one", (file) => ({ ...file, name: "runbook.md" }))

    expect(renamed.files[0]?.name).toBe("runbook.md")
    expect(renamed.files[0]?.content).toBe("## Deploying")
  })

  test("adds a file named nothing, rather than one this extension named", () => {
    // A name invented here would be sent as if the reader had chosen it.
    const more = withOneMore(draft(), "mine")

    expect(more.files.map((file) => file.name)).toEqual(["deploy-notes.md", ""])
    expect(more.files[1]?.oid).toBe("")
  })

  test("marks a file GitHub knows, and simply drops one it does not", () => {
    // Their form deletes a file by being told to. One left out of the request is kept.
    const more = withOneMore(draft(), "mine")

    expect(without(more, "mine").files.length).toBe(1)
    expect(without(more, "one").files.map((file) => file.deleted)).toEqual([true, false])
  })

  test("shows the reader every file that is not on its way out", () => {
    expect(kept(without(draft(), "one")).length).toBe(0)
  })

  test("says why a draft cannot be sent, before their page says it for us", () => {
    // Their form answers all three by reloading the page with the reason at the top,
    // after the reader has lost their place in a textarea.
    expect(refusedFor(draft())).toBeNull()
    expect(refusedFor(without(draft(), "one"))).toBe("A gist needs at least one file.")
    expect(refusedFor(withOneMore(draft(), "mine"))).toBe("Every file needs a name.")
    expect(
      refusedFor(
        draft({
          files: [
            { key: "one", oid: "", name: "a.py", content: "", deleted: false },
            { key: "two", oid: "", name: "A.PY", content: "", deleted: false }
          ]
        })
      )
    ).toBe("Two files cannot share a name.")
  })
})
