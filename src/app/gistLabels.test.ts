import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { KeyValue } from "../ports/KeyValue"
import { readKeptGists, writeKeptGists } from "./gistLabels"

const KEY = "gistLabels"

const fakeArea = (initial: Record<string, unknown> = {}): KeyValue => {
  const held = { ...initial }
  return {
    get: (keys) => {
      const names = Array.isArray(keys) ? keys : [keys]
      const found = Object.fromEntries(names.filter((name) => name in held).map((name) => [name, held[name]]))
      return Promise.resolve(found)
    },
    set: (items) => {
      Object.assign(held, items)
      return Promise.resolve()
    }
  }
}

describe("keeping Labels and Names between visits", () => {
  test("reads an empty map where nothing has been kept yet", async () => {
    const kept = await Effect.runPromise(readKeptGists(fakeArea()))

    expect(kept).toEqual(new Map())
  })

  test("writes and reads back the same Labels", async () => {
    const area = fakeArea()

    await Effect.runPromise(
      writeKeptGists(area, new Map([["aaa111", { labels: ["deploy"], name: null }]]))
    )
    const kept = await Effect.runPromise(readKeptGists(area))

    expect(kept).toEqual(new Map([["aaa111", { labels: ["deploy"], name: null }]]))
  })

  test("reads under one key, so a reader's other synced settings are untouched", async () => {
    const area = fakeArea({ [KEY]: JSON.stringify({ aaa111: { labels: ["deploy"], name: null } }) })

    const kept = await Effect.runPromise(readKeptGists(area))

    expect(kept).toEqual(new Map([["aaa111", { labels: ["deploy"], name: null }]]))
  })
})
