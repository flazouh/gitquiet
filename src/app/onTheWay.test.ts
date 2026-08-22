import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { forgetFlights } from "../github/flight"
import { forgetTheWay, goingTo, payloadsOnTheWay } from "./onTheWay"

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }

describe("where a tab is going", () => {
  test("is the pull request in the address, where there is one", () => {
    expect(goingTo("https://github.com/microsoft/vscode/pull/327442")).toEqual(
      Option.some(draft)
    )
  })

  test("is nothing for the tabs beside it, which stay GitHub's", () => {
    expect(goingTo("https://github.com/microsoft/vscode/pull/327442/files")).toEqual(Option.none())
  })

  test("is nothing for their other pages", () => {
    expect(goingTo("https://github.com/microsoft/vscode/issues/12")).toEqual(Option.none())
    expect(goingTo("https://github.com/pulls")).toEqual(Option.none())
  })

  /*
   * A worker hears about every navigation in the browser, not only the ones on
   * github.com. Somebody else's page with the same path is not a pull request, and
   * asking github.com about it would be a request the reader never made.
   */
  test("is nothing on another host wearing the same path", () => {
    expect(goingTo("https://example.com/microsoft/vscode/pull/327442")).toEqual(Option.none())
    expect(goingTo("not an address at all")).toEqual(Option.none())
  })
})

describe("reading a pull request on the way to it", () => {
  const realFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = realFetch
    forgetTheWay()
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
      const url = String(input)
      asked.push(url)
      return Promise.resolve(Response.json(payloadFor(url)))
    }
    globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
    return asked
  }

  test("asks GitHub for the seven routes their own page asks for", async () => {
    const asked = intercept()

    const payloads = await Effect.runPromise(payloadsOnTheWay(draft))

    expect(asked).toHaveLength(7)
    expect(payloads.changes).toBeDefined()
  })

  /*
   * The whole point of the file. The navigation starts the read and the page asks
   * for it a second or two later; if that second ask went to GitHub, the worker
   * would have bought the reader nothing and cost GitHub twice.
   */
  test("hands the same payloads to whoever asks next, without asking again", async () => {
    const asked = intercept()

    const first = await Effect.runPromise(payloadsOnTheWay(draft))
    const second = await Effect.runPromise(payloadsOnTheWay(draft))

    expect(asked).toHaveLength(7)
    expect(second).toBe(first)
  })

  test("keeps them apart by pull request", async () => {
    const asked = intercept()
    const other: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327417 }

    await Effect.runPromise(payloadsOnTheWay(draft))
    await Effect.runPromise(payloadsOnTheWay(other))

    expect(asked).toHaveLength(14)
  })

  /*
   * A failure is not held. GitHub was down or the network was, both of which are
   * true for a moment rather than for the half minute a good answer is kept, and
   * the page asking next should be asking GitHub rather than being told what
   * failed before it arrived.
   */
  test("holds nothing from a read that failed", async () => {
    const asked: Array<string> = []
    const handler = (input: RequestInfo | URL): Promise<Response> => {
      asked.push(String(input))
      return Promise.resolve(new Response("no", { status: 403 }))
    }
    globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })

    const first = await Effect.runPromise(Effect.flip(payloadsOnTheWay(draft)))
    forgetFlights()
    await Effect.runPromise(Effect.flip(payloadsOnTheWay(draft)))

    expect(first.reason).toBe("rejected")
    expect(asked.length).toBeGreaterThan(7)
  })
})
