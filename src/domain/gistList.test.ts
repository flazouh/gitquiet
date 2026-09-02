import { describe, expect, test } from "bun:test"
import type { GistRow } from "./gistList"
import { matchesQuery } from "./gistList"

const row = (over: Partial<GistRow> = {}): GistRow => ({
  id: "4a3b4aaa20dcda98e882267f58198d92",
  owner: "flazouh",
  title: "ori-harness-agent-sdk.md",
  description: "One engine, two surfaces: shared core under the ORI harness and the Agent SDK",
  preview: "You said the portion split between Ori and the Agent SDK is TBD",
  secret: true,
  updatedAt: "2026-08-27T00:09:42+02:00",
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
