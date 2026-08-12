import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { CheckState } from "./PullRequest"
import { type Listed, actionsIn, refIn, strandsIn } from "./strand"

/**
 * Runs off the real list, in the shape their page gives them.
 *
 * Read from `tests/fixtures/actionsList.html` on 2026-08-04: twenty-five runs over twelve
 * refs, of which two are pull refs whose pull requests also appear on head branches. The
 * cases below are that page's own shapes and not invented ones.
 */
const listed = (
  what: Partial<Listed> & Pick<Listed, "number" | "startedAt" | "ref">
): Listed => ({
  run: `30${what.number}`,
  url: `/o/r/actions/runs/30${what.number}`,
  workflow: "ci",
  file: "ci.yml",
  title: "fix(events): bound the in-memory queue by retained bytes",
  state: "succeeded" as CheckState,
  seconds: 228,
  actor: "flazouh",
  trigger: "synchronize",
  pullRequest: null,
  ...what
})

const onBranch = (name: string) => ({ kind: "branch", name }) as const
const onPull = (number: string) => ({ kind: "pull", number }) as const

describe("the address of an Actions tab", () => {
  test("reads the repository out of the tab's own address", () => {
    expect(actionsIn("https://github.com/octo-org/octo-repo/actions")).toEqual(
      Option.some({ owner: "octo-org", repo: "octo-repo" })
    )
  })

  test("reads it with their filters on the end, which this screen does not use", () => {
    expect(actionsIn("https://github.com/o/r/actions?query=branch%3Amain")).toEqual(
      Option.some({ owner: "o", repo: "r" })
    )
    expect(actionsIn("https://github.com/o/r/actions/")).toEqual(
      Option.some({ owner: "o", repo: "r" })
    )
  })

  /*
   * A run has its own screen and `runAddressIn` reads that address. A workflow's own page is
   * this list filtered to one workflow, which stays GitHub's until this screen can filter.
   */
  test("leaves a run and a workflow to the screens that have them", () => {
    expect(actionsIn("https://github.com/o/r/actions/runs/30898662600")).toEqual(Option.none())
    expect(actionsIn("https://github.com/o/r/actions/workflows/ci.yml")).toEqual(Option.none())
    expect(actionsIn("https://github.com/o/r/actions/caches")).toEqual(Option.none())
  })

  test("says nothing for anything that is not an Actions tab", () => {
    expect(actionsIn("https://github.com/o/r/pulls")).toEqual(Option.none())
    expect(actionsIn("https://example.com/o/r/actions")).toEqual(Option.none())
    expect(actionsIn("not an address")).toEqual(Option.none())
  })
})

describe("the ref a run was against", () => {
  test("reads a head branch as the branch it is", () => {
    expect(refIn("refs/heads/alex/queue-byte-budget")).toEqual(
      onBranch("alex/queue-byte-budget")
    )
  })

  /*
   * Their list writes a head branch without the prefix and a pull ref with it, so both
   * spellings arrive at this function and both have to be read.
   */
  test("reads a bare name as a branch, which is how their list writes one", () => {
    expect(refIn("alex/queue-byte-budget")).toEqual(onBranch("alex/queue-byte-budget"))
  })

  /*
   * How a `pull_request_target` workflow is run. The number in it is the pull request, which
   * is what lets a CodeQL run on `refs/pull/1758/head` join the `ci` runs on that pull
   * request's own branch instead of standing beside them as a second row for one thing.
   */
  test("reads a pull ref as the pull request it is", () => {
    expect(refIn("refs/pull/1758/head")).toEqual(onPull("1758"))
    expect(refIn("refs/pull/1749/merge")).toEqual(onPull("1749"))
  })
})

