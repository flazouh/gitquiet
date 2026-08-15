import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type {
  Check,
  CheckState,
  Commit,
  MergeState,
  Participant,
  ReviewThread,
  ThreadComment
} from "./PullRequest"
import { attentionIn, docketsIn, type Owing } from "./attention"

const person = (login: string): Participant => ({
  login,
  isAutomated: false,
  faceUrl: Option.none()
})

const machine = (login: string): Participant => ({
  login,
  isAutomated: true,
  faceUrl: Option.none()
})

const said = (author: Participant): ThreadComment => ({
  author,
  body: "…",
  html: "<p>…</p>",
  createdAt: "2026-08-04T00:00:00Z"
})

const thread = (
  id: string,
  spoke: ReadonlyArray<Participant>,
  isResolved = false
): ReviewThread => ({
  id,
  isResolved,
  at: Option.none(),
  comments: spoke.map(said)
})

const check = (name: string, state: CheckState): Check => ({
  name,
  state,
  isRequired: true,
  summary: "",
  url: `https://github.com/checks/${name}`,
  durationSeconds: 0
})

const commit = (sha: string): Commit => ({
  sha,
  abbreviatedSha: sha.slice(0, 7),
  author: "dana",
  headline: `what ${sha} did`,
  createdAt: "2026-08-04T00:00:00Z"
})

const level: MergeState = {
  isMergeable: true,
  blockers: [],
  queue: Option.none(),
  autoMerge: Option.none(),
  update: Option.none(),
  mayBypass: false,
  channels: [],
  stack: Option.none()
}

const owing = (some: Partial<Owing> = {}): Owing => ({
  viewer: "alex",
  state: "open",
  threads: [],
  checks: [],
  commits: [],
  lastReviewPoint: Option.none(),
  merge: level,
  ...some
})

/** Where one item landed, for a test that cares about the Court and nothing else. */
const courts = (some: Partial<Owing>): ReadonlyArray<string> =>
  attentionIn(owing(some)).map((item) => item.court)

const alex = person("alex")
const other = person("dana")
const bot = machine("copilot")

describe("what a pull request owes, thread by thread", () => {
  test("a thread somebody else spoke in last is yours to answer", () => {
    expect(courts({ threads: [thread("1", [alex, other])] })).toEqual(["needs-you"])
  })

  test("a thread you spoke in last waits on the person you said it to", () => {
    expect(courts({ threads: [thread("1", [other, alex])] })).toEqual(["waiting"])
  })

  test("a resolved thread is settled, whoever happened to speak in it last", () => {
    expect(courts({ threads: [thread("1", [alex, other], true)] })).toEqual(["settled"])
  })

  test("a thread with nothing said in it is not a thing owed to anyone", () => {
    expect(attentionIn(owing({ threads: [thread("1", [])] }))).toEqual([])
  })

  test("a finding is a thread a machine opened, and it says so", () => {
    const [item] = attentionIn(owing({ threads: [thread("1", [bot])] }))

    expect(item?.kind).toBe("finding")
  })

  test("a finding nobody has answered is yours", () => {
    expect(courts({ threads: [thread("1", [bot])] })).toEqual(["needs-you"])
  })

  /*
   * Counted over the last twenty pull requests of `octo-org/octo-repo`, on
   * the 67 findings a person answered: a person resolved 50, the machine came
   * back for 12, and 5 are still open. So the answer does not hand the thread
   * back to the machine three times in four. It is a person who ends it, and on
   * the reader's own pull request that person is the reader.
   *
   * It was Running before this, which is the Court that means "skip it", and the
   * five still open are what that advice produces.
   */
  test("a finding you answered is yours, a person being the one who ends it", () => {
    expect(courts({ threads: [thread("1", [bot, alex])] })).toEqual(["needs-you"])
  })

  /*
   * Which leaves Running holding checks alone, and holding them honestly: every
   * item in it is now a thing that moves on its own while nobody watches.
   */
  test("leaves no thread in Running, that Court being for what is under way", () => {
    const items = attentionIn(
      owing({ threads: [thread("1", [bot, alex]), thread("2", [alex]), thread("3", [other])] })
    )

    expect(items.filter((item) => item.court === "running")).toEqual([])
  })
})

