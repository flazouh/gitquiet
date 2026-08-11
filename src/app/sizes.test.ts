import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { Size } from "../domain/workingSet"
import { layer } from "../github/GitHubGateway"
import { layerSizes } from "./sizes"

/**
 * What counting the layers of a chain asks GitHub for, and what it does when one
 * of those counts does not arrive.
 *
 * Driven through the real gateway with `fetch` intercepted, as every read here
 * is: the route is part of the behaviour, and a hand-written fake gateway would
 * agree with whatever the code currently sends.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const intercept = (respond: (url: string) => Response): ReadonlyArray<string> => {
  const asked: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    asked.push(url)
    return Promise.resolve(respond(url))
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return asked
}

const aDiffstat = (added: number, deleted: number): Response =>
  new Response(
    JSON.stringify({
      diffstat: { linesAdded: added, linesDeleted: deleted, linesChanged: added + deleted }
    }),
    { headers: { "content-type": "application/json" } }
  )

const at = (number: number): PullRequestRef => ({
  owner: "flazouh",
  repo: "stack-probe",
  number
})

const count = (references: ReadonlyArray<PullRequestRef>) => {
  const said = new Map<number, Size>()
  return Effect.runPromise(
    layerSizes(references, (number, size) => void said.set(number, size)).pipe(
      Effect.provide(layer),
      Effect.map(() => said)
    )
  )
}

describe("counting the layers of a chain", () => {
  test("asks the diffstat route once for each layer", async () => {
    // Seventy bytes each, and the only route GitHub has that says how big a pull
    // request is without sending it.
    const asked = intercept(() => aDiffstat(120, 8))

    await count([at(15), at(16)])

    expect(asked).toEqual([
      "https://github.com/flazouh/stack-probe/pull/15/page_data/diffstat",
      "https://github.com/flazouh/stack-probe/pull/16/page_data/diffstat"
    ])
  })

  test("says each count under the number of the pull request it is about", async () => {
    intercept((url) => (url.includes("/pull/15/") ? aDiffstat(90, 4) : aDiffstat(7, 0)))

    const said = await count([at(15), at(16)])

    expect(said.get(15)).toEqual({ added: 90, deleted: 4 })
    expect(said.get(16)).toEqual({ added: 7, deleted: 0 })
  })

  test("keeps no count for a layer whose read failed", async () => {
    // A row without a count is what every row looks like for the first second.
    // One labelled `+0 −0` would call a four thousand line change nothing, and a
    // strip that failed over it would lose the rows as well.
    intercept((url) =>
      url.includes("/pull/15/") ? new Response("no", { status: 500 }) : aDiffstat(7, 0)
    )

    const said = await count([at(15), at(16)])

    expect(said.has(15)).toBe(false)
    expect(said.get(16)).toEqual({ added: 7, deleted: 0 })
  })
})
