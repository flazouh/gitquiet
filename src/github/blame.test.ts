import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import fixture from "../../fixtures/github/blame.json"
import { reParented } from "../../tests/reParented"
import { blamedFrom } from "./blame"

const read = (given: unknown) => Effect.runSync(blamedFrom([given]))

describe("one file's blame, read out of their page", () => {
  test("gives back every range in ascending line order", () => {
    const blamed = read(fixture)

    expect(blamed.ranges.map((range) => range.start)).toEqual([1, 2, 3, 4, 5])
    expect(blamed.ranges[4]).toEqual({
      start: 5,
      end: 6,
      commitOid: "18362505429f99662f4423264147896d23313dbe"
    })
  })

  test("keeps one commit per SHA, ready to be looked up by a range", () => {
    const blamed = read(fixture)

    expect(blamed.commits.size).toBe(4)
    expect(blamed.commits.get("f0c283c632816143d8eb3a9dc9ed41d326dcbde1")).toEqual({
      oid: "f0c283c632816143d8eb3a9dc9ed41d326dcbde1",
      message: "Add Bun logo",
      authorAvatarUrl: "https://avatars.githubusercontent.com/u/5665358?s=80&v=4",
      committerName: "Jarred Sumner",
      committerEmail: "jarred@jarredsumner.com",
      committedDate: "2022-07-06T04:12:45.000-07:00"
    })
  })

  test("says the Ignore File is present, on the repository that keeps one", () => {
    expect(read(fixture).ignoreRevsPresent).toBe(true)
  })

  test("gives back the file's own lines, for the renderer beside the blame", () => {
    expect(read(fixture).lines[3]).toBe('<h1 align="center">Bun</h1>')
  })

  test("still reads, where GitHub has parented its payloads somewhere new", () => {
    const blamed = read(reParented(fixture))

    expect(blamed.ranges.length).toBe(5)
  })
})
