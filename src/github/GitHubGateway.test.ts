import { afterEach, describe, expect, test } from "bun:test"
import type { Settling } from "../domain/Issue"
import { Effect, Option } from "effect"
import {
  draftWithBotFindings,
  loadFixture,
  mergedWithApproval,
  withADeletedFile
} from "../../tests/fixtures"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"
import { layer, layerFromRecordings } from "./GitHubGateway"

/** Their run page, which carries the forms a press is made of. */
const runPage = await Bun.file("tests/fixtures/runPage.html").text()

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
    const deleting: PullRequestRef = { owner: "flowline-labs", repo: "flowline", number: 1934 }
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

  type Call = {
    readonly url: string
    readonly headers: Headers
    readonly method: string
    /**
     * What was sent, decoded where it is JSON and left as it was where it is not.
     *
     * Not everything here is JSON. Re-running a run and cancelling one are Rails
     * forms of theirs posted back, so those two go out form-encoded, and a test that
     * insisted on JSON would fail them inside the intercept rather than in an
     * assertion.
     */
    readonly body: unknown
  }

  /**
   * A body as the test wants to read it: an object where it is JSON, else the string.
   *
   * Told apart by the first character rather than by parsing and seeing what happens.
   * Every JSON body here is one the gateway made with `JSON.stringify`, and the two
   * that are not JSON are form-encoded, which never opens with a brace.
   */
  const sent = (body: unknown): unknown => {
    if (typeof body !== "string") return undefined
    const first = body.trimStart()[0]
    return first === "{" || first === "[" ? JSON.parse(body) : body
  }

  const intercept = (respond: (url: string) => Response): ReadonlyArray<Call> => {
    const calls: Array<Call> = []
    const handler = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      calls.push({
        url,
        headers: new Headers(init?.headers),
        method: init?.method ?? "GET",
        body: sent(init?.body)
      })
      return Promise.resolve(respond(url))
    }
    globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
    return calls
  }

  const payloadFor = (url: string): unknown => {
    if (url.includes("/changes")) return draftWithBotFindings.changes
    if (url.includes("status_checks")) return draftWithBotFindings.statusChecks
    if (url.includes("description")) return draftWithBotFindings.description
    if (url.includes("page_data/header")) return draftWithBotFindings.header
    if (url.includes("issue_comments")) return draftWithBotFindings.issueComments
    // What GitHub answers on a pull request it would not stack, which this one
    // is: a body of `null`, and a 200 rather than a refusal.
    if (url.includes("preview_stack")) return null
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
    expect(calls).toHaveLength(7)
    expect(calls.map((call) => new URL(call.url).pathname).sort()).toEqual([
      "/microsoft/vscode/pull/327442/changes",
      "/microsoft/vscode/pull/327442/page_data/description",
      "/microsoft/vscode/pull/327442/page_data/header",
      "/microsoft/vscode/pull/327442/page_data/issue_comments",
      "/microsoft/vscode/pull/327442/page_data/merge_box",
      // The one route in the batch whose answer nothing depends on, and it is
      // asked for beside the rest rather than after them: it costs a few hundred
      // bytes on a connection already open, and sequencing it behind the merge
      // box to find out whether a stack already exists would cost a round trip.
      "/microsoft/vscode/pull/327442/page_data/preview_stack",
      "/microsoft/vscode/pull/327442/page_data/status_checks"
    ])
    // GitHub answers 406 to these routes without the XMLHttpRequest header.
    for (const call of calls) {
      expect(call.headers.get("Accept")).toBe("application/json")
      expect(call.headers.get("X-Requested-With")).toBe("XMLHttpRequest")
    }
  })

  /**
   * The one thing their pull request payload cannot say, and the one read it
   * costs to find out.
   *
   * `status_checks` reports a job carrying `continue-on-error: true` as
   * `FAILURE` like any other, and the only place the tolerance is written is the
   * run: GitHub concluded run 31641974931 of `flazouh/ghpro-scratch` a success
   * with a failing job in it. So the run behind a failing check is read, once per
   * run rather than once per check, and a green run makes its failures tolerated.
   */
  describe("a check the run around it carried on past", () => {
    const RUN = "30143307647"
    const tolerated = [
      "Code OSS / Compile & Hygiene (pull_request)",
      "Code OSS / Copilot - Check Telemetry (pull_request)"
    ]

    // Their payload as this test needs to read it. The fixtures are held as
    // `unknown` on purpose — they are GitHub's answers and the decoder is the
    // only thing that gets to say what shape they are — and the two fields
    // named here are the two this doctors.
    const payload = draftWithBotFindings.statusChecks as {
      readonly statusChecks: ReadonlyArray<{ readonly displayName: string; readonly state: string }>
    }

    const asFailing = {
      ...payload,
      statusChecks: payload.statusChecks.map((one) =>
        tolerated.includes(one.displayName) ? { ...one, state: "FAILURE" } : one
      )
    }

    // Their own run page with the header icon of a run that passed, which is
    // what a run whose only failures were tolerated is served as.
    const green = runPage.replace(
      '<svg data-component="Octicon" width="22" height="22" class="octicon octicon-x-circle-fill color-fg-danger" aria-label="failed: "',
      '<svg data-component="Octicon" width="22" height="22" class="octicon octicon-check-circle-fill color-fg-success" aria-label="completed successfully: "'
    )

    const answering = (html: string) =>
      intercept((url) =>
        url.includes("/actions/runs/")
          ? new Response(html, { status: 200, headers: { "Content-Type": "text/html" } })
          : Response.json(url.includes("status_checks") ? asFailing : payloadFor(url))
      )

    /**
     * The pull request, and then the second read that softens what it can.
     *
     * Two calls rather than one because the screen makes them as two: the checks
     * are drawn as GitHub reported them and the runs are read behind that first
     * paint. See `loadPullRequest`, which is where the two are put together.
     */
    const softened = Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      const snapshot = yield* gateway.snapshot(draft)
      return { ...snapshot, checks: yield* gateway.tolerated(snapshot.checks) }
    }).pipe(Effect.provide(layer))

    test("is red in the answer the reader waits for, which asks for no run at all", async () => {
      const calls = answering(green)

      const snapshot = await Effect.runPromise(live)

      expect(snapshot.checks.filter((check) => check.state === "failed").map((one) => one.name)).toEqual(
        tolerated
      )
      expect(calls.filter((call) => call.url.includes("/actions/runs/"))).toEqual([])
    })

    test("is said as tolerated, and its run is read once for the two of them", async () => {
      const calls = answering(green)

      const snapshot = await Effect.runPromise(softened)

      expect(
        snapshot.checks.filter((check) => check.state === "tolerated").map((check) => check.name)
      ).toEqual(tolerated)
      expect(snapshot.checks.some((check) => check.state === "failed")).toBe(false)

      const runs = calls.filter((call) => call.url.includes("/actions/runs/"))
      expect(runs).toHaveLength(1)
      expect(new URL(runs[0]?.url ?? "https://example.invalid").pathname).toBe(
        `/microsoft/vscode/actions/runs/${RUN}`
      )
    })

    test("stays failed where the run around it failed too", async () => {
      answering(runPage)

      const snapshot = await Effect.runPromise(softened)

      expect(snapshot.checks.filter((check) => check.state === "tolerated")).toEqual([])
      expect(snapshot.checks.filter((check) => check.state === "failed").map((one) => one.name)).toEqual(
        tolerated
      )
    })

    test("stays failed where the run could not be read at all", async () => {
      intercept((url) =>
        url.includes("/actions/runs/")
          ? new Response("no", { status: 500 })
          : Response.json(url.includes("status_checks") ? asFailing : payloadFor(url))
      )

      const snapshot = await Effect.runPromise(softened)

      expect(snapshot.checks.filter((check) => check.state === "failed")).toHaveLength(2)
    })
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
    const last = "packages/engine/src/test-support/job-runner-harness.ts"

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

  describe("settling a thread", () => {
    const settling = Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      return yield* gateway.settle(draft, "2530224233")
    }).pipe(Effect.provide(layer))

    test("posts to the route their own Resolve press posts to", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(settling)

      expect(calls).toHaveLength(1)
      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/resolve_thread"
      )
      expect(calls[0]!.headers.get("GitHub-Verified-Fetch")).toBe("true")
    })

    /*
     * The number their page data is keyed by, watched on a live press. Their node
     * id — `PRRT_…` — is a different thing that this route refuses.
     */
    test("names the thread by the id their page data is keyed by", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(settling)

      expect(calls[0]!.body).toEqual({ threadId: "2530224233" })
    })

    test("hands back the sentence GitHub refused with", async () => {
      intercept(() => Response.json({ message: "Thread not found" }, { status: 404 }))

      const error = await Effect.runPromise(Effect.flip(settling))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("Thread not found")
    })

    test("opens one again through the route that is the opposite of it", async () => {
      const calls = intercept(() => Response.json({ message: "Thread was successfully unresolved." }))

      await Effect.runPromise(
        Effect.gen(function* () {
          const gateway = yield* GitHubGateway
          return yield* gateway.unsettle(draft, "2530224233")
        }).pipe(Effect.provide(layer))
      )

      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/unresolve_thread"
      )
      expect(calls[0]!.body).toEqual({ threadId: "2530224233" })
    })
  })

  describe("answering inside a thread", () => {
    const answered = {
      thread: {
        id: "2530433098",
        isResolved: false,
        commentsData: {
          comments: [
            {
              author: { login: "flazouh", avatarUrl: "face.png" },
              databaseId: 3724885733,
              body: "Second probe thread: reply here.",
              bodyHTML: "<p>Second probe thread: reply here.</p>",
              createdAt: "2026-08-05T23:50:00Z"
            },
            {
              author: { login: "flazouh", avatarUrl: "face.png" },
              databaseId: 3724892605,
              body: "Fixed in the last commit.",
              bodyHTML: "<p>Fixed in the last commit.</p>",
              createdAt: "2026-08-05T23:52:00Z"
            }
          ]
        }
      }
    }

    const replying = Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      return yield* gateway.reply(draft, "3724885733", "Fixed in the last commit.")
    }).pipe(Effect.provide(layer))

    /*
     * Their own route for a new thread, with `inReplyTo` where the place in the diff
     * would be. Measured: a thread id there is refused with "The comment you are
     * replying to has been deleted.", so the comment's own number is what it takes.
     */
    test("addresses the reply to a comment, on the route a new thread goes to", async () => {
      const calls = intercept(() => Response.json(answered))

      await Effect.runPromise(replying)

      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/create_review_comment"
      )
      expect(calls[0]!.body).toEqual({
        text: "Fixed in the last commit.",
        inReplyTo: "3724885733",
        submitBatch: true
      })
    })

    test("hands back what the thread says now, rendered as GitHub renders it", async () => {
      intercept(() => Response.json(answered))

      const comments = await Effect.runPromise(replying)

      expect(comments).toHaveLength(2)
      expect(comments[1]?.html).toBe("<p>Fixed in the last commit.</p>")
      // Carried so that the next reply in this thread has something to be addressed to.
      expect(comments[1]?.id).toBe("3724892605")
    })

    test("repeats what GitHub said about a reply it would not take", async () => {
      intercept(() =>
        Response.json({ error: "The comment you are replying to has been deleted." }, { status: 422 })
      )

      const error = await Effect.runPromise(Effect.flip(replying))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("The comment you are replying to has been deleted.")
    })
  })

  describe("reopening a closed pull request", () => {
    const reopening = Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      return yield* gateway.reopen(draft)
    }).pipe(Effect.provide(layer))

    test("posts to the route that undoes the close", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(reopening)

      expect(calls).toHaveLength(1)
      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/reopen_pull_request"
      )
      expect(calls[0]!.headers.get("GitHub-Verified-Fetch")).toBe("true")
    })

    test("repeats the refusal, the head branch being the usual reason", async () => {
      intercept(() =>
        Response.json({ message: "The head branch has been deleted" }, { status: 422 })
      )

      const error = await Effect.runPromise(Effect.flip(reopening))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("The head branch has been deleted")
    })
  })

  describe("deleting the branch a merged pull request came from", () => {
    const deleting = Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      return yield* gateway.deleteBranch(draft)
    }).pipe(Effect.provide(layer))

    test("posts to the route their own Delete branch button uses, with no body", async () => {
      const calls = intercept(() => Response.json({ message: "Head ref was successfully deleted" }))

      await Effect.runPromise(deleting)

      expect(calls).toHaveLength(1)
      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/delete_head_ref"
      )
      expect(calls[0]!.method).toBe("POST")
      // Their route takes none, and a body is the one thing that could make this
      // delete something other than the branch this pull request was made from.
      expect(calls[0]!.body).toBeUndefined()
    })

    test("repeats what GitHub said when it will not take the branch away", async () => {
      intercept(() =>
        Response.json({ message: "Branch not deletable, it is protected" }, { status: 422 })
      )

      const error = await Effect.runPromise(Effect.flip(deleting))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("Branch not deletable, it is protected")
    })
  })

  /*
   * Two presses that are not `page_data` routes at all. Their run page carries Rails
   * forms for re-running and cancelling, so a press is their form read off the page
   * and posted back: the route, the `_method`, the token and the
   * `only_failed_check_runs` are all theirs. The measurements are in
   * `docs/spec/github-write-api.md`.
   */
  describe("pressing the buttons a run page carries", () => {
    const run = {
      repo: { owner: "octo-org", repo: "octo-repo" },
      run: "30866145080",
      attempt: null,
      job: null
    }

    /** Their page, then whatever the form posts to. */
    const answering = (html: string) =>
      intercept((url) =>
        url.includes("rerequest_check_suite") || url.includes("/cancel")
          ? new Response("<html>their run page again</html>", { status: 200 })
          : new Response(html, { status: 200, headers: { "Content-Type": "text/html" } })
      )

    const cancelPage = `<a href="/octo-org/octo-repo/actions/workflows/ci.yml">ci</a>
<div class="PageHeader-leadingVisual"><svg aria-label="in progress"></svg></div>
<form data-turbo="false" action="/octo-org/octo-repo/suites/85548529120/cancel" method="post"><input type="hidden" name="_method" value="put" /><input type="hidden" name="authenticity_token" value="a-token-minted-for-this-page" /></form>`

    const rerunning = (which: "all" | "failed") =>
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.rerunRun(run, which)
      }).pipe(Effect.provide(layer))

    const cancelling = Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      return yield* gateway.cancelRun(run)
    }).pipe(Effect.provide(layer))

    test("reads their page first, because the token is minted for it", async () => {
      const calls = answering(runPage)

      await Effect.runPromise(rerunning("failed"))

      expect(calls).toHaveLength(2)
      expect(new URL(calls[0]!.url).pathname).toBe("/octo-org/octo-repo/actions/runs/30866145080")
      expect(calls[0]!.method).toBe("GET")
    })

    /*
     * Form-encoded and not JSON, because it is their own form going back. The
     * `_method=put` is theirs too: Rails reads it out of the body, so a POST that
     * dropped it would not reach the action at all.
     */
    test("posts their failed-jobs form back as the form it is", async () => {
      const calls = answering(runPage)

      await Effect.runPromise(rerunning("failed"))

      const press = calls[1]!
      expect(new URL(press.url).pathname).toBe(
        "/octo-org/octo-repo/actions/runs/30866145080/rerequest_check_suite"
      )
      expect(press.method).toBe("POST")
      expect(press.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded")
      expect(press.body).toBe(
        "_method=put&authenticity_token=another-token-for-the-same-page&only_failed_check_runs=true"
      )
    })

    /*
     * The same route, and the field left out is the whole of the difference. Sending
     * `only_failed_check_runs=false` would be a guess about a parameter GitHub's own
     * form never sends.
     */
    test("leaves the field out where every job is wanted", async () => {
      const calls = answering(runPage)

      await Effect.runPromise(rerunning("all"))

      expect(calls[1]!.body).toBe(
        "_method=put&authenticity_token=a-token-minted-for-this-page"
      )
    })

    test("cancels at the check suite their form names, not at the run", async () => {
      const calls = answering(cancelPage)

      await Effect.runPromise(cancelling)

      expect(new URL(calls[1]!.url).pathname).toBe("/octo-org/octo-repo/suites/85548529120/cancel")
      expect(calls[1]!.body).toBe("_method=put&authenticity_token=a-token-minted-for-this-page")
    })

    /*
     * A finished run carries no cancel form, and that is GitHub's own no. Posting a
     * guess at the route would turn their clear refusal into an error report about a
     * request nobody would have made.
     */
    test("refuses rather than guessing a route where their page offers no form", async () => {
      const calls = answering(runPage)

      const error = await Effect.runPromise(Effect.flip(cancelling))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("GitHub is not offering that on this run")
      expect(calls).toHaveLength(1)
    })

    /*
     * Their answer to both presses is the run page's HTML, so the status code is the
     * whole of what there is to go on: a refusal cannot be told from a success by the
     * body, and the screen reads the run again afterwards to find out what happened.
     */
    test("reports a refusal by its status, the body being their page either way", async () => {
      intercept((url) =>
        url.includes("rerequest_check_suite")
          ? new Response("<html>their run page again</html>", { status: 403 })
          : new Response(runPage, { status: 200 })
      )

      const error = await Effect.runPromise(Effect.flip(rerunning("failed")))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("HTTP 403")
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

  describe("writing a comment on some lines", () => {
    const base = "1111111111111111111111111111111111111111"
    const head = "2222222222222222222222222222222222222222"

    // Built per call rather than shared: a Response body reads once, and a
    // second test handed the same one sees an empty string.
    const written = () =>
      Response.json({
        thread: {
          id: "2511002199",
          isResolved: false,
          commentsData: {
            comments: [
              {
                author: { login: "flazouh", avatarUrl: null },
                body: "This drops the index.",
                bodyHTML: "<p>This drops the index.</p>",
                createdAt: "2026-08-01T22:17:47+02:00"
              }
            ]
          }
        }
      })

    const commenting = (note: {
      readonly line: number
      readonly startLine: number
      readonly side?: "before" | "after"
    }) =>
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.comment(draft, {
          path: "src/index.ts",
          body: "This drops the index.",
          baseSha: base,
          headSha: head,
          side: "after",
          ...note
        })
      }).pipe(Effect.provide(layer))

    /*
     * The field that decides whether anybody ever reads it.
     *
     * `submitBatch: true` posts at once; `false` holds the comment in the
     * reader's own unsubmitted review, where GitHub shows it to nobody and
     * labels it `PENDING`. Both answer 200 with this same thread body, so the
     * response cannot tell the two apart and nothing downstream would notice
     * the day this flipped — only `viewerPendingReview` on the next read says
     * which happened. Verified against a scratch pull request on 1 August 2026;
     * see `docs/spec/github-write-api.md`.
     */
    test("sends the comment rather than holding it in an unsubmitted review", async () => {
      const calls = intercept(written)

      await Effect.runPromise(commenting({ line: 12, startLine: 12 }))

      expect(calls).toHaveLength(1)
      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/create_review_comment"
      )
      expect(calls[0]!.body).toMatchObject({ submitBatch: true })
    })

    test("anchors the comment to the pair of commits it was written against", async () => {
      const calls = intercept(written)

      await Effect.runPromise(commenting({ line: 12, startLine: 12 }))

      // A single line is a range whose ends agree, and their box sends no
      // start at all for one — sending it makes the route refuse the body.
      expect(calls[0]!.body).toMatchObject({
        comparisonStartOid: base,
        comparisonEndOid: head,
        path: "src/index.ts",
        line: 12,
        side: "right",
        subjectType: "line",
        positioning: { type: "line", baseCommitOid: base, headCommitOid: head, line: 12 }
      })
      expect(calls[0]!.body).not.toHaveProperty("startLine")
    })

    test("carries the start of a range twice, which is what their box does", async () => {
      const calls = intercept(written)

      await Effect.runPromise(commenting({ line: 14, startLine: 12 }))

      expect(calls[0]!.body).toMatchObject({
        startLine: 12,
        startSide: "right",
        positioning: { startLine: 12, startSide: "right" }
      })
    })

    /*
     * The half of the diff the remark was written on, said in their word for it.
     *
     * A removed line is numbered in the old file, and that number in the new
     * file is whatever happens to sit there now — so a remark on a deleted line
     * sent as the right side lands on unrelated code, or is refused for a line
     * their route cannot find. The read path has honoured the two halves since
     * `sideOf` in `src/ui/threads.ts`; this is the same fact on the way out.
     *
     * `left` is an inference and not a capture. `docs/spec/github-write-api.md`
     * records this route's own marker for the two halves — `R{line}` for the new
     * file and `L{line}` for the old — and their own box was measured sending
     * `right` in lower case for the new one. Nothing here has read a request
     * carrying the other word off the wire.
     */
    test("puts a remark on a removed line on the old file's numbering", async () => {
      const calls = intercept(written)

      await Effect.runPromise(commenting({ line: 12, startLine: 12, side: "before" }))

      expect(calls[0]!.body).toMatchObject({ side: "left" })
    })

    test("keeps both ends of a range on the side the reader marked out", async () => {
      const calls = intercept(written)

      await Effect.runPromise(commenting({ line: 14, startLine: 12, side: "before" }))

      // A range picked on one half of the diff has both ends numbered in the
      // same file. The two disagreeing would be a range running from the old
      // file to the new one, which is not a thing a reader can mark out here.
      expect(calls[0]!.body).toMatchObject({
        side: "left",
        startSide: "left",
        positioning: { startSide: "left" }
      })
    })

    test("hands back a thread hung on the side the remark was written on", async () => {
      intercept(written)

      const thread = await Effect.runPromise(
        commenting({ line: 12, startLine: 12, side: "before" })
      )

      // What the diff draws it against a moment later, without reading the page
      // again. Anchored to the new file, the remark just posted would appear in
      // the interface on a line it is not about.
      expect(Option.getOrUndefined(thread.at)).toEqual({
        path: "src/index.ts",
        side: "before",
        line: 12,
        startLine: 12
      })
    })

    test("repeats GitHub's refusal rather than reporting a thread nobody has", async () => {
      intercept(() =>
        Response.json({ message: "line 12 is not part of the diff" }, { status: 422 })
      )

      const error = await Effect.runPromise(
        Effect.flip(commenting({ line: 12, startLine: 12 }))
      )

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("line 12 is not part of the diff")
    })
  })

  describe("giving a verdict", () => {
    // The commit the verdict is about. GitHub records it so that an approval
    // cannot be silently inherited by whatever is pushed next.
    const head = "9f0a1b2c3d4e5f60718293a4b5c6d7e8f9012345"

    const reviewing = (verdict: "approve" | "request-changes" | "comment", note: string) =>
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.review(draft, { verdict, note, headSha: head })
      }).pipe(Effect.provide(layer))

    test("approves on the route their own review dialog uses", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(reviewing("approve", ""))

      expect(calls).toHaveLength(1)
      expect(new URL(calls[0]!.url).pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/submit_review"
      )
      // The one write here that is not a POST. Their bundle sends PUT, and the
      // route answers 404 to anything else.
      expect(calls[0]!.method).toBe("PUT")
      expect(calls[0]!.headers.get("GitHub-Verified-Fetch")).toBe("true")
      // Their own dialog sends the event in lower case. `APPROVE`, the shape
      // the rest of GitHub's API would use, is answered with 422 Invalid event.
      expect(calls[0]!.body).toEqual({ body: "", event: "approve", headSha: head })
    })

    test("carries the note, because a verdict without one often means nothing", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(reviewing("request-changes", "The migration drops the index."))

      // A space, not an underscore. `request_changes` is refused.
      expect(calls[0]!.body).toEqual({
        body: "The migration drops the index.",
        event: "request changes",
        headSha: head
      })
    })

    test("repeats GitHub's refusal, which is usually about who is asking", async () => {
      intercept(() =>
        Response.json({ message: "You cannot approve your own pull request" }, { status: 422 })
      )

      const error = await Effect.runPromise(Effect.flip(reviewing("approve", "")))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("You cannot approve your own pull request")
    })
  })

  test("reports the status when GitHub turns a request down", async () => {
    intercept(() => new Response("not acceptable", { status: 406 }))

    const error = await Effect.runPromise(Effect.flip(live))

    expect(error.reason).toBe("rejected")
    expect(error.detail).toBe("HTTP 406")
  })

  /**
   * An organisation requiring single sign-on refuses in two shapes, and until
   * these were told apart both arrived as a fault of ours: a reader who had only
   * to press a button was shown "Something GitHub sends has changed" about a
   * repository they can see the name of. Measured on `octo-org/octo-repo`.
   */
  describe("a repository behind an organisation's single sign-on", () => {
    test("names the wall rather than the refusal, their JSON routes answering 401", async () => {
      intercept(() => new Response("", { status: 401 }))

      const error = await Effect.runPromise(Effect.flip(live))

      expect(error.reason).toBe("sign-on")
      expect(error.detail).toBe("HTTP 401")
    })

    /*
     * Their document routes answer 200 with a sign-on page in place of the page,
     * so the status says nothing and the page itself has to be read. Trimmed from
     * what `GET /octo-org/octo-repo` answered.
     */
    test("names the wall where their document answers with a sign-on page", async () => {
      intercept(
        () =>
          new Response(
            `<html class="html-auth"><body><h1>Single sign-on to octo-org</h1>
             <form action="https://github.com/orgs/octo-org/saml/initiate?return_to=x" method="post"></form>
             </body></html>`,
            { status: 200, headers: { "Content-Type": "text/html" } }
          )
      )

      const error = await Effect.runPromise(
        Effect.flip(
          Effect.gen(function* () {
            const gateway = yield* GitHubGateway
            return yield* gateway.repoHome({ owner: "octo-org", repo: "octo-repo" })
          }).pipe(Effect.provide(layer))
        )
      )

      expect(error.reason).toBe("sign-on")
      expect(error.detail).toBe("single sign-on to octo-org")
    })

    test("still blames the payload where their document simply changed", async () => {
      intercept(() => new Response("<html><body>a page with nothing in it</body></html>"))

      const error = await Effect.runPromise(
        Effect.flip(
          Effect.gen(function* () {
            const gateway = yield* GitHubGateway
            return yield* gateway.repoHome({ owner: "oven-sh", repo: "bun" })
          }).pipe(Effect.provide(layer))
        )
      )

      expect(error.reason).toBe("undecodable")
      expect(error.detail).toBe("no embedded payload")
    })
  })

  test("reports a payload it cannot decode instead of rendering half of it", async () => {
    intercept(() => Response.json({ payload: {} }))

    const error = await Effect.runPromise(Effect.flip(live))

    expect(error.reason).toBe("undecodable")
  })

  describe("starring a repository", () => {
    const repo = { owner: "react", repo: "react" }

    /** The nonce their route refuses without, written where every page writes it. */
    const withANonce = () => {
      const meta = document.createElement("meta")
      meta.setAttribute("name", "fetch-nonce")
      meta.setAttribute("content", "v2:87d025d2")
      document.head.append(meta)
      return () => meta.remove()
    }

    const starring = (to: "starred" | "unstarred") =>
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.star(repo, to)
      }).pipe(Effect.provide(layer))

    test("posts to their own star route, with the nonce that stands in for a token", async () => {
      // Recorded off their own button rather than guessed: no body at all, and
      // the verified-fetch header is what the route checks instead of a form token.
      const undo = withANonce()
      const calls = intercept(() => new Response("", { status: 200 }))

      await Effect.runPromise(starring("starred"))
      undo()

      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe("https://github.com/react/react/star")
      expect(calls[0]?.method).toBe("POST")
      expect(calls[0]?.body).toBeUndefined()
      expect(calls[0]?.headers.get("GitHub-Verified-Fetch")).toBe("true")
      expect(calls[0]?.headers.get("X-Fetch-Nonce")).toBe("v2:87d025d2")
    })

    test("posts to the other route to take the star back", async () => {
      const undo = withANonce()
      const calls = intercept(() => new Response("", { status: 200 }))

      await Effect.runPromise(starring("unstarred"))
      undo()

      expect(calls[0]?.url).toBe("https://github.com/react/react/unstar")
    })

    test("says so rather than pretending, where GitHub turns it down", async () => {
      const undo = withANonce()
      intercept(() => new Response("", { status: 403 }))

      const error = await Effect.runPromise(Effect.flip(starring("starred")))
      undo()

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("HTTP 403")
    })

    test("refuses to send at all where the page carries no nonce", async () => {
      // Their route answers 403 without it, so sending would spend a round trip
      // to be told what is already known here.
      const calls = intercept(() => new Response("", { status: 200 }))

      const error = await Effect.runPromise(Effect.flip(starring("starred")))

      expect(error.reason).toBe("rejected")
      expect(calls).toHaveLength(0)
    })
  })

  /**
   * GitHub keeps two merge routes and each refuses the other's pull request,
   * both with the same sentence: "This pull request is out of date. Refresh the
   * page and try again." Measured against `flazouh/stack-probe`, all four ways
   * round: the ordinary route lands a pull request in no stack and answers 422
   * on a layer of one, and the stack route lands a stack and answers 422 on a
   * pull request in no stack. So the choice cannot be a fallback — a wrong
   * first press tells the reader their branch is stale when it is not.
   */
  describe("merging a pull request that is one layer of a stack", () => {
    const merging = (asStack: boolean) =>
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* asStack
          ? gateway.mergeStack(draft, "SQUASH")
          : gateway.merge(draft, "SQUASH")
      }).pipe(Effect.provide(layer))

    test("goes to the stack route, which is the only one that will have it", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(merging(true))

      expect(new URL(calls[0]?.url ?? "").pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/enqueue_stack"
      )
    })

    test("leaves a pull request in no stack on the ordinary route", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(merging(false))

      expect(new URL(calls[0]?.url ?? "").pathname).toBe(
        "/microsoft/vscode/pull/327442/page_data/merge"
      )
    })

    test("sends the method, and lets GitHub write the commit it would have", async () => {
      const calls = intercept(() => Response.json({}))

      await Effect.runPromise(merging(true))

      expect(calls[0]?.body).toEqual({ mergeMethod: "SQUASH" })
    })

    test("puts GitHub's own refusal in front of whoever pressed", async () => {
      intercept(() =>
        Response.json({ error: "Some of the pull requests in this stack cannot be merged." }, {
          status: 422
        })
      )

      const error = await Effect.runPromise(Effect.flip(merging(true)))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("Some of the pull requests in this stack cannot be merged.")
    })
  })

  /**
   * The only write here that reads before it writes, because its body is a list
   * of pull requests it has no other way of naming.
   *
   * Their route takes GitHub's own numeric ids and nothing else — not the
   * numbers a reader knows the pull requests by — and the one place those ids
   * arrive is the preview itself. Reading it again rather than being handed the
   * chain on the screen is also what makes the write honest about the minutes
   * that passed underneath it: whatever GitHub offers now is what is made.
   */
  describe("making the stack GitHub offers", () => {
    const making = Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      return yield* gateway.makeStack(draft)
    }).pipe(Effect.provide(layer))

    const offering = (preview: unknown, answer = Response.json({})) =>
      intercept((url) => (url.includes("preview_stack") ? Response.json(preview) : answer))

    test("reads the offer again, then posts the ids that came back with it", async () => {
      const calls = offering(loadFixture("preview-stack"))

      await Effect.runPromise(making)

      expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
        "/microsoft/vscode/pull/327442/page_data/preview_stack",
        "/microsoft/vscode/pull/327442/page_data/pull_request_stacks"
      ])
      expect(calls[1]!.method).toBe("POST")
      // The header that stands in for a CSRF token on the writing routes.
      expect(calls[1]!.headers.get("GitHub-Verified-Fetch")).toBe("true")
    })

    test("sends the foundation first, which is not the order the offer arrives in", async () => {
      const calls = offering(loadFixture("preview-stack"))

      await Effect.runPromise(making)

      // GitHub sends the preview newest first — #16 then #15 — and their own
      // button sends the ids the other way up. An id counts upwards from the
      // moment a pull request was opened, so the smaller of the two belongs to
      // the layer underneath.
      expect(calls[1]!.body).toEqual({ pullRequestIds: [4205778980, 4205779207] })
    })

    test("writes nothing at all where GitHub has stopped offering one", async () => {
      // Their answer for a pull request already in a stack, and for one with
      // nothing standing on it. Somebody else pressing first looks like this.
      const calls = offering(null)

      const error = await Effect.runPromise(Effect.flip(making))

      expect(calls).toHaveLength(1)
      expect(error.reason).toBe("rejected")
      expect(error.detail).toContain("no longer")
    })

    test("puts GitHub's own refusal in front of whoever pressed", async () => {
      offering(
        loadFixture("preview-stack"),
        Response.json({ message: "You can't stack these pull requests" }, { status: 403 })
      )

      const error = await Effect.runPromise(Effect.flip(making))

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("You can't stack these pull requests")
    })
  })

  /**
   * Verified against `flazouh/stack-probe` on 5 August 2026, from a signed-in
   * browser: the mutation below raised issues 53 and 54, a hash one digit out was
   * answered 404 `unknownQuery`, and the same body sent as raw query text was
   * refused the same way. So the hash is not optional and cannot be guessed, and
   * the shape here is what a live repository accepted rather than what their
   * bundle implies.
   */
  describe("raising an issue", () => {
    const repo = { owner: "flazouh", repo: "stack-probe" }

    const HASH = "59355b9ba02eb93a5090ead97e4236e9"

    /** The chunk their bundle keeps the hash in, as Relay writes it. */
    const SCRIPT = "https://github.githubassets.com/assets/70943-02ac.js"
    const CHUNK = `params:{id:"${HASH}",metadata:{},name:"createIssueMutation",operationKind:"mutation",text:null}`

    const withANonce = () => {
      const meta = document.createElement("meta")
      meta.setAttribute("name", "fetch-nonce")
      meta.setAttribute("content", "v2:87d025d2")
      document.head.append(meta)
      return () => meta.remove()
    }

    /** The payload their own roots are rendered from, saying whose page this is. */
    const scopedTo = (owner: string, name: string) => {
      const script = document.createElement("script")
      script.setAttribute("type", "application/json")
      script.setAttribute("data-target", "react-app.embeddedData")
      script.textContent = JSON.stringify({
        payload: { scoped_repository: { id: "R_kgDOTndREA", owner, name } }
      })
      document.body.append(script)
      return () => script.remove()
    }

    /** What the browser records having loaded, which is where the hash is found. */
    const loaded = (...names: ReadonlyArray<string>) => {
      const real = performance.getEntriesByType
      performance.getEntriesByType = ((kind: string) =>
        kind === "resource" ? names.map((name) => ({ name })) : []) as typeof real
      return () => {
        performance.getEntriesByType = real
      }
    }

    const standingOn = (
      how: {
        readonly nonce?: boolean
        readonly owner?: string
        readonly name?: string
        readonly scripts?: ReadonlyArray<string>
      } = {}
    ) => {
      const undos = [
        how.nonce === false ? () => {} : withANonce(),
        scopedTo(how.owner ?? repo.owner, how.name ?? repo.repo),
        loaded(...(how.scripts ?? [SCRIPT]))
      ]
      return () => {
        for (const undo of undos) undo()
      }
    }

    /** Their chunk for a script, and the given answer for the write. */
    const answering = (said: unknown, status = 200) => (url: string) =>
      url === SCRIPT ? new Response(CHUNK) : Response.json(said, { status })

    const raised = { data: { createIssue: { issue: { number: 54 }, errors: [] } } }

    const raising = (draft: { readonly title: string; readonly body: string }) =>
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.raise(repo, draft)
      }).pipe(Effect.provide(layer))

    const wrote = (calls: ReadonlyArray<Call>) =>
      calls.find((call) => call.url.includes("_graphql"))

    test("posts their mutation with the hash read out of their own bundle", async () => {
      const undo = standingOn()
      const calls = intercept(answering(raised))

      await Effect.runPromise(raising({ title: "Crash on launch", body: "It stops." }))
      undo()

      const write = wrote(calls)
      expect(write?.url).toBe("https://github.com/_graphql")
      expect(write?.method).toBe("POST")
      expect(write?.body).toEqual({
        persistedQueryName: "createIssueMutation",
        query: HASH,
        variables: {
          input: {
            repositoryId: "R_kgDOTndREA",
            title: "Crash on launch",
            body: "It stops."
          }
        }
      })
    })

    test("sends the headers their route was measured to want", async () => {
      // `text/plain` is what their own form sent, and this route is theirs and
      // undocumented: the headers are the measured ones, not the ones that look right.
      const undo = standingOn()
      const calls = intercept(answering(raised))

      await Effect.runPromise(raising({ title: "Crash on launch", body: "" }))
      undo()

      const write = wrote(calls)
      expect(write?.headers.get("Content-Type")).toBe("text/plain;charset=UTF-8")
      expect(write?.headers.get("GitHub-Verified-Fetch")).toBe("true")
      expect(write?.headers.get("X-Fetch-Nonce")).toBe("v2:87d025d2")
    })

    test("answers with the number GitHub gave it, which nobody could know before", async () => {
      const undo = standingOn()
      intercept(answering(raised))

      const landed = await Effect.runPromise(raising({ title: "Crash on launch", body: "" }))
      undo()

      expect(landed).toEqual({ owner: "flazouh", repo: "stack-probe", number: 54 })
    })

    test("sends the title without the spaces around it", async () => {
      const undo = standingOn()
      const calls = intercept(answering(raised))

      await Effect.runPromise(raising({ title: "  Crash on launch  ", body: "" }))
      undo()

      const sent = wrote(calls)?.body as
        | { readonly variables: { readonly input: { readonly title: string } } }
        | undefined

      expect(sent?.variables.input.title).toBe("Crash on launch")
    })

    test("repeats the refusal GitHub leaves beside the issue it did not make", async () => {
      // Their route answers 200 for this, so reading the status alone would tell
      // the reader their issue was raised.
      const undo = standingOn()
      intercept(
        answering({
          data: { createIssue: { issue: null, errors: [{ message: "Issues are disabled." }] } }
        })
      )

      const error = await Effect.runPromise(
        Effect.flip(raising({ title: "Crash on launch", body: "" }))
      )
      undo()

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("Issues are disabled.")
    })

    test("repeats a refusal at the top of the answer as well", async () => {
      const undo = standingOn()
      intercept(answering({ errors: [{ message: "No query with given identifier known" }], data: {} }))

      const error = await Effect.runPromise(
        Effect.flip(raising({ title: "Crash on launch", body: "" }))
      )
      undo()

      expect(error.reason).toBe("rejected")
      expect(error.detail).toBe("No query with given identifier known")
    })

    test("says nothing was recorded where no chunk names the mutation", async () => {
      // Their bundle is theirs and they reshuffle it weekly. Reported apart from a
      // refusal because it is not one: GitHub was never asked.
      const undo = standingOn({ scripts: ["https://github.githubassets.com/assets/other.js"] })
      const calls = intercept(() => new Response("nothing of the kind"))

      const error = await Effect.runPromise(
        Effect.flip(raising({ title: "Crash on launch", body: "" }))
      )
      undo()

      expect(error.reason).toBe("not-recorded")
      expect(wrote(calls)).toBeUndefined()
    })

    test("refuses to aim at a repository the page does not say it is", async () => {
      // Their app navigates without loading, so a document can outlive the
      // repository it was served for. Raising into the wrong one is silent.
      const undo = standingOn({ owner: "facebook", name: "react" })
      const calls = intercept(answering(raised))

      const error = await Effect.runPromise(
        Effect.flip(raising({ title: "Crash on launch", body: "" }))
      )
      undo()

      expect(error.reason).toBe("not-recorded")
      expect(wrote(calls)).toBeUndefined()
    })

    test("refuses to send at all where the page carries no nonce", async () => {
      const undo = standingOn({ nonce: false })
      const calls = intercept(answering(raised))

      const error = await Effect.runPromise(
        Effect.flip(raising({ title: "Crash on launch", body: "" }))
      )
      undo()

      expect(error.reason).toBe("rejected")
      expect(wrote(calls)).toBeUndefined()
    })

    /**
     * Closing an issue and putting it back, which is the same route again with two of their
     * mutations on it.
     *
     * Measured against their own button on `flazouh/stack-probe` #77 before any of this was
     * written: closed as completed, closed as not planned, reopened. All three answered 200
     * and echoed the state and the reason back, with our own headers rather than theirs.
     */
    describe("settling an issue", () => {
      const issue = { owner: "flazouh", repo: "stack-probe", number: 77 }
      const ID = "I_kwDOTndREM8AAAABLoOHsA"

      const CLOSE_HASH = "73f1d13c27e76443f6a9a809ccb4f6e6"
      const REOPEN_HASH = "2501ecff8b5db13eadd141d3460516cb"

      /** Both mutations in the one chunk, as Relay writes them. */
      const BOTH = [
        `params:{id:"${CLOSE_HASH}",metadata:{},name:"updateIssueStateMutationCloseMutation",operationKind:"mutation",text:null}`,
        `params:{id:"${REOPEN_HASH}",metadata:{},name:"updateIssueStateMutation",operationKind:"mutation",text:null}`
      ].join(",")

      const answeringWith = (said: unknown, status = 200) => (url: string) =>
        url === SCRIPT ? new Response(BOTH) : Response.json(said, { status })

      const closed = {
        data: { closeIssue: { issue: { id: ID, state: "CLOSED", stateReason: "COMPLETED" } } }
      }

      const settling = (settling: Settling) =>
        Effect.gen(function* () {
          const gateway = yield* GitHubGateway
          return yield* gateway.settleIssue(issue, ID, settling)
        }).pipe(Effect.provide(layer))

      const reopening = Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.reopenIssue(issue, ID)
      }).pipe(Effect.provide(layer))

      test("closes it as completed, which is what their own button sends", async () => {
        const undo = standingOn()
        const calls = intercept(answeringWith(closed))

        await Effect.runPromise(settling({ as: "completed" }))
        undo()

        expect(wrote(calls)?.body).toEqual({
          persistedQueryName: "updateIssueStateMutationCloseMutation",
          query: CLOSE_HASH,
          variables: { duplicateIssueId: null, id: ID, newStateReason: "COMPLETED" }
        })
      })

      /*
       * The reason is the whole of why this is two verbs rather than one. "Closed as not
       * planned" is the answer somebody came for when they want to know whether the thing
       * they reported is ever going to be done.
       */
      test("closes it as not planned, which is their word for discarded", async () => {
        const undo = standingOn()
        const calls = intercept(answeringWith(closed))

        await Effect.runPromise(settling({ as: "discarded" }))
        undo()

        const sent = wrote(calls)?.body as
          | { readonly variables: { readonly newStateReason: string } }
          | undefined

        expect(sent?.variables.newStateReason).toBe("NOT_PLANNED")
      })

      /*
       * The third close, and the only one that names a second issue. Measured on the same
       * pair: #77 closed as a duplicate of #78 answered 200 and echoed `duplicateOf` back
       * with #78's number, url and id in it.
       */
      test("closes it as a duplicate, naming the issue it duplicates", async () => {
        const undo = standingOn()
        const calls = intercept(answeringWith(closed))
        const other = "I_kwDOTndREM8AAAABLohEJg"

        await Effect.runPromise(settling({ as: "duplicate", of: other }))
        undo()

        expect(wrote(calls)?.body).toEqual({
          persistedQueryName: "updateIssueStateMutationCloseMutation",
          query: CLOSE_HASH,
          variables: { duplicateIssueId: other, id: ID, newStateReason: "DUPLICATE" }
        })
      })

      /**
       * A comment on an issue, which is the one write their React page gave no way to make.
       *
       * Recorded off their own box on 2026-08-06 and then sent from outside their bundle:
       * their `connections` array is Relay's own bookkeeping and the server wants none of
       * it, and the answer carries the whole comment with GitHub's rendering of it.
       */
      test("says something on an issue, and hands back what GitHub made of it", async () => {
        const undo = standingOn()
        const SAY_HASH = "7ff271bc070626c85985e99dcdf0ff10"
        const calls = intercept((url: string) =>
          url === SCRIPT
            ? new Response(
                `params:{id:"${SAY_HASH}",metadata:{},name:"addCommentMutation",operationKind:"mutation",text:null}`
              )
            : Response.json({
                data: {
                  addComment: {
                    timelineEdge: {
                      node: {
                        id: "IC_kwDOTndREM8AAAABNdVaGw",
                        author: { __typename: "User", login: "flazouh", avatarUrl: "face.png" },
                        body: "Looks right to me.",
                        bodyHTML: '<p dir="auto">Looks right to me.</p>',
                        createdAt: "2026-08-05T22:31:33Z"
                      }
                    }
                  }
                }
              })
        )

        const said = await Effect.runPromise(
          Effect.gen(function* () {
            const gateway = yield* GitHubGateway
            return yield* gateway.sayOnIssue(issue, ID, "Looks right to me.")
          }).pipe(Effect.provide(layer))
        )
        undo()

        expect(wrote(calls)?.body).toEqual({
          persistedQueryName: "addCommentMutation",
          query: SAY_HASH,
          variables: { input: { body: "Looks right to me.", subjectId: ID } }
        })
        expect(said.author.login).toBe("flazouh")
        expect(said.html).toBe('<p dir="auto">Looks right to me.</p>')
      })

      test("puts a closed one back, which is their other mutation and takes no reason", async () => {
        const undo = standingOn()
        const calls = intercept(
          answeringWith({ data: { reopenIssue: { issue: { id: ID, state: "OPEN" } } } })
        )

        await Effect.runPromise(reopening)
        undo()

        expect(wrote(calls)?.body).toEqual({
          persistedQueryName: "updateIssueStateMutation",
          query: REOPEN_HASH,
          variables: { id: ID }
        })
      })

      test("sends the headers their route was measured to want", async () => {
        const undo = standingOn()
        const calls = intercept(answeringWith(closed))

        await Effect.runPromise(settling({ as: "completed" }))
        undo()

        const write = wrote(calls)
        expect(write?.method).toBe("POST")
        expect(write?.headers.get("GitHub-Verified-Fetch")).toBe("true")
        expect(write?.headers.get("X-Fetch-Nonce")).toBe("v2:87d025d2")
      })

      // Their route answers 200 for a refusal, so the status alone would tell a reader the
      // issue had closed while it stayed open under them.
      test("repeats the refusal GitHub leaves in an answer it called 200", async () => {
        const undo = standingOn()
        intercept(answeringWith({ errors: [{ message: "Issue is locked." }], data: {} }))

        const error = await Effect.runPromise(Effect.flip(settling({ as: "completed" })))
        undo()

        expect(error.reason).toBe("rejected")
        expect(error.detail).toBe("Issue is locked.")
      })

      test("says nothing was recorded where no chunk names the mutation", async () => {
        const undo = standingOn({ scripts: ["https://github.githubassets.com/assets/other.js"] })
        const calls = intercept(() => new Response("nothing of the kind"))

        const error = await Effect.runPromise(Effect.flip(settling({ as: "completed" })))
        undo()

        expect(error.reason).toBe("not-recorded")
        expect(wrote(calls)).toBeUndefined()
      })
    })

    describe("who can be mentioned, and what can be referred to", () => {
      const people = [{ type: "user", id: 25705704, login: "flazouh", name: "Alex" }]
      const numbered = {
        suggestions: [{ id: 1, number: 76, title: "Conflicted files", type: "pull_request" }]
      }

      const asking = Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.suggesting({ owner: "flazouh", repo: "stack-probe" })
      }).pipe(Effect.provide(layer))

      test("reads both lists in one go, from the route their own box asks", async () => {
        const calls = intercept((url: string) =>
          Response.json(url.includes("mention_suggester") ? people : numbered)
        )

        const offered = await Effect.runPromise(asking)

        expect(calls.map((call) => new URL(call.url).search).sort()).toEqual([
          "?issue_suggester=1&repository=stack-probe&user_id=flazouh",
          "?mention_suggester=1&repository=stack-probe&user_id=flazouh"
        ])
        expect(offered.people).toEqual([{ login: "flazouh", name: "Alex" }])
        expect(offered.numbered).toEqual([
          { number: 76, title: "Conflicted files", state: "open" }
        ])
      })

      // Measured: the route answers 406 without this header, whatever Accept says.
      test("sends the header without which the route answers 406", async () => {
        const calls = intercept((url: string) =>
          Response.json(url.includes("mention_suggester") ? people : numbered)
        )

        await Effect.runPromise(asking)

        for (const call of calls) {
          expect(call.headers.get("X-Requested-With")).toBe("XMLHttpRequest")
        }
      })

      test("offers nobody where a list came back in a shape it did not have", async () => {
        intercept((url: string) =>
          url.includes("mention_suggester")
            ? Response.json({ something: "else" })
            : Response.json(numbered)
        )

        const offered = await Effect.runPromise(asking)

        expect(offered.people).toEqual([])
        expect(offered.numbered).toHaveLength(1)
      })
    })

    describe("a file pasted into a box", () => {
      const POLICY = "https://github.com/upload/policies/assets"
      const STORE = "https://github-production-user-asset-6210df.s3.amazonaws.com"
      const HREF = "https://github.com/user-attachments/assets/db4f4987"

      const policy = {
        upload_url: STORE,
        header: {},
        form: { key: "25705704/632059734.png", acl: "private", policy: "eyJleHBpcm" },
        asset: { id: 632059734, name: "shot.png", href: HREF },
        asset_upload_url: "/upload/assets/632059734",
        asset_upload_authenticity_token: "frnp-rhRhqWmm46vVa4qzn"
      }

      /** Their three answers in order, and the bodies kept as sent rather than parsed. */
      const takingAFile = (
        how: { readonly policy?: Response; readonly store?: Response; readonly told?: Response } = {}
      ) => {
        const calls: Array<{ url: string; method: string; headers: Headers; form?: FormData }> = []
        const real = globalThis.fetch
        const handler = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const url = String(input)
          calls.push({
            url,
            method: init?.method ?? "GET",
            headers: new Headers(init?.headers),
            form: init?.body instanceof FormData ? init.body : undefined
          })
          if (url === POLICY) return Promise.resolve(how.policy ?? Response.json(policy, { status: 201 }))
          if (url === STORE) return Promise.resolve(how.store ?? new Response(null, { status: 204 }))
          return Promise.resolve(how.told ?? Response.json({ name: "shot.png", href: HREF }))
        }
        globalThis.fetch = Object.assign(handler, { preconnect: real.preconnect })
        return calls
      }

      const numbered = () => {
        const meta = document.createElement("meta")
        meta.setAttribute("name", "octolytics-dimension-repository_id")
        meta.setAttribute("content", "1316442384")
        document.head.append(meta)
        return () => meta.remove()
      }

      const file = new File([new Uint8Array(70)], "shot.png", { type: "image/png" })

      const uploading = Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.upload(repo, file)
      }).pipe(Effect.provide(layer))

      test("asks for a policy, posts the bytes, and tells GitHub they landed", async () => {
        const undo = standingOn()
        const alsoUndo = numbered()
        const calls = takingAFile()

        const said = await Effect.runPromise(uploading)
        undo()
        alsoUndo()

        expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
          `POST ${POLICY}`,
          `POST ${STORE}`,
          "PUT https://github.com/upload/assets/632059734"
        ])
        expect(said).toEqual({ name: "shot.png", href: HREF })
      })

      test("names the file to their policy route the way their own box does", async () => {
        const undo = standingOn()
        const alsoUndo = numbered()
        const calls = takingAFile()

        await Effect.runPromise(uploading)
        undo()
        alsoUndo()

        const asked = calls[0]?.form
        expect(asked?.get("repository_id")).toBe("1316442384")
        expect(asked?.get("name")).toBe("shot.png")
        expect(asked?.get("size")).toBe("70")
        expect(asked?.get("content_type")).toBe("image/png")
        // Measured: 422 without it, as on every other write here.
        expect(calls[0]?.headers.get("GitHub-Verified-Fetch")).toBe("true")
      })

      test("sends their signed fields to the bucket unchanged, and the bytes last", async () => {
        const undo = standingOn()
        const alsoUndo = numbered()
        const calls = takingAFile()

        await Effect.runPromise(uploading)
        undo()
        alsoUndo()

        const sent = [...(calls[1]?.form?.keys() ?? [])]
        expect(sent).toEqual(["key", "acl", "policy", "file"])
        expect(calls[2]?.form?.get("authenticity_token")).toBe("frnp-rhRhqWmm46vVa4qzn")
      })

      test("repeats what GitHub said about a file it would not take", async () => {
        const undo = standingOn()
        const alsoUndo = numbered()
        takingAFile({
          policy: Response.json({ message: "Yowza, that's a big file." }, { status: 422 })
        })

        const error = await Effect.runPromise(Effect.flip(uploading))
        undo()
        alsoUndo()

        expect(error.reason).toBe("rejected")
        expect(error.detail).toBe("Yowza, that's a big file.")
      })

      test("refuses to aim at a repository this page does not say it is", async () => {
        // The number is in a meta tag, which their soft navigation leaves standing. The
        // payload is what says whose page this is.
        const undo = standingOn({ owner: "facebook", name: "react" })
        const alsoUndo = numbered()
        const calls = takingAFile()

        const error = await Effect.runPromise(Effect.flip(uploading))
        undo()
        alsoUndo()

        expect(error.reason).toBe("not-recorded")
        expect(calls).toHaveLength(0)
      })

      test("keeps the address from the policy where the last answer says nothing", async () => {
        const undo = standingOn()
        const alsoUndo = numbered()
        takingAFile({ told: new Response("", { status: 200 }) })

        const said = await Effect.runPromise(uploading)
        undo()
        alsoUndo()

        expect(said.href).toBe(HREF)
      })
    })

  })

})
