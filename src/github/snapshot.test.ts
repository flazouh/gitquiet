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
    expect(snapshot.author).toEqual({ login: "romalpani", isAutomated: false })
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
const throughAQueue = (
  queue: { readonly position?: number; readonly waiting?: boolean } = {}
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
        viewerCanAddAndRemoveFromMergeQueue: true
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
})

describe("a merged pull request that was approved", () => {
  test("reads the approval and who gave it", async () => {
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    expect(snapshot.reviews).toEqual([
      { reviewer: { login: "vijayupadya", isAutomated: false }, decision: "approved" }
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
})
