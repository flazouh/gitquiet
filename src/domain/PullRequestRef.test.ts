import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { elsewhereThan, fromPathname, toUrl, opensOnFiles } from "./PullRequestRef"

describe("recognising a pull request from a URL", () => {
  const recognised = [
    ["/microsoft/vscode/pull/327442", 327442],
    ["/microsoft/vscode/pull/327442/", 327442]
  ] as const

  for (const [pathname, number] of recognised) {
    test(`recognises ${pathname}`, () => {
      const ref = fromPathname(pathname)
      expect(Option.isSome(ref)).toBe(true)
      if (Option.isSome(ref)) {
        expect(ref.value).toEqual({ owner: "microsoft", repo: "vscode", number })
      }
    })
  }

  const ignored = [
    "/",
    "/microsoft",
    "/microsoft/vscode",
    "/microsoft/vscode/pulls",
    "/microsoft/vscode/issues/1",
    "/microsoft/vscode/pull/not-a-number",
    "/microsoft/vscode/pull/",
    // Two of the three tabs beside the conversation are GitHub's own, and they are
    // good: a commit list and a check run are both things they already do well.
    // Files used to be the third, on the same reasoning — see `PULL_REQUEST_PATH`
    // for the evidence that stopped supporting it.
    "/microsoft/vscode/pull/327442/commits",
    "/microsoft/vscode/pull/327442/checks",
    "/microsoft/vscode/pull/1/commits/abc123"
  ]

  for (const pathname of ignored) {
    test(`leaves ${pathname} to GitHub`, () => {
      expect(Option.isNone(fromPathname(pathname))).toBe(true)
    })
  }
})

describe("whether a press is headed for a pull request other than the one being read", () => {
  const here = "/flazouh/stack-probe/pull/39"

  test("names the pull request a press is headed for", () => {
    const wanted = elsewhereThan(here, "/flazouh/stack-probe/pull/38")
    expect(Option.isSome(wanted)).toBe(true)
    if (Option.isSome(wanted)) {
      expect(wanted.value).toEqual({ owner: "flazouh", repo: "stack-probe", number: 38 })
    }
  })

  test("declines the page already being read, which is a press with nowhere to go", () => {
    expect(Option.isNone(elsewhereThan(here, here))).toBe(true)
  })

  /*
   * The reason both addresses are arguments.
   *
   * A reader who arrives on #39 and presses #38 is then on #38, and the address
   * is the only thing that moved: no document loaded. A press back to #39 is a
   * press to somewhere else and has to be answered. Read from where the document
   * was loaded instead, this refused it and left it to a router that was never
   * told the row exists, which drops about every other one — so the press either
   * did nothing at all or arrived as a whole document load.
   */
  test("answers a press back to the pull request the document was loaded on", () => {
    const wanted = elsewhereThan("/flazouh/stack-probe/pull/38", here)
    expect(Option.isSome(wanted)).toBe(true)
    if (Option.isSome(wanted)) {
      expect(wanted.value.number).toBe(39)
    }
  })

  test("declines a link that is not a pull request at all", () => {
    expect(Option.isNone(elsewhereThan(here, "/flazouh/stack-probe/pulls"))).toBe(true)
  })

  test("answers a press from a page that is not a pull request", () => {
    expect(
      Option.isSome(elsewhereThan("/flazouh/stack-probe/pulls", "/flazouh/stack-probe/pull/39"))
    ).toBe(true)
  })

  test("tells apart the same number in another repository", () => {
    expect(Option.isSome(elsewhereThan(here, "/flazouh/other/pull/39"))).toBe(true)
  })
})

describe("linking back to GitHub", () => {
  test("builds the original pull request URL", () => {
    expect(toUrl({ owner: "microsoft", repo: "vscode", number: 327442 })).toBe(
      "https://github.com/microsoft/vscode/pull/327442"
    )
  })

  /**
   * The Files tab, which is this page and not a different one.
   *
   * GitHub's own engineering post about it reports a gigabyte of heap, four
   * hundred thousand DOM nodes and a hard file cap. This interface already draws
   * every file of a pull request inside its own screen; the address only had to be
   * read. See `research/pages-to-replace.md` in the notes repository.
   */
  describe("the Files tab", () => {
    test("is the same pull request, read from its own address", () => {
      expect(Option.getOrNull(fromPathname("/microsoft/vscode/pull/327442/files"))).toEqual({
        owner: "microsoft",
        repo: "vscode",
        number: 327442
      })
    })

    test("says it is the Files tab, so the screen opens on the diff", () => {
      // A reader who pressed "Files changed" asked for the diff, and showing them
      // the description instead answers a question they did not ask.
      expect(opensOnFiles("/microsoft/vscode/pull/327442/files")).toBe(true)
      expect(opensOnFiles("/microsoft/vscode/pull/327442/files/")).toBe(true)
    })

    test("under either of the two words GitHub is mid-rename between", () => {
      // Read live on 2026-09-02: following `/files` arrives at `/changes`. Reading
      // only the new one ignores every link ever written; only the old one ignores
      // the address the reader is actually on.
      expect(
        Option.getOrNull(fromPathname("/microsoft/vscode/pull/327442/changes"))
      ).toEqual({ owner: "microsoft", repo: "vscode", number: 327442 })
      expect(opensOnFiles("/microsoft/vscode/pull/327442/changes")).toBe(true)
    })

    test("and the conversation is not the Files tab", () => {
      expect(opensOnFiles("/microsoft/vscode/pull/327442")).toBe(false)
      expect(opensOnFiles("/microsoft/vscode/pull/327442/commits")).toBe(false)
      expect(opensOnFiles("/microsoft/vscode/pull/327442/checks")).toBe(false)
    })
  })
})