import { describe, expect, test } from "bun:test"
import { strandsIn } from "../domain/strand"
import { runsOnPage, workflowsOnPage } from "./actionsList"

/*
 * `octo-org/octo-repo/actions` as GitHub served it on 2026-08-04: twenty-five runs over
 * twelve refs, two of which are pull refs whose pull requests are also on head branches. The
 * re-run and delete dialogs, the filter bar and the icon geometry are stripped, because no
 * parser reads them and they were 316KB of the 510KB. Every element and attribute a parser
 * touches is theirs, unedited.
 */
const real = await Bun.file("tests/fixtures/actionsList.html").text()

const runs = runsOnPage(real)

describe("reading their list page", () => {
  test("finds every run on it", () => {
    expect(runs).toHaveLength(25)
  })

  test("reads the newest run's facts as their page prints them", () => {
    const first = runs[0]

    expect(first?.number).toBe("9857")
    expect(first?.workflow).toBe("ci")
    expect(first?.run).toBe("30898662600")
    expect(first?.state).toBe("succeeded")
    expect(first?.title).toBe("fix(events): bound the in-memory queue by retained bytes APP-1033")
    expect(first?.seconds).toBe(228)
    expect(first?.actor).toBe("flazouh")
    expect(first?.pullRequest).toBe("1761")
    expect(first?.startedAt).toBe("2026-08-04T11:58:40+02:00")
  })

  /*
   * The workflow off the row's label and not off `.text-bold`, which on the same row is the
   * commit title as well. Reading the class gave "fix(events): bound the in-memory queue"
   * as the workflow name for all twenty-five rows.
   */
  test("names the workflow and not the commit", () => {
    expect(new Set(runs.map((one) => one.workflow))).toEqual(new Set(["ci", "CodeQL"]))
  })

  test("reads a failed run as failed", () => {
    const failed = runs.filter((one) => one.state === "failed")

    expect(failed).toHaveLength(4)
    expect(failed[0]?.number).toBe("9856")
  })

  test("reads the ref a run was against, in both spellings they write", () => {
    expect(runs[0]?.ref).toEqual({ kind: "branch", name: "alex/queue-byte-budget" })
    expect(runs[8]?.ref).toEqual({ kind: "pull", number: "1749" })
  })

  test("keeps their own word for what set the run off", () => {
    expect(runs[0]?.trigger).toBe("synchronize")
  })

  /*
   * A `pull_request_target` run names no pull request in its row and no trigger word either,
   * only "by flazouh". An empty trigger is the honest answer and the screen leaves it out.
   */
  test("says nothing about the trigger where their row does not", () => {
    expect(runs[8]?.workflow).toBe("CodeQL")
    expect(runs[8]?.pullRequest).toBeNull()
    expect(runs[8]?.trigger).toBe("")
  })

  test("comes back with nothing for a page that is not their list", () => {
    expect(runsOnPage("<html><body><p>Not this</p></body></html>")).toEqual([])
  })

  /*
   * Off their icon, and not off the row's label for a screen reader.
   *
   * That label is "requires action with the application:  Run 11317 of source-lints." and then
   * the commit's title, so a commit whose message carries one of their seven words is read as
   * that outcome. Measured on `oven-sh/bun/actions`, where five runs of a commit titled
   * `fix(console): prepend "Assertion failed: " prefix` were every one of them reported as
   * failures, in the failure colour, over a pull request nothing had failed on.
   */
  test("reads the outcome off their icon and not off the commit title", () => {
    /*
     * Their row's label, with the leading word GitHub really writes for a fork's run that is
     * waiting to be allowed, and their real commit title behind it. The icon still says the
     * run was skipped, and that is what it was.
     */
    const poisoned = refless
      .replace('aria-label="skipped:  Run 8478', 'aria-label="waiting:  Run 8478')
      .replace("prepend prefix</span>", 'prepend "Assertion failed: " prefix</span>')

    expect(runsOnPage(poisoned)[0]?.state).toBe("skipped")
    expect(runsOnPage(real)[0]?.state).toBe("succeeded")
  })

  /*
   * A row of their `Comment Cop` workflow, off `oven-sh/bun/actions` on 2026-08-04, cut to the
   * parts a parser reads. It names no ref at all, which five of that page's twenty-five rows
   * did, and every one of them was dropped: the run is still a run of pull request 36860 and
   * the row says so.
   */
  const refless = `<div class="Box-row" id="check_suite_1">
    <a href="/oven-sh/bun/actions/runs/8478" aria-label="skipped:  Run 8478 of Comment Cop. fix(console): prepend prefix">
      <svg class="octicon octicon-skip" aria-label="skipped: "></svg>
      <span class="markdown-title">fix(console): prepend prefix</span>
    </a>
    <span><span class="text-bold">Comment Cop</span> #8478:
      <span>Pull request <a data-hovercard-type="pull_request" href="/oven-sh/bun/pull/36860">#36860</a>
        synchronize by <a data-hovercard-type="user" href="/aalhadxx">aalhadxx</a></span>
    </span>
    <span class="issue-keyword">4s</span>
    <relative-time datetime="2026-08-04T09:00:00Z"></relative-time>
  </div>`

  test("keeps a run whose row names no ref but names a pull request", () => {
    const [one] = runsOnPage(refless)

    expect(one?.workflow).toBe("Comment Cop")
    expect(one?.state).toBe("skipped")
    expect(one?.ref).toBeNull()
    expect(one?.pullRequest).toBe("36860")
  })

  test("drops a row that names neither a ref nor a pull request", () => {
    expect(runsOnPage(refless.replace(/Pull request[\s\S]*?<\/a>/, ""))).toEqual([])
  })

  /*
   * Their `action_required`, which is a fork's run waiting for a maintainer to allow it. None
   * of the seven words this vocabulary has is that, and queued is the nearest of them: it is
   * waiting, and it is drawn in the colour of something that wants attention.
   */
  test("reads a run waiting for somebody to allow it as waiting", () => {
    const waiting = refless.replaceAll("skipped: ", "requires action with the application: ")

    expect(runsOnPage(waiting)[0]?.state).toBe("queued")
  })
})

