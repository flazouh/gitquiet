import { describe, expect, test } from "bun:test"
import { signedOutOnPurpose, whereGhIs } from "./token"

/*
 * The welcome screen is the one screen a developer with a token cannot reach, and it
 * used to be reached by signing out — which spends a real sign-in to look at a card.
 * One variable answers "nobody" for the run, and the keychain keeps what it holds.
 */
describe("signedOutOnPurpose", () => {
  test("is off when nothing asked for it, which is every ordinary run", () => {
    expect(signedOutOnPurpose({})).toBe(false)
  })

  test("is on when the variable is set", () => {
    expect(signedOutOnPurpose({ GITQUIET_SIGNED_OUT: "1" })).toBe(true)
  })

  test("is off when the variable is empty, so an unset shell variable is not a sign-out", () => {
    expect(signedOutOnPurpose({ GITQUIET_SIGNED_OUT: "" })).toBe(false)
  })
})

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
