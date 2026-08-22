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

/** A change and the proof of it, held apart. */
export type Apart = {
  readonly code: ReadonlyArray<ChangedFile>
  readonly tests: ReadonlyArray<ChangedFile>
}

/**
 * The same files in two lists, so a caller can count either or draw either.
 *
 * Two lists rather than two sums, because everything asking this question wants
 * one or the other of those: the band adds them up with the adder it already has
 * for the whole set, and the rail draws the code half as its rows.
 */
export const apart = (files: ReadonlyArray<ChangedFile>): Apart => ({
  code: files.filter((file) => !looksLikeTest(file.path)),
  tests: files.filter((file) => looksLikeTest(file.path))
})
