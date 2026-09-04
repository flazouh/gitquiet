import { describe, expect, test } from "bun:test"
import { chainOf, type ChainNode } from "./stack"

const node = (some: Partial<ChainNode> & Pick<ChainNode, "number" | "headRefName" | "baseRefName">): ChainNode => ({
  title: `#${some.number}`,
  isDraft: false,
  state: "OPEN",
  ...some
})

describe("a branch chain, read from open pull requests", () => {
  test("a pull request that sits alone is not a stack", () => {
    expect(
      chainOf("vercel", "next.js", 1, [
        node({ number: 1, headRefName: "feat", baseRefName: "canary" })
      ])
    ).toBeNull()
  })

  test("walks down to the foundation and up to the tip", () => {
    const stack = chainOf("vercel", "next.js", 71219, [
      node({ number: 71204, title: "Split the cache", headRefName: "cache/split-router", baseRefName: "canary" }),
      node({ number: 71219, title: "Key by segment", headRefName: "cache/segment-keys", baseRefName: "cache/split-router" }),
      node({ number: 71230, title: "Delete the adapter", headRefName: "cache/drop-adapter", baseRefName: "cache/segment-keys" })
    ])

    expect(stack).not.toBeNull()
    expect(stack?.number).toBe(71204)
    expect(stack?.floor).toBe("canary")
    expect(stack?.layers.map((one) => [one.number, one.seat])).toEqual([
      [71204, "below"],
      [71219, "here"],
      [71230, "above"]
    ])
  })

  test("a press at the tip lands the whole chain", () => {
    const stack = chainOf("vercel", "next.js", 71230, [
      node({ number: 71204, headRefName: "a", baseRefName: "canary" }),
      node({ number: 71219, headRefName: "b", baseRefName: "a" }),
      node({ number: 71230, headRefName: "c", baseRefName: "b" })
    ])

    expect(stack?.layers.map((one) => one.seat)).toEqual(["below", "below", "here"])
  })

  test("a cycle in the branches stops rather than looping", () => {
    const stack = chainOf("acme", "app", 1, [
      node({ number: 1, headRefName: "a", baseRefName: "b" }),
      node({ number: 2, headRefName: "b", baseRefName: "a" })
    ])

    expect(stack?.layers.map((one) => one.number)).toEqual([2, 1])
  })
})
