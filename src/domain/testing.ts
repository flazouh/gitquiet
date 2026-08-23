import type { ChangedFile } from "./PullRequest"

/**
 * Which of the changed files are there to prove the rest, read off the path alone.
 *
 * A pull request of nine hundred lines where seven hundred are a table of cases is
 * a small change and a long proof, and a reader deciding whether to open it now is
 * asking about the first number. Nothing GitHub sends says which files are which —
 * there is no flag on a file for it, the way there is for generated content — so it
 * is read off the name, which is the one thing every language's convention writes
 * down.
 *
 * Per file, and no further. A Rust unit test lives inside the file it proves, under
 * `#[cfg(test)]`, and a Go table test sits beside the function it exercises; taking
 * those out means reading every hunk through a parser for the language it is in, and
 * getting that half right is worse than not offering it. So what this says is about
 * whole files, and what it says about a Rust repository is that it found nothing.
 *
 * Wrong in one direction only. A production file counted as proof is a change the
 * reader is told they can skip, so every rule here matches a whole path segment or
 * a whole name, and never a substring: `contest/`, `latest.ts` and `src/testing/`
 * are what the looser forms of these rules catch.
 */
export const looksLikeTest = (path: string): boolean => {
  const parts = path.split("/")
  const file = parts.at(-1) ?? path
  if (NAMED.has(file)) return true
  if (parts.slice(0, -1).some((part) => FOLDERS.has(part))) return true

  const stem = named(file)
  return DOTTED.test(stem) || SCORED.test(stem) || CAPPED.test(stem)
}

/** A whole path segment that says everything under it is proof. */
const FOLDERS: ReadonlySet<string> = new Set([
  "test",
  "tests",
  "__tests__",
  "__mocks__",
  "__snapshots__",
  "spec",
  "specs",
  "e2e",
  "cypress",
  "testdata"
])

/** `checks.test.ts`, `checks.spec.tsx`: the dot form, as JavaScript and its neighbours write it. */
const DOTTED = /\.(test|spec)$/

/**
 * `router_test.go`, `user_spec.rb`, `test_lexer.py`, `ReactPortal-test.js`: the joined
 * forms, as Go, Ruby, Python and React write them.
 */
const SCORED = /(^test_|[_-]test$|[_-]spec$)/

/** `AccountTest.java`, `Account.Tests.cs`: the capitalised forms, as Java and C# write them. */
const CAPPED = /(Test|Tests|Spec|Specs)$/

/** The names that are proof by the whole name, and match none of the forms above. */
const NAMED: ReadonlySet<string> = new Set(["conftest.py"])

/**
 * Everything before the extension, so a rule reads the name a person chose.
 *
 * `checks.test.ts` leaves `checks.test`, which is what {@link DOTTED} is written
 * against, and `router_test.go` leaves `router_test`.
 */
const named = (file: string): string => {
  const dot = file.lastIndexOf(".")
  return dot <= 0 ? file : file.slice(0, dot)
}

/**
 * Which of the three lists a reader is holding: the pull request, the change it
 * makes, or the cases that prove it.
 *
 * Three rather than two because reading a change and reading its proof are two
 * passes, and only one of them had a home. A reader checking that a fix is
 * covered used to scroll past nine files to reach four.
 */
export type Held = "all" | "code" | "tests"

/** A change and the proof of it, held apart, and the two of them together. */
export type Apart = Readonly<Record<Held, ReadonlyArray<ChangedFile>>>

/**
 * The same files in three lists, so a caller can count any of them or draw any
 * of them.
 *
 * Lists rather than sums, because everything asking this question wants one of
 * those: the band adds a list up with the adder it already has for a set of
 * files, and the rail draws a list as its rows.
 *
 * Keyed by the thing a reader picks, so that picking is a lookup. A caller that
 * held `code` and `tests` had to write the three-way choice out as a chain of
 * ifs, and every screen that offered the choice wrote its own; the whole set is
 * one of the answers, so it belongs beside the other two.
 */
export const apart = (files: ReadonlyArray<ChangedFile>): Apart => ({
  all: files,
  code: files.filter((file) => !looksLikeTest(file.path)),
  tests: files.filter((file) => looksLikeTest(file.path))
})

/**
 * Whether there is a choice to offer at all.
 *
 * Both halves have to hold something. A pull request that is all tests, or one
 * with none, reads one way, and a switch that empties the rail — or that leaves
 * it exactly as it was — is a control that teaches a reader it does nothing.
 *
 * Here rather than in the screen that draws the switch, because the screen that
 * decides which list to draw asks the same question, and the two answers have to
 * be the same answer. Apart, one of them can be loosened alone, and then a
 * stored choice empties the rail while the control that would undo it is gone.
 */
export const splits = (held: Apart): boolean =>
  held.code.length > 0 && held.tests.length > 0
