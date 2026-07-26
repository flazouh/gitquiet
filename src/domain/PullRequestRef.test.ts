import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { fromPathname, toUrl } from "./PullRequestRef"

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
    // The tabs beside the conversation are GitHub's own, and they are good: a
    // diff, a commit list and a check run are all things they already do well.
    "/microsoft/vscode/pull/327442/files",
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

describe("linking back to GitHub", () => {
  test("builds the original pull request URL", () => {
    expect(toUrl({ owner: "microsoft", repo: "vscode", number: 327442 })).toBe(
      "https://github.com/microsoft/vscode/pull/327442"
    )
  })
})
