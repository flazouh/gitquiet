import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { draftWithBotFindings, mergedWithApproval } from "../../tests/fixtures"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { toSnapshot } from "./snapshot"

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }
const merged: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327417 }

const snapshotOf = (reference: PullRequestRef, raw: Parameters<typeof toSnapshot>[1]) =>
  Effect.runPromise(toSnapshot(reference, raw))

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

  test("has no reviews on it", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.reviews).toEqual([])
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
