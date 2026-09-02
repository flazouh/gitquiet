import { describe, expect, test } from "bun:test"
import type { Commit, Span } from "../domain/blame"
import { keyOf, noteFor, notesOf } from "./blameNotes"

const commit = (over: Partial<Commit> = {}): Commit => ({
  oid: "logo-commit",
  message: "Add Bun logo",
  authorAvatarUrl: "https://avatars.githubusercontent.com/u/1",
  committerName: "Jarred Sumner",
  committerEmail: "jarred@jarredsumner.com",
  committedDate: "2022-07-06T04:12:45.000-07:00",
  ...over
})

const span = (over: Partial<Span> = {}): Span => ({
  start: 1,
  end: 1,
  commit: commit(),
  repeat: false,
  ...over
})

describe("where a Span's heading hangs", () => {
  test("hangs under the line before the Span begins", () => {
    expect(noteFor(span({ start: 4 }))).toEqual({
      key: "span-logo-commit-4",
      side: "additions",
      line: 3
    })
  })

  test("has nowhere to hang for the very first Span", () => {
    expect(noteFor(span({ start: 1 }))).toBeNull()
  })

  test("keeps the same key for the same Span, so the row is not rebuilt", () => {
    const one = span({ start: 4 })
    expect(keyOf(one)).toBe(keyOf({ ...one }))
  })
})

describe("every Span turned into rows for the renderer", () => {
  test("skips the first Span and keeps every other, in order", () => {
    const spans = [
      span({ start: 1 }),
      span({ start: 4, commit: commit({ oid: "domain-commit" }) }),
      span({ start: 9, commit: commit({ oid: "docs-commit" }) })
    ]

    expect(notesOf(spans)).toEqual([
      { key: "span-domain-commit-4", side: "additions", line: 3 },
      { key: "span-docs-commit-9", side: "additions", line: 8 }
    ])
  })

  test("draws nothing for a file with one Span", () => {
    expect(notesOf([span()])).toEqual([])
  })
})
