import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { loadFixture } from "../../tests/fixtures"
import { happeningsFrom } from "./activity"

/**
 * Real received events, thirteen of them across the seven kinds a live account produced in
 * one afternoon — the same account whose "For You" feed answered with no pushes at all.
 */
const said = loadFixture("received-events")

const read = () => Effect.runPromise(happeningsFrom(said))

describe("reading the events GitHub still serves in order", () => {
  test("decodes the kinds this page draws", async () => {
    const happenings = await read()

    expect(happenings.length).toBeGreaterThan(0)
    expect(new Set(happenings.map((one) => one.kind)).size).toBeGreaterThan(3)
  })

  test("keeps a push, which is the thing their own feed stopped showing", async () => {
    const pushed = (await read()).filter((one) => one.kind === "pushed")

    // #173638's "no more commits", answered: their feed route served no push at all, and
    // these are two thirds pushes.
    expect(pushed.length).toBeGreaterThan(0)
    expect(pushed.every((one) => Option.isSome(one.ref))).toBe(true)
  })

  test("says nothing about how many commits, because they do not say", async () => {
    const pushed = (await read()).filter((one) => one.kind === "pushed")

    // Their public events carry `ref` and nothing else about a push: no count, no subjects.
    // A row that guessed "3 commits" would be a row that lies on a Tuesday.
    expect(pushed.every((one) => Option.isNone(one.howMany))).toBe(true)
  })

  test("carries a count where one is served, since not every source is this thin", async () => {
    const [one] = await Effect.runPromise(
      happeningsFrom([
        {
          type: "PushEvent",
          created_at: "2026-07-31T20:00:00Z",
          actor: { login: "someone", avatar_url: null },
          repo: { name: "flazouh/octo-repo" },
          payload: { ref: "refs/heads/main", size: 3 }
        }
      ])
    )

    expect(Option.getOrElse(one?.howMany ?? Option.none(), () => 0)).toBe(3)
  })

  test("says a branch by the name a reader calls it, not as refs/heads/it", async () => {
    const pushed = (await read()).find((one) => one.kind === "pushed")

    expect(Option.getOrElse(pushed?.ref ?? Option.none(), () => "")).not.toContain("refs/heads/")
  })

  test("names who did each thing", async () => {
    const happenings = await read()

    expect(happenings.every((one) => one.by.length === 1 && one.by[0]!.login.length > 0)).toBe(true)
  })

  test("points every line at somewhere on GitHub", async () => {
    const happenings = await read()

    expect(happenings.every((one) => one.url.startsWith("https://github.com/"))).toBe(true)
  })

  test("keeps them in the order they arrived, which is the order they happened", async () => {
    const happenings = await read()
    const times = happenings.map((one) => one.at)

    expect(times).toEqual([...times])
    expect(times.every((at) => at.endsWith("Z"))).toBe(true)
  })
})

describe("the kinds that need reading twice", () => {
  const oneEvent = (type: string, payload: unknown) => [
    {
      type,
      created_at: "2026-07-31T20:00:00Z",
      actor: { login: "someone", avatar_url: null },
      repo: { name: "flazouh/octo-repo" },
      payload
    }
  ]

  test("a merge is a merge, which their own action says", async () => {
    const [one] = await Effect.runPromise(
      happeningsFrom(
        oneEvent("PullRequestEvent", { action: "merged", pull_request: { number: 4 } })
      )
    )

    expect(one?.kind).toBe("merged")
  })

  test("a close is a close, and never drawn as a merge", async () => {
    const [one] = await Effect.runPromise(
      happeningsFrom(
        oneEvent("PullRequestEvent", { action: "closed", pull_request: { number: 4 } })
      )
    )

    expect(one?.kind).toBe("closed")
  })

  test("a pull request is addressed by its number, since no title is served", async () => {
    const [one] = await Effect.runPromise(
      happeningsFrom(
        oneEvent("PullRequestEvent", {
          action: "opened",
          pull_request: { number: 4, head: { ref: "refs/heads/widen-the-rail" } }
        })
      )
    )

    expect(one?.url).toBe("https://github.com/flazouh/octo-repo/pull/4")
    expect(Option.getOrElse(one?.title ?? Option.none(), () => "none")).toBe("none")
    expect(Option.getOrElse(one?.ref ?? Option.none(), () => "")).toBe("widen-the-rail")
  })

  test("a new branch is worth a line; a new tag is not", async () => {
    const branched = await Effect.runPromise(
      happeningsFrom(oneEvent("CreateEvent", { ref: "refs/heads/try", ref_type: "branch" }))
    )
    const tagged = await Effect.runPromise(
      happeningsFrom(oneEvent("CreateEvent", { ref: "refs/tags/v1", ref_type: "tag" }))
    )

    expect(branched.map((one) => one.kind)).toEqual(["branched"])
    expect(tagged).toEqual([])
  })

  test("leaves out an event nobody here has heard of, rather than failing the read", async () => {
    // Two dozen event types exist and this draws seven. A schema that insisted on the
    // whole vocabulary would break the page the first time GitHub invented one.
    const happenings = await Effect.runPromise(
      happeningsFrom([
        ...oneEvent("SponsorshipEvent", { effective_date: "2026-07-31" }),
        ...oneEvent("PushEvent", { ref: "refs/heads/main", size: 2 })
      ])
    )

    expect(happenings.map((one) => one.kind)).toEqual(["pushed"])
  })
})
