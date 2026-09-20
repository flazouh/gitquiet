import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { forgetEverything, installStorage } from "../../tests/storage"
import { GitHubGateway } from "../ports/GitHubGateway"
import { layer } from "./GitHubGateway"

installStorage()
beforeEach(forgetEverything)

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/**
 * Reading a repository's whole tree, which a Follow out of a diff needs.
 *
 * Every visit used to pay for it. The paths are how a borrowed name's specifier
 * is resolved — `./paths` against what the repository really has — and the
 * answer is megabytes on anything large: measured on
 * `OpenRouterTeam/openrouter-web`, holding the key over an imported name waited
 * about thirty seconds, and waited again on the next visit to the same pull
 * request because nothing kept it.
 */
const repo = { owner: "OpenRouterTeam", repo: "openrouter-web" }

const intercept = (): ReadonlyArray<string> => {
  const asked: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    asked.push(url)
    return Promise.resolve(
      new Response(JSON.stringify({ paths: ["src/one.ts", "src/two.ts"] }), {
        headers: { "content-type": "application/json" }
      })
    )
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return asked
}

/**
 * A beat, because the tree is written down on a detached fiber.
 *
 * A reader waiting on the paths should not also wait on them being filed, so
 * the write is forked — which means a test asking again in the same tick asks
 * before anything was kept. A second visit is a page load later; this is that,
 * in the smallest honest amount of time.
 */
const settled = () => new Promise((go) => setTimeout(go, 0))

const readTree = (sha: string) =>
  Effect.runPromise(
    GitHubGateway.pipe(
      Effect.flatMap((gateway) => gateway.treePaths(repo, sha)),
      Effect.provide(layer)
    )
  )

describe("a commit's tree", () => {
  test("is read once and kept, so a second visit waits for nothing", async () => {
    const asked = intercept()

    const first = await readTree("abc123")
    await settled()
    const second = await readTree("abc123")

    expect(first).toEqual(["src/one.ts", "src/two.ts"])
    expect(second).toEqual(first)
    // The whole point: the second visit asked GitHub nothing.
    expect(asked.filter((url) => url.includes("/tree-list/"))).toHaveLength(1)
  })

  test("is read again for a commit nobody has read", async () => {
    // Kept under the sha, so a push is a different tree and never the old one.
    const asked = intercept()

    await readTree("abc123")
    await settled()
    await readTree("def456")

    expect(asked.filter((url) => url.includes("/tree-list/"))).toHaveLength(2)
  })
})
