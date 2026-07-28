import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { draftWithBotFindings, mergedWithApproval } from "../../tests/fixtures"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { toSnapshot } from "./snapshot"

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }
const merged: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327417 }

const snapshotOf = (reference: PullRequestRef, raw: Parameters<typeof toSnapshot>[1]) =>
  Effect.runPromise(toSnapshot(reference, raw))

/** The draft's payloads, with GitHub answering something else about merging. */
const withMergeState = (state: string) => {
  const box = draftWithBotFindings.mergeBox as {
    mergeRequirements: { state: string; conditions: ReadonlyArray<{ result: string }> }
  }
  return {
    ...draftWithBotFindings,
    mergeBox: {
      ...box,
      mergeRequirements: {
        ...box.mergeRequirements,
        state,
        conditions: box.mergeRequirements.conditions.map((condition) => ({
          ...condition,
          result: "PASSED"
        }))
      }
    }
  }
}

describe("a draft pull request carrying bot findings", () => {
  test("reads the pull request itself", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.title).toBe("Polish multi-file diffs in Agents window")
    expect(snapshot.state).toBe("draft")
    expect(snapshot.author).toEqual({
      login: "romalpani",
      isAutomated: false,
      faceUrl: Option.some("https://avatars.githubusercontent.com/u/48927690?v=4")
    })
    expect(snapshot.baseBranch).toBe("main")
    expect(snapshot.headSha).toBe("cc622d141566291a1788c2b2cf2ce6fa80d6622c")
  })

  test("reports no Last Review Point when the viewer has never reviewed it", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.viewer.login).toBe("flazouh")
    expect(Option.isNone(snapshot.viewer.lastReviewPoint)).toBe(true)
  })

  test("reads the changed files with the viewer's existing Reviewed State", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.files).toHaveLength(5)
    expect(snapshot.files.every((file) => file.changeType === "modified")).toBe(true)
    expect(snapshot.files.every((file) => file.readByViewer === false)).toBe(true)
    expect(snapshot.files.every((file) => file.digest.length > 0)).toBe(true)
  })

  test("carries the diff for a file, with line numbers only where they mean something", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)
    const [file] = snapshot.files
    if (file === undefined) throw new Error("expected at least one changed file")

    const diff = file.diff
    if (Option.isNone(diff)) throw new Error(`expected diff content for ${file.path}`)

    expect(diff.value.isBinary).toBe(false)
    expect(diff.value.lines[0]?.kind).toBe("hunk")

    const added = diff.value.lines.filter((line) => line.kind === "added")
    expect(added.length).toBeGreaterThan(0)
    expect(
      added.every(
        (line) => Option.isSome(line.afterLine) && Option.isNone(line.beforeLine)
      )
    ).toBe(true)
  })

  test("recognises every comment on these threads as automated", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.threads).toHaveLength(2)
    const comments = snapshot.threads.flatMap((thread) => thread.comments)
    expect(comments.every((comment) => comment.author.isAutomated)).toBe(true)
    expect(comments.every((comment) => comment.body.length > 0)).toBe(true)
  })

  test("locates a thread at the file and line it hangs off", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)
    const thread = snapshot.threads.find((one) => one.id === "2478298761")

    expect(Option.getOrUndefined(thread?.at ?? Option.none())).toEqual({
      path: "src/vs/sessions/contrib/changes/browser/media/multiFileDiffEditor.css",
      side: "after",
      line: 105,
      startLine: 105
    })
  })

  test("carries the first line of a thread hung off a range", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)
    const thread = snapshot.threads.find((one) => one.id === "2478298752")

    // GitHub keys the marker by the last line and names the first in `start`,
    // so a remark about 137–140 is not reported as a remark about 140.
    expect(Option.getOrUndefined(thread?.at ?? Option.none())).toMatchObject({
      line: 140,
      startLine: 137
    })
  })

  test("keeps GitHub's own face for a speaker, which a login cannot be turned into", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)
    const [comment] = snapshot.threads[0]?.comments ?? []

    // An app's face lives under an installation id with no relation to its
    // name, so guessing at `github.com/Copilot.png` gets a letter in a circle.
    expect(Option.getOrUndefined(comment?.author.faceUrl ?? Option.none())).toBe(
      "https://avatars.githubusercontent.com/in/946600?v=4"
    )
  })

  test("reads the checks and what each one is doing", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.checks).toHaveLength(29)
    expect(new Set(snapshot.checks.map((check) => check.state))).toEqual(
      new Set(["succeeded", "running"])
    )
    const awaiting = snapshot.checks.find(
      (check) => check.name === "Community PR Approvals"
    )
    expect(awaiting?.summary).toBe("Awaiting approvals (0/3)")
    expect(awaiting?.isRequired).toBe(true)
  })

  test("explains why the pull request cannot be merged", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.merge.isMergeable).toBe(false)
    expect(snapshot.merge.blockers.map((blocker) => blocker.name)).toEqual([
      "Pull request state",
      "Pull request user state",
      "Repo rules"
    ])
    expect(snapshot.merge.blockers.every((blocker) => blocker.explanation.length > 0)).toBe(
      true
    )
  })

  test("says what the rules objected to, rather than that there are rules", async () => {
    // `description` is the rule in the abstract and reads the same on every
    // pull request that ever failed it. GitHub puts the verdict in `message`,
    // and the verdict is the only part worth the row it takes up.
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    const rules = snapshot.merge.blockers.find((blocker) => blocker.name === "Repo rules")
    expect(rules?.explanation).toBe(
      "New changes require approval from someone other than the last pusher. 2 of 25 required status checks are in progress."
    )
  })

  test("prefers what GitHub decided to what GitHub requires", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    const user = snapshot.merge.blockers.find(
      (blocker) => blocker.name === "Pull request user state"
    )
    expect(user?.explanation).toBe("User is not allowed to push to this repository")
  })

  test("keeps the description for a condition GitHub said nothing else about", async () => {
    const box = draftWithBotFindings.mergeBox as {
      mergeRequirements: { conditions: ReadonlyArray<Record<string, unknown>> }
    }
    const silent = {
      ...draftWithBotFindings,
      mergeBox: {
        ...box,
        mergeRequirements: {
          ...box.mergeRequirements,
          conditions: box.mergeRequirements.conditions.map((condition) =>
            condition.result === "FAILED" ? { ...condition, message: null } : condition
          )
        }
      }
    }

    const snapshot = await snapshotOf(draft, silent)

    const rules = snapshot.merge.blockers.find((blocker) => blocker.name === "Repo rules")
    expect(rules?.explanation).toBe("Pull request repository rules")
  })

  test("lets you merge when the repository re-reads its checks at merge time", async () => {
    // What a repository with required checks answers even once they have all
    // passed. Reading it as "not MERGEABLE" is how the button came to be
    // disabled with nothing said about why.
    const snapshot = await snapshotOf(draft, withMergeState("MERGEABLE_IF_STATUSES_PASS"))

    expect(snapshot.merge.isMergeable).toBe(true)
    expect(snapshot.merge.blockers).toEqual([])
  })

  test("names the state when it cannot merge and GitHub lists no reason", async () => {
    const snapshot = await snapshotOf(draft, withMergeState("SOMETHING_NEW"))

    expect(snapshot.merge.isMergeable).toBe(false)
    expect(snapshot.merge.blockers).toHaveLength(1)
    expect(snapshot.merge.blockers[0]?.explanation).toContain("SOMETHING_NEW")
  })

  test("has no reviews on it", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.reviews).toEqual([])
  })
})

