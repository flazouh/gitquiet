import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { draftWithBotFindings, mergedWithApproval } from "../../tests/fixtures"
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

  test("serves each recorded pull request separately", async () => {
    const snapshot = await Effect.runPromise(askFor(merged))

    expect(snapshot.state).toBe("merged")
    expect(snapshot.reviews).toHaveLength(1)
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
    return draftWithBotFindings.mergeBox
  }

  const live = Effect.gen(function* () {
    const gateway = yield* GitHubGateway
    return yield* gateway.snapshot(draft)
  }).pipe(Effect.provide(layer))

  test("asks for all three routes as JSON, with the header GitHub demands", async () => {
    const calls = intercept((url) => Response.json(payloadFor(url)))

    const snapshot = await Effect.runPromise(live)

    expect(snapshot.title).toBe("Polish multi-file diffs in Agents window")
    expect(calls).toHaveLength(3)
    expect(calls.map((call) => new URL(call.url).pathname).sort()).toEqual([
      "/microsoft/vscode/pull/327442/changes",
      "/microsoft/vscode/pull/327442/page_data/merge_box",
      "/microsoft/vscode/pull/327442/page_data/status_checks"
    ])
    // GitHub answers 406 to these routes without the XMLHttpRequest header.
    for (const call of calls) {
      expect(call.headers.get("Accept")).toBe("application/json")
      expect(call.headers.get("X-Requested-With")).toBe("XMLHttpRequest")
    }
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
