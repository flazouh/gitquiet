import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { forgetFlights } from "./flight"
import { askedAbout, askingFor, payloadsThroughWorker } from "./throughTheWorker"

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }

describe("the question the page asks the worker", () => {
  test("names the pull request at the other end", () => {
    expect(askedAbout(askingFor(draft))).toEqual(Option.some(draft))
  })

  /*
   * A worker hears every message any part of the extension sends. Answering one
   * that was not this question would take an answer away from whoever it was for.
   */
  test("is not confused with anybody else's message", () => {
    expect(askedAbout({ what: "something else" })).toEqual(Option.none())
    expect(askedAbout("hello")).toEqual(Option.none())
    expect(askedAbout(null)).toEqual(Option.none())
  })

  /*
   * The reply is promised before the read starts. A message wearing the right name
   * with nothing behind it used to be answered by silence: the read died on a
   * reference that was not there and the page waited on a channel nobody wrote to.
   */
  test("is not this question at all without a pull request in it", () => {
    expect(askedAbout({ what: askingFor(draft).what })).toEqual(Option.none())
    expect(askedAbout({ ...askingFor(draft), reference: { owner: "microsoft" } })).toEqual(
      Option.none()
    )
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

  /** A document still arriving at the pull request being read, which is the case. */
  const arriving = (at: PullRequestRef = draft): void => {
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true })
    window.history.replaceState({}, "", `/${at.owner}/${at.repo}/pull/${at.number}`)
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

  /*
   * The other half of the rule, and the one that keeps a read ahead fast. Resting on
   * a row of a list starts a read of a pull request nobody has pressed, on a list
   * page that may still be loading — and the worker was told nothing about a row.
   * Sent there it would be a message round trip and a set of requests the press that
   * follows could not reuse, which is the shape `readAhead.ts` exists to keep out.
   */
  test("goes straight to GitHub for a pull request this document is not opening", async () => {
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true })
    window.history.replaceState({}, "", "/pulls")
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
