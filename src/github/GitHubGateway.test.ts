import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  draftWithBotFindings,
  loadFixture,
  mergedWithApproval,
  withADeletedFile
} from "../../tests/fixtures"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { GitHubGateway, layer, layerFromRecordings } from "./GitHubGateway"

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }
const merged: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327417 }
const unknown: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 1 }

const recorded = layerFromRecordings([
  { reference: draft, payloads: draftWithBotFindings },
  { reference: merged, payloads: mergedWithApproval }
])

const askFor = (reference: PullRequestRef) =>
  Effect.gen(function* () {
    const gateway = yield* GitHubGateway
    return yield* gateway.snapshot(reference)
  }).pipe(Effect.provide(recorded))

describe("asking the gateway for a pull request", () => {
  test("answers in domain vocabulary rather than GitHub's", async () => {
    const snapshot = await Effect.runPromise(askFor(draft))

    expect(snapshot.reference).toEqual(draft)
    expect(snapshot.title).toBe("Polish multi-file diffs in Agents window")
    expect(snapshot.state).toBe("draft")
    expect(snapshot.threads).toHaveLength(2)
    expect(snapshot.checks).toHaveLength(29)
  })

  test("carries the description, which is the first thing anyone reads", async () => {
    const snapshot = await Effect.runPromise(askFor(draft))

    expect(snapshot.description.markdown).toContain("## Summary")
    // GitHub renders the markdown itself; taking their HTML is how the
    // description reads exactly as it does on their own page.
    expect(snapshot.description.html).toContain("<h2")
  })

  test("keeps GitHub's rendering of every comment, not just its markdown", async () => {
    const snapshot = await Effect.runPromise(askFor(draft))
    const [comment] = snapshot.threads[0]?.comments ?? []

    expect(comment?.html).toContain("<p")
  })

  test("serves each recorded pull request separately", async () => {
    const snapshot = await Effect.runPromise(askFor(merged))

    expect(snapshot.state).toBe("merged")
    expect(snapshot.reviews).toHaveLength(1)
  })

  test("reads a deleted file, which GitHub calls REMOVED here", async () => {
    const deleting: PullRequestRef = { owner: "fluentai-pro", repo: "fluentai", number: 1934 }
    const snapshot = await Effect.runPromise(
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.snapshot(deleting)
      }).pipe(
        Effect.provide(layerFromRecordings([{ reference: deleting, payloads: withADeletedFile }]))
      )
    )

    expect(snapshot.files.filter((file) => file.changeType === "deleted")).toHaveLength(1)
  })

  test("fails rather than inventing an answer for one it has never seen", async () => {
    const error = await Effect.runPromise(Effect.flip(askFor(unknown)))

    expect(error.reason).toBe("not-recorded")
    expect(error.reference).toEqual(unknown)
  })
})