/**
 * The same payloads, from a repository that merges through a queue.
 *
 * Built here rather than recorded: both recordings are from repositories
 * without one, so every queue field in them is null. The fields themselves are
 * real — they are in the payload we already fetch — and the shapes below are
 * the ones GitHub's own schema gives them.
 */
/**
 * The same payload, from a pull request the base branch has moved on from.
 *
 * Both recordings sit at a `mergeStateStatus` of their own, and neither is
 * `BEHIND`; the field and its companion list of update methods are real and
 * already fetched, and these are the shapes GitHub gives them.
 */
/** The same payload, carrying whichever failed conditions a test wants. */
const blocking = (conditions: ReadonlyArray<Record<string, unknown>>) => {
  const box = draftWithBotFindings.mergeBox as {
    mergeRequirements: Record<string, unknown>
  }
  return {
    ...draftWithBotFindings,
    mergeBox: {
      ...box,
      mergeRequirements: { ...box.mergeRequirements, state: "BLOCKED", conditions }
    }
  }
}

const behind = (
  methods: ReadonlyArray<{
    readonly name: string
    readonly allowableStatus: string
    readonly isDefault?: boolean
    readonly failureReason?: string
  }>
) => {
  const box = draftWithBotFindings.mergeBox as { pullRequest: Record<string, unknown> }
  return {
    ...draftWithBotFindings,
    mergeBox: {
      ...box,
      pullRequest: {
        ...box.pullRequest,
        mergeStateStatus: "BEHIND",
        viewerUpdateMethods: methods
      }
    }
  }
}

