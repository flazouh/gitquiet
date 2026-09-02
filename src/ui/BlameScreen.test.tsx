import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Effect } from "effect"
import type { Blamed, Commit } from "../domain/blame"
import { BlameScreen } from "./BlameScreen"
import type { Load } from "./useLive"

/**
 * The surface a reader meets: reading, failed, and the header line above the
 * file. What the renderer draws once a file lands is not asserted here, the
 * same way `repoHomeScreen.test.tsx` does not assert on the diff renderer's
 * own output — that renderer is a separately-built chunk this test
 * environment does not load.
 */

afterEach(cleanup)

const commit = (over: Partial<Commit> = {}): Commit => ({
  oid: "f0c283c",
  message: "Add Bun logo",
  authorAvatarUrl: "https://avatars.githubusercontent.com/u/1",
  committerName: "Jarred Sumner",
  committerEmail: "jarred@jarredsumner.com",
  committedDate: "2022-07-06T04:12:45.000-07:00",
  ...over
})

const blamed = (over: Partial<Blamed> = {}): Blamed => ({
  ranges: [{ start: 1, end: 3, commitOid: "f0c283c" }],
  commits: new Map([["f0c283c", commit()]]),
  ignoreRevsPresent: false,
  lines: ["one", "two", "three"],
  ...over
})

const showing = (load: Load<Blamed>, over: Partial<Parameters<typeof BlameScreen>[0]> = {}) =>
  render(
    <BlameScreen
      repo={{ owner: "oven-sh", repo: "bun" }}
      branch="main"
      path="README.md"
      load={load}
      onStepAside={() => {}}
      signedIn={() => true}
      {...over}
    />
  )

describe("a file's blame", () => {
  test("says it is reading before it has anything to show", async () => {
    showing(() => Effect.never as Effect.Effect<Blamed>)

    expect(await screen.findByText(/Reading this file's blame/)).toBeTruthy()
  })

  test("says which file and which branch, once it has read either way", async () => {
    showing(() => Effect.succeed(blamed()))

    expect(await screen.findByText("README.md")).toBeTruthy()
    expect(await screen.findByText("main")).toBeTruthy()
  })

  test("says nothing about an Ignore File where the repository keeps none", async () => {
    showing(() => Effect.succeed(blamed({ ignoreRevsPresent: false })))

    await screen.findByText("README.md")
    expect(screen.queryByText(/git-blame-ignore-revs/)).toBeNull()
  })

  test("names the Ignore File where the repository keeps one", async () => {
    showing(() => Effect.succeed(blamed({ ignoreRevsPresent: true })))

    expect(await screen.findByText(/git-blame-ignore-revs/)).toBeTruthy()
  })

  test("says the read failed, naming the file", async () => {
    showing(() => Effect.fail(new Error("nope")))

    expect(await screen.findByText(/The blame of README.md/)).toBeTruthy()
  })
})