describe("folding runs into strands", () => {
  test("puts every run of one branch in one strand", () => {
    const runs = [
      listed({ number: "9857", startedAt: "2026-08-04T11:58:40Z", ref: onBranch("alex/one") }),
      listed({ number: "9845", startedAt: "2026-08-04T10:12:00Z", ref: onBranch("alex/one") }),
      listed({ number: "9839", startedAt: "2026-08-04T09:01:00Z", ref: onBranch("alex/one") })
    ]

    const strands = strandsIn(runs)

    expect(strands).toHaveLength(1)
    expect(strands[0]?.branch).toBe("alex/one")
    expect(strands[0]?.runs).toHaveLength(3)
  })

  /*
   * The whole reason a Strand is not a ref. On the read page, pull request 1758 had three
   * `ci` runs on its head branch and three `CodeQL` runs on `refs/pull/1758/head`. Grouped
   * by ref, one pull request is two rows of the screen.
   */
  test("joins a pull ref to the branch of the same pull request", () => {
    const runs = [
      listed({
        number: "9856",
        startedAt: "2026-08-04T11:31:00Z",
        ref: onBranch("alex/live-tail"),
        pullRequest: "1758"
      }),
      listed({
        number: "9018",
        startedAt: "2026-08-04T11:07:00Z",
        ref: onPull("1758"),
        workflow: "CodeQL"
      })
    ]

    const strands = strandsIn(runs)

    expect(strands).toHaveLength(1)
    expect(strands[0]?.pullRequest).toBe("1758")
    expect(strands[0]?.branch).toBe("alex/live-tail")
    expect(strands[0]?.runs).toHaveLength(2)
  })

  /*
   * Their `Comment Cop` rows on `oven-sh/bun/actions` name no ref. The row names the pull
   * request, so the Run belongs with the rest of that pull request's Runs.
   */
  test("joins a run that names no ref to the pull request its row names", () => {
    const runs = [
      listed({
        number: "11317",
        startedAt: "2026-08-04T09:10:00Z",
        ref: onBranch("aalhadxx:fix/issue-19953"),
        pullRequest: "36860"
      }),
      listed({
        number: "8478",
        startedAt: "2026-08-04T09:00:00Z",
        ref: null,
        pullRequest: "36860",
        workflow: "Comment Cop"
      })
    ]

    const strands = strandsIn(runs)

    expect(strands).toHaveLength(1)
    expect(strands[0]?.branch).toBe("aalhadxx:fix/issue-19953")
    expect(strands[0]?.latest.map((one) => one.workflow)).toEqual(["ci", "Comment Cop"])
  })

  test("keeps two branches with no pull request apart", () => {
    const runs = [
      listed({ number: "9857", startedAt: "2026-08-04T11:58:00Z", ref: onBranch("alex/one") }),
      listed({ number: "9850", startedAt: "2026-08-04T10:00:00Z", ref: onBranch("alex/two") })
    ]

    expect(strandsIn(runs)).toHaveLength(2)
  })

  /*
   * A pull ref with no branch row of its own is still a strand. `refs/pull/1749/head` had one
   * CodeQL run and the branch it came from was not on the page, so the strand has a pull
   * request and no branch name to show.
   */
  test("stands a pull ref on its own where no branch row names that pull request", () => {
    const runs = [listed({ number: "9019", startedAt: "2026-08-04T11:07:00Z", ref: onPull("1749") })]

    const strands = strandsIn(runs)

    expect(strands[0]?.pullRequest).toBe("1749")
    expect(strands[0]?.branch).toBeNull()
  })
})

describe("what a strand says about itself", () => {
  const head = "fix(worker): bound live tail memory"
  const older = "fix(worker): an earlier go at it"

  const fourRuns = [
    listed({
      number: "9856",
      startedAt: "2026-08-04T11:31:00Z",
      ref: onBranch("alex/live-tail"),
      state: "failed",
      title: head
    }),
    listed({
      number: "9849",
      startedAt: "2026-08-04T10:44:00Z",
      ref: onBranch("alex/live-tail"),
      state: "succeeded",
      title: head
    }),
    listed({
      number: "9844",
      startedAt: "2026-08-04T09:30:00Z",
      ref: onBranch("alex/live-tail"),
      state: "succeeded",
      title: older
    })
  ]

  test("takes its head from the newest run, whatever order they arrived in", () => {
    const strand = strandsIn([...fourRuns].reverse())[0]

    expect(strand?.head).toBe(head)
  })

  /*
   * Against that head, not against the branch. Two earlier goes at the same branch are two
   * runs of something the reader has already moved past, and counting them would say four
   * runs are waiting on a commit that has two.
   */
  test("counts only the runs against that head", () => {
    expect(strandsIn(fourRuns)[0]?.onHead).toBe(2)
  })

  /*
   * Red the moment one run on the head is red, whatever the ones after it did. Taking the
   * standing from the newest run alone would report a re-run that passed and lose the
   * failure beside it.
   */
  test("is as bad as the worst run on its head", () => {
    expect(strandsIn(fourRuns)[0]?.state).toBe("failed")
  })

  test("is green where every run on its head is green", () => {
    const green = fourRuns.map((one) => ({ ...one, state: "succeeded" as CheckState }))

    expect(strandsIn(green)[0]?.state).toBe("succeeded")
  })

  test("dates itself by its newest run, which is what the screen orders on", () => {
    expect(strandsIn(fourRuns)[0]?.startedAt).toBe("2026-08-04T11:31:00Z")
  })
})

