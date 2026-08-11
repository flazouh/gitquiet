import { beforeEach, describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { Pass } from "../domain/reviewPass"
import { keepPass, passOf } from "./passes"

beforeEach(() => localStorage.clear())

const pass: Pass = {
  from: "head-one",
  at: 42,
  reads: [{ path: "src/answer.ts", mark: "patch-one" }]
}

describe("keeping a Review Pass", () => {
  test("gives the same read record back after the screen has gone", () => {
    keepPass("oven-sh/bun#1", pass)

    expect(passOf("oven-sh/bun#1")).toEqual(Option.some(pass))
    expect(passOf("oven-sh/bun#2")).toEqual(Option.none())
  })
})
