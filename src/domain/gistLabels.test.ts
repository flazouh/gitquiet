import { describe, expect, test } from "bun:test"
import {
  decodeGistLabels,
  encodeGistLabels,
  labelsOf,
  matchesLabel,
  nameOf,
  withLabels,
  withName
} from "./gistLabels"

describe("reading and writing the stored shape", () => {
  test("round-trips through JSON", () => {
    const kept = new Map([
      ["aaa111", { labels: ["deploy", "runbook"], name: "Deploy runbook" }],
      ["bbb222", { labels: [], name: null }]
    ])

    expect(decodeGistLabels(encodeGistLabels(kept))).toEqual(kept)
  })

  test("reads an empty map out of nothing stored yet", () => {
    expect(decodeGistLabels(undefined)).toEqual(new Map())
  })

  test("reads an empty map out of a value that is not the shape expected", () => {
    expect(decodeGistLabels("not json at all")).toEqual(new Map())
    expect(decodeGistLabels(JSON.stringify({ aaa111: "not an object" }))).toEqual(new Map())
  })

  test("drops a label that is not a string, rather than keeping a broken one", () => {
    const raw = JSON.stringify({ aaa111: { labels: ["deploy", 42, null], name: null } })

    expect(decodeGistLabels(raw)).toEqual(new Map([["aaa111", { labels: ["deploy"], name: null }]]))
  })
})

describe("looking up one gist's own Labels and Name", () => {
  const kept = new Map([["aaa111", { labels: ["deploy"], name: "Deploy runbook" }]])

  test("gives the Labels a gist carries", () => {
    expect(labelsOf(kept, "aaa111")).toEqual(["deploy"])
  })

  test("gives no Labels for a gist never marked", () => {
    expect(labelsOf(kept, "zzz999")).toEqual([])
  })

  test("gives the Name a gist was given", () => {
    expect(nameOf(kept, "aaa111")).toBe("Deploy runbook")
  })

  test("gives no Name for a gist never named", () => {
    expect(nameOf(kept, "zzz999")).toBeNull()
  })
})

describe("changing one gist's own Labels and Name", () => {
  test("sets the Labels of a gist not seen before", () => {
    const kept = withLabels(new Map(), "aaa111", ["deploy"])

    expect(labelsOf(kept, "aaa111")).toEqual(["deploy"])
  })

  test("replaces the Labels of a gist already marked, keeping its Name", () => {
    const before = new Map([["aaa111", { labels: ["deploy"], name: "Deploy runbook" }]])
    const after = withLabels(before, "aaa111", ["deploy", "urgent"])

    expect(labelsOf(after, "aaa111")).toEqual(["deploy", "urgent"])
    expect(nameOf(after, "aaa111")).toBe("Deploy runbook")
  })

  test("sets a Name, keeping any Labels already there", () => {
    const before = withLabels(new Map(), "aaa111", ["deploy"])
    const after = withName(before, "aaa111", "Deploy runbook")

    expect(nameOf(after, "aaa111")).toBe("Deploy runbook")
    expect(labelsOf(after, "aaa111")).toEqual(["deploy"])
  })

  test("clears a Name by setting it to null, and does not remember an empty one", () => {
    const before = withName(new Map(), "aaa111", "Deploy runbook")
    const after = withName(before, "aaa111", null)

    expect(nameOf(after, "aaa111")).toBeNull()
  })

  test("drops empty and duplicate Labels", () => {
    const kept = withLabels(new Map(), "aaa111", ["deploy", "", "deploy", "  ", "urgent"])

    expect(labelsOf(kept, "aaa111")).toEqual(["deploy", "urgent"])
  })
})

describe("whether a gist carries one particular Label", () => {
  test("matches a Label it carries", () => {
    expect(matchesLabel(["deploy", "urgent"], "deploy")).toBe(true)
  })

  test("does not match a Label it does not carry", () => {
    expect(matchesLabel(["deploy"], "urgent")).toBe(false)
  })

  test("matches everything when no Label is asked for", () => {
    expect(matchesLabel([], null)).toBe(true)
    expect(matchesLabel(["deploy"], null)).toBe(true)
  })
})
