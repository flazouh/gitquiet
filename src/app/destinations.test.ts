import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { loadFixture } from "../../tests/fixtures"
import { layer } from "../github/GitHubGateway"
import { loadActivity, loadRepositories } from "./destinations"

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

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })

const answering = (url: string): Response =>
  url.includes("/_filter/repositories")
    ? json(loadFixture("filtered-repositories"))
    : url.includes("received_events")
      ? json(loadFixture("received-events"))
      : new Response("no", { status: 404 })

describe("reading every repository the reader has", () => {
  test("asks their own filter route for the whole list", async () => {
    const asked = intercept(answering)

    await Effect.runPromise(loadRepositories().pipe(Effect.provide(layer)))

    // One request, empty query: 154 repositories cost 44 kilobytes on a live account, so
    // narrowing the list is typing rather than another round trip.
    expect(asked.filter((url) => url.includes("/_filter/repositories"))).toHaveLength(1)
    expect(asked[0]).toContain("q=&filter_value=")
  })

  test("puts the repositories the reader's work is in at the top", async () => {
    intercept(answering)

    const whole = await Effect.runPromise(loadRepositories().pipe(Effect.provide(layer)))
    const second = whole[1]!

    const ranked = await Effect.runPromise(
      loadRepositories([
        { owner: second.owner, repo: second.repo, name: second.repo, count: 2, yourMove: 1 }
      ]).pipe(Effect.provide(layer))
    )

    expect(ranked[0]?.nameWithOwner).toBe(second.nameWithOwner)
    expect(ranked).toHaveLength(whole.length)
  })

  test("fails loudly, because a Destination missing repositories looks like having none", async () => {
    intercept(() => new Response("nope", { status: 500 }))

    const outcome = await Effect.runPromise(
      loadRepositories().pipe(
        Effect.provide(layer),
        Effect.map(() => "read" as const),
        Effect.catch(() => Effect.succeed("failed" as const))
      )
    )

    expect(outcome).toBe("failed")
  })
})

describe("reading what happened elsewhere", () => {
  test("asks for the events, which is the only place pushes are left", async () => {
    const asked = intercept(answering)

    await Effect.runPromise(loadActivity("flazouh").pipe(Effect.provide(layer)))

    const events = asked.find((url) => url.includes("received_events"))
    expect(events).toContain("api.github.com/users/flazouh/received_events/public")
    expect(events).toContain("per_page=100")
  })

  test("groups them by repository, newest repository first", async () => {
    intercept(answering)

    const activity = await Effect.runPromise(
      loadActivity("flazouh").pipe(Effect.provide(layer))
    )

    expect(activity.length).toBeGreaterThan(0)
    const times = activity.map((one) => one.at)
    expect([...times].sort((left, right) => right.localeCompare(left))).toEqual(times)
    expect(activity.every((one) => one.happenings.length > 0)).toBe(true)
  })

  test("carries pushes, which their own feed route does not", async () => {
    intercept(answering)

    const activity = await Effect.runPromise(
      loadActivity("flazouh").pipe(Effect.provide(layer))
    )

    const kinds = activity.flatMap((one) => one.happenings.map((what) => what.kind))
    expect(kinds).toContain("pushed")
  })

  test("says which repository each group is, by owner and name", async () => {
    intercept(answering)

    const [first] = await Effect.runPromise(loadActivity("flazouh").pipe(Effect.provide(layer)))

    expect(first?.repo.owner.length).toBeGreaterThan(0)
    expect(first?.repo.repo.length).toBeGreaterThan(0)
  })

  test("fails loudly when their rate limit is spent, rather than showing an empty day", async () => {
    // Sixty an hour for an anonymous caller, shared by the whole address. An empty Activity
    // and a spent limit look identical to a reader, so the difference has to reach them.
    intercept(
      () =>
        new Response("limit", { status: 403, headers: { "x-ratelimit-remaining": "0" } })
    )

    const outcome = await Effect.runPromise(
      loadActivity("flazouh").pipe(
        Effect.provide(layer),
        Effect.map(() => "read" as const),
        Effect.catch((cause) => Effect.succeed(cause))
      )
    )

    expect(outcome).not.toBe("read")
    expect(typeof outcome === "object" ? outcome.reason : "").toBe("rejected")
    // The remaining count is what tells a spent limit from any other refusal in a log.
    expect(typeof outcome === "object" ? outcome.detail : "").toBe("HTTP 403 (0 left)")
  })
})
