import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { forgetFlights } from "./flight"
import { askingFor, isAsked, payloadsThroughWorker } from "./throughTheWorker"

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }

describe("the question the page asks the worker", () => {
  test("is recognised at the other end", () => {
    expect(isAsked(askingFor(draft))).toBe(true)
  })

  /*
   * A worker hears every message any part of the extension sends. Answering one
   * that was not this question would take an answer away from whoever it was for.
   */
  test("is not confused with anybody else's message", () => {
    expect(isAsked({ what: "something else" })).toBe(false)
    expect(isAsked("hello")).toBe(false)
    expect(isAsked(null)).toBe(false)
  })
})

describe("reading the seven routes from a page", () => {
  const realFetch = globalThis.fetch
  const realBrowser = (globalThis as { browser?: unknown }).browser

  afterEach(() => {
    globalThis.fetch = realFetch
    Object.assign(globalThis, { browser: realBrowser })
    forgetFlights()
  })

  const payloadFor = (url: string): unknown => {
    if (url.includes("/changes")) return draftWithBotFindings.changes
    if (url.includes("status_checks")) return draftWithBotFindings.statusChecks
    if (url.includes("description")) return draftWithBotFindings.description
    if (url.includes("page_data/header")) return draftWithBotFindings.header
    if (url.includes("issue_comments")) return draftWithBotFindings.issueComments
    if (url.includes("preview_stack")) return null
    return draftWithBotFindings.mergeBox
  }

  const intercept = (): ReadonlyArray<string> => {
    const asked: Array<string> = []
    const handler = (input: RequestInfo | URL): Promise<Response> => {
      asked.push(String(input))
      return Promise.resolve(Response.json(payloadFor(input as string)))
    }
    globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
    return asked
  }

  /** A worker that answers, and a note of what it was asked. */
  const worker = (answer: unknown): Array<unknown> => {
    const heard: Array<unknown> = []
    Object.assign(globalThis, {
      browser: {
        runtime: {
          sendMessage: (message: unknown) => {
            heard.push(message)
            return Promise.resolve(answer)
          }
        }
      }
    })
    return heard
  }

  /** What `document.readyState` says while a document is still arriving. */
  const arriving = (): void => {
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true })
  }

  const finished = (): void => {
    Object.defineProperty(document, "readyState", { value: "complete", configurable: true })
  }

  /*
   * The rule this file exists for. A press and a Back happen on a document that
   * finished loading long ago, the worker has been told nothing about either, and
   * waking one took 587 milliseconds when this extension last depended on it.
   */
  test("goes straight to GitHub on a document that has finished loading", async () => {
    finished()
    const asked = intercept()
    const heard = worker({ ok: true, payloads: draftWithBotFindings })

    await Effect.runPromise(payloadsThroughWorker(draft))

    expect(heard).toHaveLength(0)
    expect(asked).toHaveLength(7)
  })

  test("asks the worker while the document is still arriving, and asks GitHub nothing", async () => {
    arriving()
    const asked = intercept()
    const heard = worker({ ok: true, payloads: draftWithBotFindings })

    const payloads = await Effect.runPromise(payloadsThroughWorker(draft))

    expect(heard).toEqual([askingFor(draft)])
    expect(asked).toHaveLength(0)
    expect(payloads.changes).toBe(draftWithBotFindings.changes)
  })

  /*
   * The worker's failure has to arrive as the page's own failure, because the card
   * the reader sees is made of the reason: a single sign-on names the organisation
   * and offers a way through it, an outage says GitHub is having trouble.
   */
  test("turns what the worker could not read back into the failure this page would have raised", async () => {
    arriving()
    intercept()
    worker({ ok: false, route: "/changes", reason: "sign-on", detail: "HTTP 401" })

    const failure = await Effect.runPromise(Effect.flip(payloadsThroughWorker(draft)))

    expect(failure.reason).toBe("sign-on")
    expect(failure.route).toBe("/changes")
    expect(failure.reference).toEqual(draft)
  })

  /*
   * There is no worker in a test, in a page whose extension was updated under it, or
   * where messaging is refused. All three are the same thing from here, and none of
   * them is worth a pull request.
   */
  test("reads GitHub itself where no worker answers", async () => {
    arriving()
    const asked = intercept()
    Object.assign(globalThis, {
      browser: { runtime: { sendMessage: () => Promise.reject(new Error("no worker")) } }
    })

    const payloads = await Effect.runPromise(payloadsThroughWorker(draft))

    expect(asked).toHaveLength(7)
    expect(payloads.changes).toBeDefined()
  })

  test("reads GitHub itself where the answer is in a shape it does not know", async () => {
    arriving()
    const asked = intercept()
    worker("something else entirely")

    await Effect.runPromise(payloadsThroughWorker(draft))

    expect(asked).toHaveLength(7)
  })
})