describe("what the gateway sends to GitHub", () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  type Call = { readonly url: string; readonly headers: Headers }

  const intercept = (respond: (url: string) => Response): ReadonlyArray<Call> => {
    const calls: Array<Call> = []
    const handler = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      calls.push({ url, headers: new Headers(init?.headers) })
      return Promise.resolve(respond(url))
    }
    globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
    return calls
  }

  const payloadFor = (url: string): unknown => {
    if (url.includes("/changes")) return draftWithBotFindings.changes
    if (url.includes("status_checks")) return draftWithBotFindings.statusChecks
    if (url.includes("description")) return draftWithBotFindings.description
    return draftWithBotFindings.mergeBox
  }

  const live = Effect.gen(function* () {
    const gateway = yield* GitHubGateway
    return yield* gateway.snapshot(draft)
  }).pipe(Effect.provide(layer))

  test("asks for every route as JSON, with the header GitHub demands", async () => {
    const calls = intercept((url) => Response.json(payloadFor(url)))

    const snapshot = await Effect.runPromise(live)

    expect(snapshot.title).toBe("Polish multi-file diffs in Agents window")
    expect(calls).toHaveLength(4)
    expect(calls.map((call) => new URL(call.url).pathname).sort()).toEqual([
      "/microsoft/vscode/pull/327442/changes",
      "/microsoft/vscode/pull/327442/page_data/description",
      "/microsoft/vscode/pull/327442/page_data/merge_box",
      "/microsoft/vscode/pull/327442/page_data/status_checks"
    ])
    // GitHub answers 406 to these routes without the XMLHttpRequest header.
    for (const call of calls) {
      expect(call.headers.get("Accept")).toBe("application/json")
      expect(call.headers.get("X-Requested-With")).toBe("XMLHttpRequest")
    }
  })

  test("fetches the diffs GitHub left out of the page it served", async () => {
    // Their own Files tab holds back all but the first few files and asks for
    // the rest as they are scrolled to; a file we have no content for is one of
    // those, not a binary.
    const entry = {
      path: "src/spin.ts",
      isBinary: false,
      isTooBig: false,
      truncatedReason: null,
      diffLines: [
        { type: "HUNK", text: "@@ -1 +1 @@", left: null, right: null },
        { type: "ADDITION", text: "+it spins", left: null, right: 1 }
      ]
    }
    const calls = intercept(() => Response.json([entry]))

    const [got] = await Effect.runPromise(
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.diffs(draft, "abc123", ["src/spin.ts"])
      }).pipe(Effect.provide(layer))
    )

    expect(got?.path).toBe("src/spin.ts")
    expect(got?.diff.lines).toHaveLength(2)

    const asked = new URL(calls[0]?.url ?? "https://example.invalid")
    expect(asked.pathname).toBe("/microsoft/vscode/pull/327442/page_data/diff_entries")
    // Doubly encoded, which is how their own page asks for it: the parameter is
    // a comma-separated list of already-encoded paths.
    expect(asked.searchParams.get("paths")).toBe("src%2Fspin.ts")
    expect(asked.searchParams.get("range")).toBe("abc123")
  })

  /**
   * A commit page embeds content for as many files as fits a byte budget and
   * sends the rest as names. There is no asking for one by name — the route
   * takes a `paths` parameter and ignores it — so the only way to a file is to
   * walk forward through the batches GitHub hands out, which is what their own
   * page does as it is scrolled.
   */
  describe("the files a commit page held back", () => {
    const sha = "c48f531a3b9bea9d6f1d153b26bc5bcb0555ee9f"
    const last = "framework/runloop/src/test-support/agent-runner-harness.ts"

    const walk = (paths: ReadonlyArray<string>) =>
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.commitDiffs(draft, sha, paths)
      }).pipe(Effect.provide(layer))

    const anEntry = (path: string) => ({
      path,
      pathDigest: `${path}@1`,
      status: "MODIFIED",
      linesAdded: 1,
      linesDeleted: 0,
      isBinary: false,
      isTooBig: false,
      truncatedReason: null,
      diffLines: [{ type: "HUNK", text: "@@ -1 +1 @@", left: null, right: null }]
    })

    test("walks the batches until it holds the file that was asked for", async () => {
      const calls = intercept((url) =>
        Response.json(
          url.includes("/diffs?") ? loadFixture("commit-extra-diffs") : loadFixture("commit")
        )
      )

      const got = await Effect.runPromise(walk([last]))

      // Everything the walk passed, not only what was asked for. Whoever asked
      // keeps whatever comes back, so one walk pays for every file before it too.
      expect(got).toHaveLength(14)
      expect(got.map((diff) => diff.path)).toContain(last)
      expect(calls).toHaveLength(2)

      const asked = new URL(calls[1]?.url ?? "https://example.invalid")
      expect(asked.pathname).toBe("/microsoft/vscode/diffs")
      expect(asked.searchParams.get("commit")).toBe(sha)
      expect(asked.searchParams.get("sha1")).toBe("2855fd36b898f24d098b12f337acf6a26dd81242")
      expect(asked.searchParams.get("sha2")).toBe(sha)
      // The cursor is GitHub's own, handed straight back: where they stopped
      // embedding, and what they had spent by then.
      expect(asked.searchParams.get("start_entry")).toBe("8")
      expect(asked.searchParams.get("bytes")).toBe("12664")
      expect(asked.searchParams.get("lines")).toBe("317")
    })

    test("stops at the batch that answers rather than walking to the end", async () => {
      let batches = 0
      const calls = intercept((url) => {
        if (!url.includes("/diffs?")) return Response.json(loadFixture("commit"))
        batches += 1
        return Response.json({
          extraDiffEntries: [anEntry(`batch-${batches}.ts`)],
          loadMore: true,
          asyncDiffLoadInfo: { startIndex: 8 + batches, byteCount: 1, lineShownCount: 1 }
        })
      })

      const got = await Effect.runPromise(walk(["batch-2.ts"]))

      expect(got.map((diff) => diff.path)).toEqual(["batch-1.ts", "batch-2.ts"])
      expect(calls).toHaveLength(3)
    })

    test("gives up rather than walking forever when GitHub keeps saying there is more", async () => {
      let batches = 0
      const calls = intercept((url) => {
        if (!url.includes("/diffs?")) return Response.json(loadFixture("commit"))
        batches += 1
        return Response.json({
          extraDiffEntries: [anEntry(`batch-${batches}.ts`)],
          loadMore: true,
          asyncDiffLoadInfo: { startIndex: 8 + batches, byteCount: 1, lineShownCount: 1 }
        })
      })

      const got = await Effect.runPromise(walk(["never-sent.ts"]))

      // The largest commit on a real pull request took twenty batches, so the
      // ceiling is above any commit and below forever.
      expect(calls.length).toBeLessThanOrEqual(31)
      expect(got.length).toBeLessThanOrEqual(30)
    })

    test("asks GitHub for nothing when the page held nothing back", async () => {
      const whole = {
        payload: {
          commit: {
            oid: sha,
            authoredDate: "2026-07-25T10:21:12.000Z",
            shortMessage: "fix: one file",
            authors: [],
            sha1: "2855fd36b898f24d098b12f337acf6a26dd81242",
            sha2: sha
          },
          moreDiffsToLoad: false,
          diffEntryData: []
        }
      }
      const calls = intercept(() => Response.json(whole))

      const got = await Effect.runPromise(walk(["anything.ts"]))

      expect(got).toEqual([])
      expect(calls).toHaveLength(1)
    })
  })

  describe("closing a pull request", () => {
    const closing = Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      return yield* gateway.close(draft)
    }).pipe(Effect.provide(layer))

    test("posts to the route their own button posts to", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(closing)

      expect(calls).toHaveLength(1)
      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/close_pull_request"
      )
      // The header that stands in for a CSRF token on the writing routes. A
      // request without it comes back refused however good the cookies are.
      expect(calls[0]!.headers.get("GitHub-Verified-Fetch")).toBe("true")
    })

    test("hands back the sentence GitHub refused with, for the card to show", async () => {
      intercept(() =>
        Response.json({ message: "You can't close this pull request" }, { status: 403 })
      )

      const error = await Effect.runPromise(Effect.flip(closing))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("You can't close this pull request")
    })
  })

  describe("the draft it is or is not", () => {
    const asking = (what: "markReady" | "toDraft") =>
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway[what](draft)
      }).pipe(Effect.provide(layer))

    test("marks a draft ready on the route their own button uses", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(asking("markReady"))

      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/mark_ready_for_review"
      )
    })

    test("puts one back into draft on the route that undoes it", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(asking("toDraft"))

      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/convert_to_draft"
      )
    })

    test("repeats what GitHub said when it will not have it", async () => {
      intercept(() => Response.json({ message: "Only the author may do that" }, { status: 403 }))

      const error = await Effect.runPromise(Effect.flip(asking("markReady")))

      expect(error.detail).toBe("Only the author may do that")
    })
  })

  test("reports the status when GitHub turns a request down", async () => {
    intercept(() => new Response("not acceptable", { status: 406 }))

    const error = await Effect.runPromise(Effect.flip(live))

    expect(error.reason).toBe("rejected")
    expect(error.detail).toBe("HTTP 406")
  })

  test("reports a payload it cannot decode instead of rendering half of it", async () => {
    intercept(() => Response.json({ payload: {} }))

    const error = await Effect.runPromise(Effect.flip(live))

    expect(error.reason).toBe("undecodable")
  })
})