/*
 * The list of Workflows down the side of their own page, which this interface draws nowhere.
 * It is read for one field their rows do not carry: the file each Workflow is. A row names a
 * Workflow by its `name:` and by nothing else, and a `name:` is a line somebody edits.
 */
describe("reading the workflows their sidebar names", () => {
  const workflows = workflowsOnPage(real)

  test("finds every workflow on the page, and the file each one is", () => {
    expect(workflows).toEqual([
      { name: "ci", file: "ci.yml" },
      { name: "CodeQL", file: "github-code-scanning/codeql" },
      { name: "Copilot", file: "agents/copilot-pull-request-reviewer" },
      { name: "Dependabot Updates", file: "dependabot/dependabot-updates" },
      { name: "Live model smoke", file: "live-model.yml" },
      { name: "release", file: "release-please.yml" },
      { name: "release-cli", file: "release-cli.yml" },
      { name: "tripwire-review", file: "tripwire-review.yml" }
    ])
  })

  /*
   * Eight Workflows named, two of them run: discussions
   * [#12025](https://github.com/orgs/community/discussions/12025) and
   * [#26256](https://github.com/orgs/community/discussions/26256) are about the other six, and
   * a screen built out of Runs never draws them. The count is here so that stays measured.
   */
  test("names six workflows that nothing on the page ran", () => {
    const ran = new Set(runs.map((one) => one.workflow))

    expect(workflows).toHaveLength(8)
    expect(workflows.filter((one) => !ran.has(one.name))).toHaveLength(6)
  })

  test("gives a run the file of the workflow that ran it", () => {
    expect(runs[0]?.workflow).toBe("ci")
    expect(runs[0]?.file).toBe("ci.yml")
    expect(runs.find((one) => one.workflow === "CodeQL")?.file).toBe(
      "github-code-scanning/codeql"
    )
  })

  const named = (name: string, file: string) =>
    `<li class="actions-workflow-list-item"><a href="/octo-org/octo-repo/actions/workflows/${file}"><span class="ActionListItem-label">${name}</span></a></li>`

  const rowOf = (workflow: string) => `<div class="Box-row">
    <a href="/octo-org/octo-repo/actions/runs/8478" aria-label="completed successfully:  Run 8478 of ${workflow}. a title">
      <svg class="octicon" aria-label="completed successfully: "></svg>
      <span class="markdown-title">a title</span>
    </a>
    <span><span>by <a data-hovercard-type="user" href="/flazouh">flazouh</a></span></span>
    <a class="branch-name" title="main" href="/octo-org/octo-repo/tree/refs/heads/main">main</a>
  </div>`

  test("says nothing about the file where their sidebar names no such workflow", () => {
    expect(runsOnPage(rowOf("Comment Cop"))[0]?.file).toBeNull()
  })

  /*
   * Two files may carry one `name:`, and GitHub allows it. Their row names the name, so which
   * of the two ran is not on the page, and a guess would put a Workflow away that the reader
   * never pressed.
   */
  test("says nothing about the file where two workflows share one name", () => {
    const both = `${named("build", "build.yml")}${named("build", "nightly.yml")}${rowOf("build")}`

    expect(runsOnPage(both)[0]?.file).toBeNull()
  })
})

describe("what the list folds down to", () => {
  const strands = strandsIn(runs)

  /*
   * The claim the screen is built on, measured against the real page: twenty-five rows are ten
   * pull requests and nothing else. Every ref on that page belonged to a pull request.
   */
  test("folds twenty-five runs into ten strands", () => {
    expect(runs).toHaveLength(25)
    expect(strands).toHaveLength(10)
  })

  test("joins the CodeQL runs on a pull ref to that pull request's own branch", () => {
    const of1758 = strands.find((one) => one.pullRequest === "1758")

    expect(of1758?.branch).toBe("alex/effect-beta-102")
    expect(of1758?.runs.map((one) => one.workflow)).toContain("CodeQL")
    expect(of1758?.runs.map((one) => one.workflow)).toContain("ci")
  })

  test("reports a strand as red where a run on its head failed", () => {
    const red = strands.filter((one) => one.state === "failed")

    expect(red.map((one) => one.branch)).toEqual([
      "alex/live-tail-liveness",
      "alex/directory-scan-bounds"
    ])
  })

  test("gives every strand a head commit and a count of the runs on it", () => {
    for (const strand of strands) {
      expect(strand.head).not.toBe("")
      expect(strand.onHead).toBeGreaterThan(0)
    }
  })

  test("puts the strand that ran most recently first", () => {
    expect(strands[0]?.branch).toBe("alex/queue-byte-budget")
  })
})
