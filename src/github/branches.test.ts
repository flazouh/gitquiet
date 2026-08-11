import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import { GitHubGateway } from "../ports/GitHubGateway"
import { layer } from "./GitHubGateway"

/**
 * Reading the two branch names a stack is found by matching.
 *
 * The merge box is asked rather than the changes route because both carry them
 * and only one is cheap: five kilobytes against as much as a megabyte, measured
 * on a real pull request of two thousand files.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const intercept = (respond: (url: string) => Response): ReadonlyArray<string> => {
  const urls: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    urls.push(String(input))
    return Promise.resolve(respond(String(input)))
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return urls
}

const reference = { owner: "flazouh", repo: "stack-probe", number: 3 }

const asking = Effect.gen(function* () {
  const gateway = yield* GitHubGateway
  return yield* gateway.branches(reference)
}).pipe(Effect.provide(layer))

/**
 * A real recorded merge box, with only the branch names varied.
 *
 * Hand-built payloads pass or fail on whether the fixture happened to satisfy
 * the schema, which is a test of the fixture. This is the payload GitHub sent.
 */
const recorded = draftWithBotFindings.mergeBox as {
  readonly pullRequest: Record<string, unknown>
}

const mergeBox = (branches: Record<string, unknown>) => ({
  ...recorded,
  pullRequest: { ...recorded.pullRequest, ...branches }
})

const withoutBranches = () => {
  const { baseRefName, headRefName, ...rest } = recorded.pullRequest
  return { ...recorded, pullRequest: rest }
}

describe("reading a pull request's branches", () => {
  test("asks the merge box, which is the cheap half of what knows them", async () => {
    const urls = intercept(() =>
      Response.json(mergeBox({ baseRefName: "stack-2", headRefName: "stack-3" }))
    )

    await Effect.runPromise(asking)

    expect(new URL(urls[0]!).pathname).toBe("/flazouh/stack-probe/pull/3/page_data/merge_box")
  })

  test("gives back both names", async () => {
    intercept(() => Response.json(mergeBox({ baseRefName: "stack-2", headRefName: "stack-3" })))

    const branches = await Effect.runPromise(asking)

    expect(branches).toEqual(Option.some({ baseBranch: "stack-2", headBranch: "stack-3" }))
  })

  test("has none rather than failing when the payload left them out", async () => {
    // One row that will not be stacked. Failing here would cost the reader the
    // whole Working Set to spare them one flat row.
    intercept(() => Response.json(withoutBranches()))

    const branches = await Effect.runPromise(asking)

    expect(branches).toEqual(Option.none())
  })

  test("has none when GitHub sent them as null", async () => {
    intercept(() => Response.json(mergeBox({ baseRefName: null, headRefName: null })))

    expect(await Effect.runPromise(asking)).toEqual(Option.none())
  })

  test("still reports a refusal, which is not the same as an absent branch", async () => {
    intercept(() => new Response("nope", { status: 404 }))

    const error = await Effect.runPromise(Effect.flip(asking))

    expect(error.reason).toBe("rejected")
  })
})
