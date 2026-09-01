import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { type Commit, type Range, blameIn, spansOf } from "./blame"

const parsed = (url: string) => Option.getOrNull(blameIn(url))

const at = (path: string) => `https://github.com${path}`

describe("the address of a file's blame", () => {
  test("reads the owner, the repository, the branch and the path out of it", () => {
    expect(parsed(at("/oven-sh/bun/blame/main/README.md"))).toEqual({
      repo: { owner: "oven-sh", repo: "bun" },
      branch: "main",
      path: "README.md"
    })
  })

  test("puts a path back together out of the segments GitHub split it into", () => {
    expect(parsed(at("/oven-sh/bun/blame/main/src/js/builtins.ts"))?.path).toBe(
      "src/js/builtins.ts"
    )
  })

  test("gives back a path that had a space or a hash in it, not the escaped form", () => {
    expect(parsed(at("/oven-sh/bun/blame/main/docs/a%20b%23c.md"))?.path).toBe("docs/a b#c.md")
  })

  test("refuses a tab of the repository that is not blame", () => {
    expect(parsed(at("/oven-sh/bun/tree/main/src"))).toBeNull()
    expect(parsed(at("/oven-sh/bun/blob/main/README.md"))).toBeNull()
    expect(parsed(at("/oven-sh/bun/pulls"))).toBeNull()
  })

  test("refuses a blame address with no branch, which GitHub does not serve either", () => {
    expect(parsed(at("/oven-sh/bun/blame"))).toBeNull()
  })

  test("refuses a branch with no path after it, which GitHub does not serve either", () => {
    expect(parsed(at("/oven-sh/bun/blame/main"))).toBeNull()
  })

  test("refuses another host", () => {
    expect(parsed("https://gitlab.com/oven-sh/bun/blame/main/README.md")).toBeNull()
  })

  test("refuses a reserved first segment, which is not a repository owner", () => {
    expect(parsed(at("/settings/blame/main/README.md"))).toBeNull()
  })
})

const commit = (over: Partial<Commit> = {}): Commit => ({
  oid: "f0c283c",
  message: "Add Bun logo",
  authorAvatarUrl: "https://avatars.githubusercontent.com/u/1",
  committerName: "Jarred Sumner",
  committedDate: "2022-07-06T04:12:45.000-07:00",
  ...over
})

const range = (over: Partial<Range> = {}): Range => ({
  start: 1,
  end: 1,
  commitOid: "f0c283c",
  ...over
})

describe("banding ranges into Spans", () => {
  test("makes one Span for one range", () => {
    const spans = spansOf([range()], new Map([["f0c283c", commit()]]))

    expect(spans).toEqual([
      { start: 1, end: 1, commit: commit(), repeat: false }
    ])
  })

  test("keeps two consecutive ranges of the same commit as one Span", () => {
    const spans = spansOf(
      [range({ start: 1, end: 1 }), range({ start: 2, end: 2 })],
      new Map([["f0c283c", commit()]])
    )

    expect(spans).toEqual([
      { start: 1, end: 2, commit: commit(), repeat: false }
    ])
  })

  test("splits two ranges of different commits into two Spans", () => {
    const other = commit({ oid: "abc123", message: "Fix typo" })
    const spans = spansOf(
      [range({ start: 1, end: 1 }), range({ start: 2, end: 2, commitOid: "abc123" })],
      new Map([["f0c283c", commit()], ["abc123", other]])
    )

    expect(spans).toEqual([
      { start: 1, end: 1, commit: commit(), repeat: false },
      { start: 2, end: 2, commit: other, repeat: false }
    ])
  })

  test("marks the second Span of a commit already told higher on the page as a Repeat", () => {
    const other = commit({ oid: "abc123", message: "Fix typo" })
    const spans = spansOf(
      [
        range({ start: 1, end: 1 }),
        range({ start: 2, end: 2, commitOid: "abc123" }),
        range({ start: 3, end: 3, commitOid: "f0c283c" })
      ],
      new Map([["f0c283c", commit()], ["abc123", other]])
    )

    expect(spans).toEqual([
      { start: 1, end: 1, commit: commit(), repeat: false },
      { start: 2, end: 2, commit: other, repeat: false },
      { start: 3, end: 3, commit: commit(), repeat: true }
    ])
  })

  test("skips a range whose commit is not in the map, rather than throwing", () => {
    const spans = spansOf([range({ commitOid: "missing" })], new Map())

    expect(spans).toEqual([])
  })

  test("draws nothing for no ranges", () => {
    expect(spansOf([], new Map())).toEqual([])
  })
})
