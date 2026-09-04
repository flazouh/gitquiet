import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { FrontFacts, MarkFacts, StackFacts, StandingFacts } from "../shared/wire"
import { frontFrom, marksFrom, stackFrom, standingFrom, suggestingFrom } from "./front"

const stack = (): StackFacts => ({
  number: 71204,
  floor: "canary",
  layers: [
    {
      owner: "vercel",
      repo: "next.js",
      number: 71204,
      title: "Split the cache",
      headBranch: "cache/split-router",
      state: "open",
      seat: "below"
    },
    {
      owner: "vercel",
      repo: "next.js",
      number: 71219,
      title: "Key by segment",
      headBranch: "cache/segment-keys",
      state: "open",
      seat: "here"
    }
  ]
})

describe("a repository front, built from what the main process read", () => {
  test("a keeper gets the files first and the README as an answer", () => {
    const facts: FrontFacts = {
      owner: "cli",
      repo: "cli",
      footing: "keeper",
      branch: "trunk",
      head: "abc",
      entries: [
        { name: "z.md", path: "z.md", kind: "file" },
        { name: "src", path: "src", kind: "directory" }
      ],
      welcome: { name: "README.md", path: "README.md", html: "<h1>cli</h1>", timedOut: false },
      about: {
        description: "GitHub's CLI",
        stars: 12,
        forks: 3,
        topics: ["go"],
        starring: "starred"
      },
      commits: 40
    }

    const front = frontFrom(facts)
    expect(front.footing).toBe("keeper")
    expect(front.entries.map((one) => one.name)).toEqual(["src", "z.md"])
    expect(Option.getOrThrow(front.welcome).html).toBe("<h1>cli</h1>")
    expect(Option.getOrThrow(front.about.stars)).toBe(12)
  })

  test("a stack of one is not drawn, and a chain of two is", () => {
    expect(stackFrom(null)).toEqual(Option.none())
    expect(stackFrom({ number: 1, floor: "main", layers: [] })).toEqual(Option.none())

    const found = Option.getOrThrow(stackFrom(stack()))
    expect(found.number).toBe(71204)
    expect(Option.getOrThrow(found.floor)).toBe("canary")
    expect(found.layers.map((one) => one.seat)).toEqual(["below", "here"])
  })

  test("standing leaves used-by empty, that having no public route", () => {
    const facts: StandingFacts = {
      hands: [{ login: "mira", called: "Mira", url: "https://github.com/mira", face: "https://faces/mira.png" }],
      handCount: 4,
      handsUrl: "https://github.com/cli/cli/graphs/contributors",
      tongues: [{ name: "Go", share: 0.8, colour: "#00ADD8", url: "https://github.com/cli/cli/search?l=Go" }],
      shipped: { name: "v2.0", at: "2026-01-01T00:00:00Z", url: "https://github.com/cli/cli/releases/tag/v2.0" },
      shippedUrl: "https://github.com/cli/cli/releases",
      landings: [],
      landingsUrl: "https://github.com/cli/cli/deployments",
      leaning: null,
      leaningFaces: [],
      leaningUrl: null,
      parcels: null,
      parcelsUrl: null
    }

    const standing = standingFrom(facts)
    expect(standing.hands[0]?.login).toBe("mira")
    expect(standing.leaning).toEqual(Option.none())
    expect(Option.getOrThrow(standing.shipped).name).toBe("v2.0")
  })

  test("suggestions keep the people and the numbers as they arrived", () => {
    const suggesting = suggestingFrom({
      people: [{ login: "mira", name: "Mira Halden" }],
      numbered: [{ number: 12, title: "Fix the list", state: "open" }]
    })

    expect(suggesting.people[0]?.login).toBe("mira")
    expect(suggesting.numbered[0]?.number).toBe(12)
  })

  test("commit marks are keyed by sha, with checks optional", () => {
    const facts: ReadonlyArray<MarkFacts> = [
      { sha: "aaa", checks: { state: "passing", said: "4 / 4 checks OK" }, verified: true, comments: 0 },
      { sha: "bbb", checks: null, verified: false, comments: 2 }
    ]

    const marks = marksFrom(facts)
    expect(Option.getOrThrow(marks.get("aaa")?.checks ?? Option.none()).state).toBe("passing")
    expect(marks.get("bbb")?.verified).toBe(false)
    expect(marks.get("bbb")?.comments).toBe(2)
  })
})
