import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { fromPathname, toUrl } from "./PullRequestRef"

describe("recognising a pull request from a URL", () => {
  const recognised = [
    ["/microsoft/vscode/pull/327442", 327442],
    ["/microsoft/vscode/pull/327442/files", 327442],
    ["/microsoft/vscode/pull/327442/commits", 327442],
    ["/microsoft/vscode/pull/1/commits/abc123", 1]
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
    "/microsoft/vscode/pull/"
  ]

  for (const pathname of ignored) {
    test(`ignores ${pathname}`, () => {
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
