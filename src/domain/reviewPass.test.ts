import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { FileDiff } from "./PullRequest"
import { acted, footingOf, markOf } from "./reviewPass"

const patch = (text: string): FileDiff => ({
  isBinary: false,
  isTruncated: false,
  lines: [
    {
      kind: "added",
      text,
      beforeLine: Option.none(),
      afterLine: Option.some(1)
    }
  ]
})

describe("the version of a file somebody read", () => {
  test("moves when the patch content moves and stays when it does not", () => {
    expect(markOf(patch("const answer = 41"))).not.toBe(markOf(patch("const answer = 42")))
    expect(markOf(patch("const answer = 42"))).toBe(markOf(patch("const answer = 42")))
  })
})

describe("where a file stands in a Review Pass", () => {
  test("puts a changed patch back in the work without losing what was read", () => {
    const pass = acted(
      Option.none(),
      { kind: "read", path: "src/answer.ts", mark: "patch-one" },
      { head: "head-one", at: 1 }
    )

    expect(footingOf(pass, "src/answer.ts", Option.some("patch-one"))).toBe("read")
    expect(footingOf(pass, "src/answer.ts", Option.some("patch-two"))).toBe("changed")
    expect(footingOf(pass, "src/other.ts", Option.some("other-patch"))).toBe("unread")
    expect(footingOf(pass, "src/answer.ts", Option.none())).toBe("unloaded")
  })
})
