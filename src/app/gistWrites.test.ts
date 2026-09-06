import { Effect } from "effect"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { canSay, gistEditing, sayOnGist, withEarlierSaid } from "./gistWrites"
import type { GistSeen } from "../domain/gist"

const comments = readFileSync("tests/fixtures/gistComments.html", "utf8")
const view = readFileSync("tests/fixtures/gistView.html", "utf8")
const editor = readFileSync("tests/fixtures/gistEditForm.html", "utf8")

const pageOf = (source: string): Document =>
  new DOMParser().parseFromString(source, "text/html")

const gist = (over: Partial<GistSeen> = {}): GistSeen => ({
  owner: "octocat",
  id: "aaa111",
  title: "deploy-notes.md",
  description: null,
  secret: false,
  updatedAt: "",
  files: [],
  revisions: 0,
  forks: 0,
  stars: 0,
  comments: 0,
  said: [],
  earlierSaid: null,
  ...over
})

/** Their POST, answered the way their route does, with what was sent kept for reading. */
const answering = (ok = true) => {
  const sent: Array<{ readonly to: string; readonly body: string }> = []
  const before = globalThis.fetch
  globalThis.fetch = (async (to: string, init: RequestInit) => {
    sent.push({ to: String(to), body: String(init.body) })
    return { ok, status: ok ? 200 : 422, url: "https://gist.github.com/octocat/aaa111" } as Response
  }) as typeof fetch

  return { sent, undo: () => { globalThis.fetch = before } }
}

describe("what a reader does to a gist that reaches GitHub", () => {
  test("offers a box only where GitHub drew one", () => {
    // A reader who is not signed in gets "Sign in to comment" and no form.
    expect(canSay(pageOf(comments))).toBe(true)
    expect(canSay(pageOf(view))).toBe(false)
  })

  test("says something by posting their own form, with their token in it", async () => {
    const github = answering()

    await Effect.runPromise(
      sayOnGist(pageOf(comments), { owner: "octocat", id: "aaa111" }, "well said", () =>
        Effect.succeed(pageOf(view))
      ).pipe(Effect.catch(() => Effect.succeed(null)))
    )
    github.undo()

    expect(github.sent[0]?.to).toBe("/octocat/aaa111/comments")
    const body = new URLSearchParams(github.sent[0]?.body ?? "")
    expect(body.get("authenticity_token")).toBe("a-comment-token")
    expect(body.get("comment[body]")).toBe("well said")
  })

  test("reads the gist again afterwards, rather than parsing what they answered", async () => {
    // What a Rails form post answers with is theirs to change.
    const github = answering()
    let asked = ""

    const read = await Effect.runPromise(
      sayOnGist(pageOf(comments), { owner: "octocat", id: "aaa111" }, "well said", (address) => {
        asked = address
        return Effect.succeed(pageOf(view))
      })
    )
    github.undo()

    expect(asked).toBe("/octocat/aaa111")
    expect(read?.title).toBe("deploy-notes.md")
  })

  test("refuses rather than posting where GitHub drew no box", async () => {
    const github = answering()
    const failed = await Effect.runPromise(
      sayOnGist(pageOf(view), { owner: "octocat", id: "aaa111" }, "hello", () =>
        Effect.succeed(pageOf(view))
      ).pipe(Effect.match({ onSuccess: () => null, onFailure: (cause) => cause.message }))
    )
    github.undo()

    expect(failed).toContain("no comment box")
    expect(github.sent.length).toBe(0)
  })

  test("says what GitHub said when it refuses the words", async () => {
    // Whatever was typed is the one thing that cannot be fetched again, so the box keeps
    // it and the reason.
    const github = answering(false)
    const failed = await Effect.runPromise(
      sayOnGist(pageOf(comments), { owner: "octocat", id: "aaa111" }, "hello", () =>
        Effect.succeed(pageOf(view))
      ).pipe(Effect.match({ onSuccess: () => null, onFailure: (cause) => cause.message }))
    )
    github.undo()

    expect(failed).toBe("GitHub answered 422.")
  })

  test("puts the older comments in above the ones their page drew", () => {
    const read = Effect.runSync(
      withEarlierSaid(
        gist({ earlierSaid: "/octocat/aaa111/load_comments", said: [] }),
        () => Effect.succeed(pageOf(comments))
      )
    )

    expect(read.said.map((one) => one.id)).toEqual(["4425115", "4455779"])
    expect(read.earlierSaid).toContain("before_comment_id=4425115")
  })

  test("reads nothing more for a gist whose page held nothing back", () => {
    let asked = false
    const read = Effect.runSync(
      withEarlierSaid(gist(), () => {
        asked = true
        return Effect.succeed(pageOf(comments))
      })
    )

    expect(asked).toBe(false)
    expect(read.said).toEqual([])
  })

  test("opens the editor on their form, and posts it back", async () => {
    const editing = gistEditing(pageOf(editor))!
    const github = answering()

    const where = await Effect.runPromise(
      editing.save({ ...editing.draft, description: "Changed" })
    )
    github.undo()

    expect(editing.words).toBe("Update secret gist")
    expect(github.sent[0]?.to).toBe("/octocat/aaa111")
    expect(new URLSearchParams(github.sent[0]?.body ?? "").get("gist[description]")).toBe("Changed")
    // Where their own form would have taken the reader: the gist as it now is.
    expect(where).toBe("https://gist.github.com/octocat/aaa111")
  })

  test("offers no editor on a page that carries no such form", () => {
    // Their own editor is still under ours, and a page this cannot read is theirs to keep.
    expect(gistEditing(pageOf(view))).toBeNull()
  })
})
