import { describe, expect, it } from "bun:test"
import { Effect, Exit, Option } from "effect"
import { authorsFrom, branchesFrom } from "./refs"

const run = <A, E>(work: Effect.Effect<A, E>) => Effect.runSyncExit(work)

describe("the branches of a repository, out of their own picker's route", () => {
  it("reads the names, in the order GitHub gave them", () => {
    expect(run(branchesFrom({ refs: ["main", "next", "17.0.0"] }))).toEqual(
      Exit.succeed(["main", "next", "17.0.0"])
    )
  })

  it("reads a repository with one branch, which is most of them", () => {
    expect(run(branchesFrom({ refs: ["main"] }))).toEqual(Exit.succeed(["main"]))
  })

  it("refuses an answer that is not a list of names", () => {
    // A route of theirs that has changed shape is a route this must not guess
    // at: a picker offering the wrong branches sends somebody to the wrong page.
    expect(Exit.isFailure(run(branchesFrom({ refs: [{ name: "main" }] })))).toBe(true)
    expect(Exit.isFailure(run(branchesFrom({ branches: ["main"] })))).toBe(true)
  })
})

describe("everybody who has written a commit on the repository", () => {
  it("reads them as the faces every other list draws from", () => {
    expect(
      run(
        authorsFrom({
          authors: [
            { login: "flazouh", primaryAvatarUrl: "https://avatars.test/f.png", name: null },
            { login: "octo-repo", primaryAvatarUrl: null, name: "Ori" }
          ]
        })
      )
    ).toEqual(
      Exit.succeed([
        { login: "flazouh", isAutomated: false, faceUrl: Option.some("https://avatars.test/f.png") },
        { login: "octo-repo", isAutomated: false, faceUrl: Option.none() }
      ])
    )
  })

  it("refuses an answer with no login to filter by", () => {
    expect(Exit.isFailure(run(authorsFrom({ authors: [{ name: "Ori" }] })))).toBe(true)
  })
})
