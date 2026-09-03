import { describe, expect, test } from "bun:test"
import type { GistRow } from "./gistList"
import { isKind, matchesQuery, sifted } from "./gistList"

const row = (over: Partial<GistRow> = {}): GistRow => ({
  id: "4a3b4aaa20dcda98e882267f58198d92",
  owner: "flazouh",
  title: "ori-harness-agent-sdk.md",
  description: "One engine, two surfaces: shared core under the ORI harness and the Agent SDK",
  preview: "You said the portion split between Ori and the Agent SDK is TBD",
  secret: true,
  updatedAt: "2026-08-27T00:09:42+02:00",
  files: 1,
  forks: 0,
  comments: 0,
  stars: 0,
  ...over
})

describe("whether a gist matches a search", () => {
  test("matches on the title", () => {
    expect(matchesQuery(row(), "harness-agent")).toBe(true)
  })

  test("matches on the description", () => {
    expect(matchesQuery(row(), "shared core")).toBe(true)
  })

  test("matches on the content preview, which GitHub's own search does not read", () => {
    expect(matchesQuery(row(), "portion split")).toBe(true)
  })

  test("is case-insensitive", () => {
    expect(matchesQuery(row(), "SHARED CORE")).toBe(true)
  })

  test("does not match unrelated words", () => {
    expect(matchesQuery(row(), "pancake recipe")).toBe(false)
  })

  test("matches everything on an empty query", () => {
    expect(matchesQuery(row(), "")).toBe(true)
  })

  test("matches on a gist with no description at all", () => {
    expect(matchesQuery(row({ description: null }), "harness")).toBe(true)
    expect(matchesQuery(row({ description: null }), "nonsense")).toBe(false)
  })

  test("matches on the extra text a caller supplies, for a Label or a Name GitHub does not carry", () => {
    expect(matchesQuery(row(), "runbook", "deploy runbook")).toBe(true)
    expect(matchesQuery(row(), "runbook")).toBe(false)
  })
})

describe("the list as the reader asked for it", () => {
  const secret = row({ id: "s1", title: "keys.md", secret: true, stars: 1, forks: 0, comments: 9, updatedAt: "2026-01-01T00:00:00Z" })
  const open1 = row({ id: "p1", title: "alpha.ts", secret: false, stars: 7, forks: 3, comments: 0, updatedAt: "2026-03-01T00:00:00Z" })
  const open2 = row({ id: "p2", title: "beta.ts", secret: false, stars: 4, forks: 9, comments: 2, updatedAt: "2026-02-01T00:00:00Z" })
  const all = [secret, open1, open2]

  const ask = (over: Partial<Parameters<typeof sifted>[1]> = {}) =>
    sifted(all, { kind: "all", order: "updated", query: "", labels: [], ...over })

  test("their Type filter keeps only the one kind", () => {
    expect(isKind(secret, "secret")).toBe(true)
    expect(isKind(secret, "public")).toBe(false)
    expect(ask({ kind: "secret" }).map((r) => r.id)).toEqual(["s1"])
    expect(ask({ kind: "public" }).map((r) => r.id)).toEqual(["p1", "p2"])
  })

  test("newest first, and every order their page does not offer", () => {
    expect(ask().map((r) => r.id)).toEqual(["p1", "p2", "s1"])
    expect(ask({ order: "title" }).map((r) => r.id)).toEqual(["p1", "p2", "s1"])
    expect(ask({ order: "stars" }).map((r) => r.id)).toEqual(["p1", "p2", "s1"])
    expect(ask({ order: "forks" }).map((r) => r.id)).toEqual(["p2", "p1", "s1"])
    expect(ask({ order: "comments" }).map((r) => r.id)).toEqual(["s1", "p2", "p1"])
  })

  test("a row with no readable date sorts last rather than first", () => {
    // Missing information, not brand new.
    const undated = row({ id: "u1", updatedAt: "" })
    const found = sifted([undated, open1], { kind: "all", order: "updated", query: "", labels: [] })
    expect(found.map((r) => r.id)).toEqual(["p1", "u1"])
  })

  test("two Labels narrow rather than widen", () => {
    // A reader who picked two has asked for less, which is the only useful reading.
    const labels = (r: typeof secret) => (r.id === "p1" ? ["work", "deploy"] : ["work"])
    expect(ask({ labels: ["work"] }).length).toBe(0)
    expect(
      sifted(all, { kind: "all", order: "title", query: "", labels: ["work"] }, () => "", labels)
        .map((r) => r.id)
    ).toEqual(["p1", "p2", "s1"])
    expect(
      sifted(all, { kind: "all", order: "title", query: "", labels: ["work", "deploy"] }, () => "", labels)
        .map((r) => r.id)
    ).toEqual(["p1"])
  })

  test("filters before it sorts, so nothing is dropped by the order", () => {
    expect(
      sifted(all, { kind: "public", order: "stars", query: "", labels: [] }).map((r) => r.id)
    ).toEqual(["p1", "p2"])
  })
})
