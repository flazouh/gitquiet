import { Option } from "effect"
import { describe, expect, test } from "bun:test"
import type { ChangedFile } from "./PullRequest"
import { apart, looksLikeTest } from "./testing"

const changed = (path: string, added = 1, deleted = 0): ChangedFile => ({
  path,
  digest: path,
  changeType: "modified",
  linesAdded: added,
  linesDeleted: deleted,
  readByViewer: false,
  diff: Option.none()
})

describe("which files are there to prove the rest", () => {
  test("reads the suffix every language settled on", () => {
    for (const path of [
      "src/ui/Verdict.test.tsx",
      "src/domain/checks.spec.ts",
      "internal/server/router_test.go",
      "app/models/user_spec.rb",
      "lib/parser/test_lexer.py",
      "packages/react-dom/src/ReactPortal-test.js",
      "src/main/java/AccountTest.java",
      "src/Account.Tests.cs"
    ]) {
      expect(looksLikeTest(path)).toBe(true)
    }
  })

  test("reads a folder the whole tree agrees is for proving", () => {
    for (const path of [
      "test/helpers.ts",
      "tests/snapshots.ts",
      "src/__tests__/helpers.ts",
      "src/__mocks__/fs.ts",
      "spec/support/matchers.rb",
      "specs/pricing.rb",
      "e2e/checkout.ts",
      "cypress/support/commands.js",
      "internal/parser/testdata/valid.json",
      "src/ui/__snapshots__/card.snap"
    ]) {
      expect(looksLikeTest(path)).toBe(true)
    }
  })

  /*
   * `fixtures/` was in this set and came out of it: seed data, sample payloads and
   * demo content live under that name in plenty of repositories, and calling a
   * production file proof tells the reader they may skip a change they may not.
   */
  test("leaves alone the folders that are only sometimes for proving", () => {
    expect(looksLikeTest("src/fixtures/countries.json")).toBe(false)
  })

  /*
   * A whole segment, never a substring, and never a word that merely starts with one.
   *
   * `latest.ts` and `contest/` are the two that catch a naive `includes`, and
   * `src/testing/` is the one that catches a naive prefix: a library that ships a
   * testing helper ships production code, and counting it as proof would say the
   * change is smaller than it is — the one direction this must never be wrong in.
   */
  test("leaves alone a name that only reads like one", () => {
    for (const path of [
      "src/ui/latest.ts",
      "app/contest/rules.ts",
      "src/testing/harness.ts",
      "docs/protest.md",
      "src/attest.ts"
    ]) {
      expect(looksLikeTest(path)).toBe(false)
    }
  })
})

describe("a change and its proof, held apart", () => {
  test("puts every file in one list or the other, and keeps the order", () => {
    const split = apart([
      changed("src/domain/checks.ts", 40, 10),
      changed("src/domain/checks.test.ts", 300, 5),
      changed("tests/snapshots.ts", 12, 0),
      changed("README.md", 3, 1)
    ])

    expect(split.code.map((file) => file.path)).toEqual(["src/domain/checks.ts", "README.md"])
    expect(split.tests.map((file) => file.path)).toEqual([
      "src/domain/checks.test.ts",
      "tests/snapshots.ts"
    ])
  })

  test("hands back an empty list where no proof was touched", () => {
    expect(apart([changed("README.md", 3, 1)]).tests).toEqual([])
  })
})