/*
 * Read off the live page on 2026-08-04, where the first two rows were both wrong.
 *
 * A second Run of one workflow against one commit is a re-run, and a re-run answers the
 * question its attempt asked. The worst of every attempt said "Cancelled" over a Strand whose
 * `ci` was running at that moment, and "Failure" over a Strand a re-run had already fixed.
 */
describe("a workflow run more than once against one commit", () => {
  const head = "fix(worker): bound live tail memory"
  const attempt = (
    number: string,
    at: string,
    state: CheckState,
    workflow = "ci"
  ): Listed =>
    listed({
      number,
      startedAt: at,
      ref: onBranch("alex/live-tail"),
      state,
      title: head,
      workflow
    })

  /* Row one of the live page: in progress over a cancelled attempt and a success. */
  const running = [
    attempt("9881", "2026-08-04T12:10:00Z", "running"),
    attempt("9880", "2026-08-04T11:40:00Z", "cancelled"),
    attempt("9871", "2026-08-04T10:10:00Z", "succeeded")
  ]

  /* Row two: two successes over the failure and the cancellation they re-ran. */
  const fixed = [
    attempt("9879", "2026-08-04T12:05:00Z", "succeeded"),
    attempt("9872", "2026-08-04T11:20:00Z", "succeeded"),
    attempt("9870", "2026-08-04T10:30:00Z", "failed"),
    attempt("9869", "2026-08-04T10:00:00Z", "cancelled")
  ]

  test("stands on the newest attempt of that workflow and not on the worst", () => {
    expect(strandsIn(running)[0]?.state).toBe("running")
    expect(strandsIn(fixed)[0]?.state).toBe("succeeded")
  })

  test("keeps one run per workflow as what the head came to", () => {
    const strand = strandsIn(running)[0]

    expect(strand?.latest.map((one) => one.number)).toEqual(["9881"])
    expect(strand?.superseded).toBe(2)
    expect(strand?.onHead).toBe(3)
  })

  /*
   * Across workflows and not across attempts. Two workflows of one commit are two results and
   * a red one is a red head, however green the other is.
   */
  test("is as bad as the worst workflow on the head", () => {
    const both = [
      attempt("9879", "2026-08-04T12:05:00Z", "succeeded"),
      attempt("9018", "2026-08-04T12:00:00Z", "failed", "CodeQL")
    ]

    const strand = strandsIn(both)[0]

    expect(strand?.state).toBe("failed")
    expect(strand?.latest.map((one) => one.workflow)).toEqual(["ci", "CodeQL"])
    expect(strand?.superseded).toBe(0)
  })

  test("counts the runs against a commit the work has moved past", () => {
    const strand = strandsIn([
      ...running,
      attempt("9850", "2026-08-04T09:00:00Z", "succeeded"),
      attempt("9849", "2026-08-04T08:00:00Z", "failed")
    ].map((one, at) => (at < 3 ? one : { ...one, title: "an earlier commit" })))[0]

    expect(strand?.earlier).toBe(2)
    expect(strand?.state).toBe("running")
  })
})

describe("the order strands are given in", () => {
  /*
   * Newest first, because the thing a reader came to look at is the thing that just ran.
   * Their own page orders runs that way and grouping must not lose it.
   */
  test("puts the strand that ran most recently first", () => {
    const runs = [
      listed({ number: "9800", startedAt: "2026-08-04T08:00:00Z", ref: onBranch("alex/old") }),
      listed({ number: "9857", startedAt: "2026-08-04T11:58:00Z", ref: onBranch("alex/new") }),
      listed({ number: "9840", startedAt: "2026-08-04T10:00:00Z", ref: onBranch("alex/middle") })
    ]

    expect(strandsIn(runs).map((one) => one.branch)).toEqual([
      "alex/new",
      "alex/middle",
      "alex/old"
    ])
  })

  test("gives nothing back for a page with no runs on it", () => {
    expect(strandsIn([])).toEqual([])
  })
})