const throughAQueue = (
  queue: {
    readonly position?: number
    readonly waiting?: boolean
    readonly queueing?: "ALLOWED" | "BLOCKED"
  } = {}
) => {
  const box = draftWithBotFindings.mergeBox as { pullRequest: Record<string, unknown> }
  const waiting = queue.waiting ?? true
  return {
    ...draftWithBotFindings,
    mergeBox: {
      ...box,
      pullRequest: {
        ...box.pullRequest,
        isInMergeQueue: waiting,
        mergeQueue: { url: "https://github.com/microsoft/vscode/queue/main" },
        mergeQueueEntry: waiting
          ? { position: queue.position ?? 3, state: "QUEUED" }
          : null,
        viewerCanAddAndRemoveFromMergeQueue: true,
        // Copied from a live queue repository. GitHub answers with one entry per
        // way of merging, each carrying its own verdict and its own list of
        // methods, and the queue's entry is the one that decides here.
        viewerMergeActions: [
          {
            name: "MERGE_QUEUE",
            allowableStatus: queue.queueing ?? "ALLOWED",
            mergeMethods: [
              { name: "MERGE", isDefault: false, allowableStatus: "BLOCKED" },
              { name: "SQUASH", isDefault: true, allowableStatus: "ALLOWED" },
              { name: "REBASE", isDefault: false, allowableStatus: "BLOCKED" }
            ]
          },
          {
            name: "DIRECT_MERGE",
            allowableStatus: "BLOCKED",
            mergeMethods: [
              { name: "SQUASH", isDefault: true, allowableStatus: "BLOCKED" }
            ]
          }
        ]
      }
    }
  }
}

