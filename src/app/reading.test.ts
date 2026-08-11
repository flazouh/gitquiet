import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import { forgetEverything, installStorage } from "../../tests/storage"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { layer } from "../github/GitHubGateway"
import { loadPullRequest } from "./pullRequest"

installStorage()
beforeEach(forgetEverything)

const reference: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 1 }

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/**
 * GitHub, answering slowly and counting.
 *
 * Slowly on purpose: reading a pull request is six routes and a second or so, and
 * the whole question here is what happens to a second reader who turns up while
 * the first is still waiting.
 */
const counting = (): { readonly changes: () => number } => {
  let changes = 0

  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      if (url.includes("/changes")) changes += 1

      const body = url.includes("/page_data/status_checks")
        ? draftWithBotFindings.statusChecks
        : url.includes("/page_data/merge_box")
          ? draftWithBotFindings.mergeBox
          : url.includes("/page_data/description")
            ? draftWithBotFindings.description
            : url.includes("/page_data/header")
              ? draftWithBotFindings.header
              : url.includes("/page_data/issue_comments")
                ? draftWithBotFindings.issueComments
                : draftWithBotFindings.changes

      return new Promise((answer) => setTimeout(() => answer(Response.json(body)), 30))
    },
    { preconnect: realFetch.preconnect }
  )

  return { changes: () => changes }
}

const read = () => loadPullRequest(reference).pipe(Effect.provide(layer))

describe("reading one pull request twice at once", () => {
  test("asks GitHub for it once, so resting on a row and then pressing it is one read", async () => {
    // What every arrival at a card is now made of: the pointer rests on the row
    // and the read starts, then the press lands a moment later and asks for the
    // same pull request. Two reads means the reader waits out the whole of the
    // second one and the first was for nothing — which is the read-ahead not
    // working, however busy it looks in the network panel.
    const asked = counting()

    const both = await Effect.runPromise(Effect.all([read(), read()], { concurrency: 2 }))

    expect(asked.changes()).toBe(1)
    expect(both[0].snapshot.reference).toEqual(reference)
    expect(both[1].snapshot.reference).toEqual(reference)
  })

  test("asks again once the first read is over, since by then it may have moved", async () => {
    // Only reads in the air are folded together. A card re-read after a merge or a
    // comment is a question about now, and answering it out of a read that
    // finished before the write would show the reader their own change missing.
    const asked = counting()

    await Effect.runPromise(read())
    await Effect.runPromise(read())

    expect(asked.changes()).toBe(2)
  })
})
