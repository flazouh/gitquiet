import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { without, withOneMore } from "../domain/gistEdit"
import { gistFormOn, sendingGist } from "./gistEditForm"

const editing = readFileSync("tests/fixtures/gistEditForm.html", "utf8")
const making = readFileSync("tests/fixtures/gistNewForm.html", "utf8")

const pageOf = (source: string): Document =>
  new DOMParser().parseFromString(source, "text/html")

const read = (source: string) => gistFormOn(pageOf(source))
const sent = (source: string, change: (draft: NonNullable<ReturnType<typeof read>>["draft"]) => NonNullable<ReturnType<typeof read>>["draft"] = (draft) => draft) => {
  const form = read(source)!
  return new URLSearchParams(sendingGist(form, change(form.draft)))
}

describe("their gist editor, read off the page", () => {
  test("reads where it posts and what its button says", () => {
    expect(read(editing)).toMatchObject({ action: "/octocat/aaa111", words: "Update secret gist" })
    expect(read(making)).toMatchObject({ action: "/", words: "Create secret gist" })
  })

  test("reads every file, with the id GitHub knows it by", () => {
    const files = read(editing)?.draft.files ?? []

    expect(files.map((file) => file.name)).toEqual(["deploy-notes.md", "retry.py"])
    expect(files[0]?.oid).toBe("3768a50bff448a570930e554280271027f7cc8be")
    expect(files[0]?.content).toBe("## Deploying\nRun migrations before the deploy step")
  })

  test("does not read their delete fields as the file", () => {
    // Their own Remove button works by enabling four disabled fields and turning the live
    // ones off. Reading a disabled field is reading the file as empty and asking for it
    // to be deleted, which is what a browser would never send.
    const files = read(editing)?.draft.files ?? []

    expect(files.length).toBe(2)
    expect(files[0]?.content).not.toBe("")
    expect(files.some((file) => file.deleted)).toBe(false)
  })

  test("reads the description, and the visibility only where their form asks", () => {
    // GitHub offers no way to change a gist's visibility once it exists.
    expect(read(editing)?.draft).toMatchObject({
      description: "Notes on rolling out staging",
      open: null
    })
    expect(read(making)?.draft).toMatchObject({ description: "", open: false })
  })

  test("keeps every field of theirs that is not the gist, including the honeypot", () => {
    // A field this file had to know the name of is a field GitHub can rename underneath it.
    const body = sent(making)

    expect(body.get("authenticity_token")).toBe("a-new-token")
    expect(body.get("timestamp_secret")).toBe(
      "9d6dac77a37566c92778e60dbe3f7fdc67bfaf0bf13879cd60a11a7805c2a547"
    )
    expect(body.get("required_field_6f7b")).toBe("")
  })

  test("sends their method override, which is how their edit form is a PUT", () => {
    expect(sent(editing).get("_method")).toBe("put")
  })

  test("sends every file, rather than one of each field", () => {
    // A body that kept one of each would send a gist of one file.
    const body = sent(editing)

    expect(body.getAll("gist[contents][][name]")).toEqual(["deploy-notes.md", "retry.py"])
    expect(body.getAll("gist[contents][][oid]").length).toBe(2)
    expect(body.getAll("gist[contents][][value]").length).toBe(2)
  })

  test("gives every file the same keys in the same order, oid first", () => {
    /*
     * That is what lets Rails tell one file from the next: it starts a new entry when a
     * key it already has comes round again. A file that skipped `oid` would have its name
     * and content read as belonging to the file above it.
     */
    const form = read(editing)!
    const added = withOneMore(form.draft, "mine")
    const keys = [...new URLSearchParams(sendingGist(form, added)).keys()].filter((key) =>
      key.startsWith("gist[contents]")
    )

    expect(keys).toEqual([
      "gist[contents][][oid]",
      "gist[contents][][name]",
      "gist[contents][][value]",
      "gist[contents][][oid]",
      "gist[contents][][name]",
      "gist[contents][][value]",
      "gist[contents][][oid]",
      "gist[contents][][name]",
      "gist[contents][][value]"
    ])
  })

  test("sends a deleted file back asking to be deleted, rather than leaving it out", () => {
    // A file simply omitted from the request is a file GitHub keeps.
    const form = read(editing)!
    const body = new URLSearchParams(sendingGist(form, without(form.draft, form.draft.files[1]!.key)))

    expect(body.getAll("gist[contents][][name]")).toEqual(["deploy-notes.md", "retry.py"])
    expect(body.getAll("gist[contents][][delete]")).toEqual(["true"])
  })

  test("drops a file GitHub has never seen, which needs no telling", () => {
    const form = read(making)!
    const added = withOneMore(form.draft, "mine")
    const body = new URLSearchParams(sendingGist(form, without(added, "mine")))

    expect(body.getAll("gist[contents][][name]").length).toBe(1)
    expect(body.getAll("gist[contents][][delete]")).toEqual([])
  })

  test("sends the visibility only where their form asked for one", () => {
    expect(sent(editing).has("gist[public]")).toBe(false)
    expect(sent(making, (draft) => ({ ...draft, open: true })).get("gist[public]")).toBe("1")
  })

  test("reads nothing at all from a page that carries no such form", () => {
    // Their own form is still under ours, and a page this cannot read is theirs to keep.
    expect(read("<html><body><p>something else</p></body></html>")).toBeNull()
    expect(read('<form class="js-blob-form" action="/"></form>')).toBeNull()
  })
})