describe("what a pull request owes, everything that is not a thread", () => {
  test("a failing check is yours, a running one is the machine's, a green one is done", () => {
    expect(
      courts({
        checks: [check("test", "failed"), check("build", "running"), check("lint", "succeeded")]
      })
    ).toEqual(["needs-you", "running", "settled"])
  })

  test("a check somebody stopped is yours, nothing else being able to start it again", () => {
    expect(courts({ checks: [check("test", "cancelled")] })).toEqual(["needs-you"])
  })

  /*
   * A failure the workflow was written to carry on past owes nobody anything: the
   * run concluded a success, so there is no move to make and nothing to fix before
   * merging. Their own page owes it a red mark and a place in the count, which is
   * [#15452](https://github.com/orgs/community/discussions/15452).
   */
  test("a check its run was told to carry on past is settled, not the reader's move", () => {
    expect(courts({ checks: [check("flaky-e2e", "tolerated")] })).toEqual(["settled"])
  })

  test("a branch level with its base is not something owed", () => {
    expect(attentionIn(owing({ merge: level }))).toEqual([])
  })

  test("a branch behind is yours where you may catch it up", () => {
    const behind: MergeState = {
      ...level,
      update: Option.some({ how: "MERGE", mayUpdate: true, refusal: Option.none() })
    }

    expect(courts({ merge: behind })).toEqual(["needs-you"])
  })

  test("a branch behind waits where somebody else holds the write", () => {
    const behind: MergeState = {
      ...level,
      update: Option.some({
        how: "MERGE",
        mayUpdate: false,
        refusal: Option.some("You do not have write access to this fork")
      })
    }

    expect(courts({ merge: behind })).toEqual(["waiting"])
  })
})

describe("what has landed since you last reviewed", () => {
  const walked = [commit("aaa"), commit("bbb"), commit("ccc")]

  test("the commits after your last review point are yours to read again", () => {
    const [item] = attentionIn(
      owing({ commits: walked, lastReviewPoint: Option.some("aaa") })
    )

    expect(item?.kind).toBe("since")
    expect(item?.court).toBe("needs-you")
    expect(item?.kind === "since" ? item.landed.map((one) => one.sha) : []).toEqual(["bbb", "ccc"])
  })

  test("a reader who has never reviewed this is owed no delta", () => {
    // The whole pull request is their delta, and the tree says so better than a
    // count would.
    expect(attentionIn(owing({ commits: walked }))).toEqual([])
  })

  test("a review point at the head is nothing new to read", () => {
    expect(attentionIn(owing({ commits: walked, lastReviewPoint: Option.some("ccc") }))).toEqual([])
  })

  test("a review point no commit answers to says the branch was rewritten", () => {
    // GitHub's own answer here is "We went looking everywhere, but couldn't find
    // those commits", which leaves the reader to work out that a rebase happened
    // and that their last review no longer anchors anywhere.
    const [item] = attentionIn(
      owing({ commits: walked, lastReviewPoint: Option.some("gone") })
    )

    expect(item?.kind).toBe("rewritten")
    expect(item?.court).toBe("needs-you")
  })
})

describe("the four Courts of one pull request", () => {
  const busy = owing({
    threads: [thread("1", [other]), thread("2", [other, alex]), thread("3", [bot, alex])],
    checks: [check("test", "failed"), check("lint", "succeeded")],
    commits: [commit("aaa"), commit("bbb")],
    lastReviewPoint: Option.some("aaa"),
    merge: {
      ...level,
      update: Option.some({ how: "REBASE", mayUpdate: true, refusal: Option.none() })
    }
  })

  test("hold every item between them, each in exactly one", () => {
    const items = attentionIn(busy)
    const filed = docketsIn(items).flatMap((docket) => docket.items)

    expect(filed.length).toBe(items.length)
    expect(new Set(filed.map((item) => item.id)).size).toBe(items.length)
  })

  test("come back in the order a reader asks about them, the empty ones included", () => {
    expect(docketsIn(attentionIn(owing())).map((docket) => docket.court)).toEqual([
      "needs-you",
      "waiting",
      "running",
      "settled"
    ])
  })

  test("count what is in them, which is what a heading says without being opened", () => {
    expect(
      Object.fromEntries(docketsIn(attentionIn(busy)).map((one) => [one.court, one.count]))
    ).toEqual({ "needs-you": 5, waiting: 1, running: 0, settled: 1 })
  })

  test("a merged pull request owes nobody anything, whatever is unresolved on it", () => {
    // Every unanswered thread and every unread commit survives the merge, and
    // none of them is a move anyone can still make.
    const landed = { ...busy, state: "merged" as const }

    expect(new Set(attentionIn(landed).map((item) => item.court))).toEqual(new Set(["settled"]))
  })

  test("a closed one the same, which is the same fact by a different door", () => {
    expect(new Set(attentionIn({ ...busy, state: "closed" }).map((one) => one.court))).toEqual(
      new Set(["settled"])
    )
  })
})
