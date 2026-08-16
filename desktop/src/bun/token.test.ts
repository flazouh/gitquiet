import { describe, expect, test } from "bun:test"
import { whereGhIs } from "./token"

describe("whereGhIs", () => {
  const nowhere = () => false
  const nothingOnPath = () => null

  test("takes what PATH answers, because a shell run is the case that already worked", () => {
    const found = whereGhIs({
      onPath: () => "/some/unusual/prefix/bin/gh",
      exists: nowhere
    })

    expect(found).toBe("/some/unusual/prefix/bin/gh")
  })

  test("finds Homebrew's copy when PATH has nothing, which is a launch from Finder", () => {
    const found = whereGhIs({
      onPath: nothingOnPath,
      exists: (path) => path === "/opt/homebrew/bin/gh"
    })

    expect(found).toBe("/opt/homebrew/bin/gh")
  })

  test("finds an Intel install too", () => {
    const found = whereGhIs({
      onPath: nothingOnPath,
      exists: (path) => path === "/usr/local/bin/gh"
    })

    expect(found).toBe("/usr/local/bin/gh")
  })

  test("answers nothing when the CLI is not installed", () => {
    expect(whereGhIs({ onPath: nothingOnPath, exists: nowhere })).toBe(null)
  })
})