describe("a repository that merges through a queue", () => {
  test("says there is no queue when GitHub sends none", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(Option.isNone(snapshot.merge.queue)).toBe(true)
  })

  test("reads the queue, and where in it this pull request is waiting", async () => {
    const snapshot = await snapshotOf(draft, throughAQueue({ position: 3 }))

    const queue = snapshot.merge.queue
    if (Option.isNone(queue)) throw new Error("expected a merge queue")
    expect(queue.value.waiting).toBe(true)
    expect(queue.value.position).toEqual(Option.some(3))
    expect(queue.value.viewerCanQueue).toBe(true)
    expect(queue.value.url).toEqual(
      Option.some("https://github.com/microsoft/vscode/queue/main")
    )
  })

  test("reads a queue this pull request is not in yet", async () => {
    const snapshot = await snapshotOf(draft, throughAQueue({ waiting: false }))

    const queue = snapshot.merge.queue
    if (Option.isNone(queue)) throw new Error("expected a merge queue")
    expect(queue.value.waiting).toBe(false)
    expect(Option.isNone(queue.value.position)).toBe(true)
  })

  test("reads GitHub's own verdict on whether the queue may be joined", async () => {
    const snapshot = await snapshotOf(draft, throughAQueue({ waiting: false }))

    const queue = snapshot.merge.queue
    if (Option.isNone(queue)) throw new Error("expected a merge queue")
    expect(queue.value.mayJoin).toBe(true)
  })

  test("takes a blocked queue action as a no, whatever the permission says", async () => {
    // The Participant may add and remove pull requests in general, and this
    // particular one still cannot go in — an unresolved thread, a check that
    // has not finished. Offering the button anyway means offering a refusal.
    const snapshot = await snapshotOf(
      draft,
      throughAQueue({ waiting: false, queueing: "BLOCKED" })
    )

    const queue = snapshot.merge.queue
    if (Option.isNone(queue)) throw new Error("expected a merge queue")
    expect(queue.value.viewerCanQueue).toBe(true)
    expect(queue.value.mayJoin).toBe(false)
  })

  test("reads an auto-merge somebody has already armed", async () => {
    // What our own enqueue leaves behind: on a queue repository GitHub records
    // "merge when ready" as an auto-merge request, and the pull request does
    // not enter the line until its requirements pass. A card that reads only
    // the queue sees nothing and offers to arm it a second time.
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    const armed = snapshot.merge.autoMerge
    if (Option.isNone(armed)) throw new Error("expected an armed auto-merge")
    expect(armed.value.method).toEqual(Option.some("SQUASH"))
  })

  test("says nothing is armed when GitHub sent no auto-merge", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(Option.isNone(snapshot.merge.autoMerge)).toBe(true)
  })

  test("says which failed rules an admin could go past", async () => {
    const box = draftWithBotFindings.mergeBox as {
      pullRequest: Record<string, unknown>
      mergeRequirements: { conditions: ReadonlyArray<Record<string, unknown>> }
    }
    const bypassable = {
      ...draftWithBotFindings,
      mergeBox: {
        ...box,
        pullRequest: { ...box.pullRequest, viewerCanAdminBypassMergeRequirements: true },
        mergeRequirements: {
          ...box.mergeRequirements,
          conditions: box.mergeRequirements.conditions.map((condition) =>
            condition.displayName === "Repo rules"
              ? {
                ...condition,
                ruleRollups: [
                  { displayName: "Require a pull request", result: "FAILED", bypassable: true }
                ]
              }
              : condition
          )
        }
      }
    }

    const snapshot = await snapshotOf(draft, bypassable)

    expect(snapshot.merge.mayBypass).toBe(true)
    const rules = snapshot.merge.blockers.find((blocker) => blocker.name === "Repo rules")
    expect(rules?.bypassable).toBe(true)
    const state = snapshot.merge.blockers.find(
      (blocker) => blocker.name === "Pull request state"
    )
    expect(state?.bypassable).toBe(false)
  })

  test("keeps the channels GitHub publishes for this merge, so it can be told", async () => {
    // The alternative is asking every few seconds whether anything moved,
    // which notices later and looks to GitHub like something worth rate
    // limiting.
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.merge.channels.length).toBeGreaterThan(0)
    expect(snapshot.merge.channels.every((channel) => channel.includes("--"))).toBe(true)
  })

  test("knows a blocker about the checks from one about the conversation", async () => {
    const snapshot = await snapshotOf(
      draft,
      blocking([
        {
          type: "PULL_REQUEST_RULES",
          displayName: "Repo rules",
          description: "Pull request repository rules",
          message: "<div>2 of 25 required status checks are in progress.</div>",
          result: "FAILED",
          ruleRollups: [
            { ruleType: "REQUIRED_STATUS_CHECKS", result: "FAILED", bypassable: false }
          ]
        },
        {
          type: "PULL_REQUEST_REVIEW_THREADS",
          displayName: "Conversations",
          description: "Every conversation must be resolved",
          message: "<div>All conversations on this pull request must be resolved.</div>",
          result: "FAILED"
        },
        {
          type: "PULL_REQUEST_STATE",
          displayName: "Pull request state",
          description: "Pull request must be open and not in draft mode",
          message: "<div>Pull request must be open and not in draft mode.</div>",
          result: "FAILED"
        }
      ])
    )

    const about = (name: string) =>
      snapshot.merge.blockers.find((blocker) => blocker.name === name)?.about
    expect(about("Repo rules")).toEqual(Option.some("checks"))
    expect(about("Conversations")).toEqual(Option.some("conversation"))
    // Nothing on this page fixes a draft, so there is nowhere to send anyone.
    expect(about("Pull request state")).toEqual(Option.none())
  })

  test("says nothing about updating a branch that is not behind", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(Option.isNone(snapshot.merge.update)).toBe(true)
  })

  test("reads a branch the base has moved on from, and how GitHub would catch it up", async () => {
    const snapshot = await snapshotOf(draft, behind([
      { name: "MERGE", allowableStatus: "ALLOWED", isDefault: true },
      { name: "REBASE", allowableStatus: "UNAVAILABLE" }
    ]))

    const update = snapshot.merge.update
    if (Option.isNone(update)) throw new Error("expected an update to be offered")
    expect(update.value.how).toBe("MERGE")
    expect(update.value.mayUpdate).toBe(true)
  })

  test("keeps GitHub's reason for refusing the update, which is the useful half", async () => {
    // "You don't have write access to their fork" is the whole answer to why
    // the button is grey, and it is not something this extension could work
    // out for itself.
    const snapshot = await snapshotOf(draft, behind([
      {
        name: "MERGE",
        allowableStatus: "BLOCKED",
        failureReason: "You don’t have write access to octocat:spin."
      }
    ]))

    const update = snapshot.merge.update
    if (Option.isNone(update)) throw new Error("expected an update to be offered")
    expect(update.value.mayUpdate).toBe(false)
    expect(update.value.refusal).toEqual(
      Option.some("You don’t have write access to octocat:spin.")
    )
  })

  test("says the queue may not be joined when GitHub lists no actions at all", async () => {
    const box = draftWithBotFindings.mergeBox as { pullRequest: Record<string, unknown> }
    const withoutActions = {
      ...draftWithBotFindings,
      mergeBox: {
        ...box,
        pullRequest: {
          ...box.pullRequest,
          mergeQueue: { url: "https://github.com/microsoft/vscode/queue/main" },
          isInMergeQueue: false,
          mergeQueueEntry: null,
          viewerCanAddAndRemoveFromMergeQueue: true
        }
      }
    }

    const snapshot = await snapshotOf(draft, withoutActions)

    const queue = snapshot.merge.queue
    if (Option.isNone(queue)) throw new Error("expected a merge queue")
    expect(queue.value.mayJoin).toBe(false)
  })
})

