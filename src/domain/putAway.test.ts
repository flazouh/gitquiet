import { describe, expect, test } from "bun:test"
import { curated, putAwayEntry, putAwayIn, putAwayKey } from "./putAway"
import { type Listed, strandsIn } from "./strand"

const repo = { owner: "octo-org", repo: "octo-repo" }

const listed = (
  what: Partial<Listed> & Pick<Listed, "number" | "startedAt" | "ref">
): Listed => ({
  run: `30${what.number}`,
  url: `/octo-org/octo-repo/actions/runs/30${what.number}`,
  workflow: "ci",
  file: "ci.yml",
  title: "fix(events): bound the in-memory queue by retained bytes",
  state: "succeeded",
  seconds: 228,
  actor: "flazouh",
  trigger: "synchronize",
  pullRequest: null,
  ...what
})

const onBranch = (name: string) => ({ kind: "branch", name }) as const

describe("the name a workflow is put away under", () => {
  test("is the file, where their page named one", () => {
    expect(
      putAwayKey(
        listed({
          number: "9018",
          startedAt: "2026-08-04T11:07:00Z",
          ref: onBranch("main"),
          workflow: "CodeQL",
          file: "github-code-scanning/codeql"
        })
      )
    ).toBe("github-code-scanning/codeql")
  })

  /*
   * A Workflow past the first page of their sidebar, and a Workflow two files share a `name:`
   * with. The name is what the reader pressed and it is the only name there is.
   */
  test("is the workflow's own name, where it did not", () => {
    expect(
      putAwayKey(
        listed({
          number: "8478",
          startedAt: "2026-08-04T09:00:00Z",
          ref: onBranch("main"),
          workflow: "Comment Cop",
          file: null
        })
      )
    ).toBe("Comment Cop")
  })
})

describe("what the reader put away in one repository", () => {
  const kept = [
    putAwayEntry(repo, "github-code-scanning/codeql"),
    putAwayEntry({ owner: "oven-sh", repo: "bun" }, "comment-cop.yml"),
    putAwayEntry(repo, "Code Quality: PR")
  ]

  test("is theirs alone, and leaves another repository's alone", () => {
    expect(putAwayIn(kept, repo)).toEqual(["github-code-scanning/codeql", "Code Quality: PR"])
  })

  test("is nothing at all where they have put nothing away here", () => {
    expect(putAwayIn(kept, { owner: "octo-org", repo: "other" })).toEqual([])
  })

  test("does not read a repository whose name starts the same way", () => {
    expect(putAwayIn([putAwayEntry(repo, "ci.yml")], { owner: "octo-org", repo: "octo" })).toEqual(
      []
    )
  })
})

/*
 * The fold, done again with the Runs of a put-away Workflow taken out of it. Every number on a
 * Strand is a count of Runs, so taking Runs out and re-reading the counts is the only reading
 * that stays true: a head, a standing and a superseded count are all answers about which Runs
 * are on the screen.
 */
describe("a list with a workflow put away", () => {
  const bothOnOneHead = [
    listed({
      number: "9856",
      startedAt: "2026-08-04T11:31:00Z",
      ref: onBranch("alex/live-tail-liveness"),
      pullRequest: "1760"
    }),
    listed({
      number: "9018",
      startedAt: "2026-08-04T11:07:00Z",
      ref: onBranch("alex/live-tail-liveness"),
      pullRequest: "1760",
      workflow: "CodeQL",
      file: "github-code-scanning/codeql",
      state: "failed"
    })
  ]

  test("draws the list as it stands where nothing is put away", () => {
    expect(curated(strandsIn(bothOnOneHead), []).strands).toEqual(strandsIn(bothOnOneHead))
  })

  test("takes every run of it off the rows", () => {
    const { strands } = curated(strandsIn(bothOnOneHead), ["github-code-scanning/codeql"])

    expect(strands).toHaveLength(1)
    expect(strands[0]?.latest.map((one) => one.workflow)).toEqual(["ci"])
    expect(strands[0]?.runs).toHaveLength(1)
  })

  /*
   * The point of the whole thing, and the complaint underneath
   * [#12025](https://github.com/orgs/community/discussions/12025): a Workflow the reader has
   * put away does not get to say what the work came to. This head is green in `ci` and red in
   * CodeQL, and their own row would report the work as red for as long as CodeQL is on the page.
   */
  test("stops it speaking for the work", () => {
    expect(strandsIn(bothOnOneHead)[0]?.state).toBe("failed")
    expect(curated(strandsIn(bothOnOneHead), ["github-code-scanning/codeql"]).strands[0]?.state).toBe(
      "succeeded"
    )
  })

  test("takes the whole strand away where it was the only workflow on it", () => {
    const alone = [
      listed({
        number: "9019",
        startedAt: "2026-08-04T11:09:00Z",
        ref: onBranch("dependabot/npm_and_yarn/vite-7.1.14"),
        workflow: "Dependabot Updates",
        file: "dependabot/dependabot-updates"
      })
    ]

    expect(curated(strandsIn(alone), ["dependabot/dependabot-updates"]).strands).toEqual([])
  })

  /*
   * A decision keyed on the file and not on the word their row prints, which is
   * [#26256](https://github.com/orgs/community/discussions/26256): 419 readers whose Actions tab
   * still names a Workflow they renamed. One commit changes `name:` and every row changes with
   * it, and a reader should not have to put the same file away twice over one edit.
   */
  test("holds through a rename of the workflow's own name", () => {
    const renamed = bothOnOneHead.map((one) =>
      one.workflow === "CodeQL" ? { ...one, workflow: "Code scanning" } : one
    )

    expect(curated(strandsIn(renamed), ["github-code-scanning/codeql"]).strands[0]?.runs).toHaveLength(
      1
    )
  })

  test("says which workflows are away, and how many runs of each it took out", () => {
    expect(curated(strandsIn(bothOnOneHead), ["github-code-scanning/codeql"]).away).toEqual([
      { key: "github-code-scanning/codeql", workflow: "CodeQL", runs: 1 }
    ])
  })

  /*
   * A Workflow put away weeks ago and quiet since. Nothing on the page names it, and if the
   * count were the only record of it there would be no way back: bringing one back is a press
   * on the thing that says it is away.
   */
  test("still names a workflow this page carries no run of", () => {
    expect(curated(strandsIn(bothOnOneHead), ["release-please.yml"]).away).toEqual([
      { key: "release-please.yml", workflow: "release-please.yml", runs: 0 }
    ])
  })
})