describe("a merged pull request that was approved", () => {
  test("reads the approval and who gave it", async () => {
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    expect(snapshot.reviews).toEqual([
      {
        reviewer: {
          login: "vijayupadya",
          isAutomated: false,
          faceUrl: Option.some("https://avatars.githubusercontent.com/u/41652029?v=4")
        },
        decision: "approved"
      }
    ])
  })

  test("reads its state, files and commits", async () => {
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    expect(snapshot.state).toBe("merged")
    expect(snapshot.files).toHaveLength(28)
    expect(snapshot.commits).toHaveLength(5)
    expect(new Set(snapshot.files.map((file) => file.changeType))).toEqual(
      new Set(["modified", "added"])
    )
  })

  test("leaves the diff absent for the files GitHub sent no content for", async () => {
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    const withContent = snapshot.files.filter((file) => Option.isSome(file.diff))
    expect(withContent).toHaveLength(8)
    expect(snapshot.files).toHaveLength(28)
  })

  test("numbers a deleted line by where it was, not where it would have been", async () => {
    const snapshot = await snapshotOf(merged, mergedWithApproval)
    const file = snapshot.files.find(
      (candidate) =>
        candidate.path ===
        "src/vs/platform/agentHost/browser/remoteAgentHostProtocolClient.ts"
    )
    if (file === undefined || Option.isNone(file.diff)) {
      throw new Error("expected diff content for the protocol client")
    }

    const deleted = file.diff.value.lines.filter((line) => line.kind === "deleted")
    expect(deleted.length).toBeGreaterThan(0)
    expect(deleted[0]?.beforeLine).toEqual(Option.some(43))
    expect(deleted[0]?.afterLine).toEqual(Option.none())
  })

  test("reads all seventy checks as passing", async () => {
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    expect(snapshot.checks).toHaveLength(70)
    expect(snapshot.checks.every((check) => check.state === "succeeded")).toBe(true)
  })

  test("reads one GitHub has stopped saying anything about requirements for", async () => {
    // What their route answers today for a pull request that has landed:
    // `mergeRequirements: null`, because there is nothing left to require.
    // Refusing that payload failed the whole read, and a failed read leaves
    // whatever was last remembered on the screen — which is how a merged pull
    // request goes on calling itself open.
    const box = mergedWithApproval.mergeBox as { pullRequest: Record<string, unknown> }
    const landed = {
      ...mergedWithApproval,
      mergeBox: { pullRequest: box.pullRequest, mergeRequirements: null }
    }

    const snapshot = await snapshotOf(merged, landed)

    expect(snapshot.state).toBe("merged")
    expect(snapshot.merge.isMergeable).toBe(false)
    expect(snapshot.merge.blockers).toEqual([])
  })
})
