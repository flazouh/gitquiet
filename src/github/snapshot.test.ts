import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import {
  couldBeStacked,
  draftWithBotFindings,
  mergedWithApproval,
  queuedToMerge,
  stackedAtTheBottom,
  stackedInTheMiddle,
  stackedOnTop,
  stackedOverADraft,
  withInjectedContext,
  withNoDescription
} from "../../tests/fixtures"
import type { MergeState, PullRequestSnapshot } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { whatCanBeDone } from "../domain/doable"
import { toSnapshot } from "./snapshot"

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }
const merged: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327417 }

const snapshotOf = (reference: PullRequestRef, raw: Parameters<typeof toSnapshot>[1]) =>
  Effect.runPromise(toSnapshot(reference, raw))

/**
 * The merge state a test asserts on, unwrapped.
 *
 * An Option on the snapshot because GitHub does not always serve the merge box, and
 * never None here: every fixture in this file carries one. Unwrapped in one place
 * rather than at forty assertions.
 */
const merging = (snapshot: PullRequestSnapshot): MergeState => Option.getOrThrow(snapshot.merge)

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

type WireThreads = {
  readonly payload: {
    readonly pullRequestsChangesRoute: {
      readonly markers: {
        readonly threads: Record<
          string,
          {
            readonly commentsData: {
              comments: Array<{
                author: { login: string; isAgent?: boolean }
                automatedComment?: unknown
              }>
            }
          }
        >
      }
    }
  }
}

/**
 * The draft's payloads, with one finding by an app GitHub flags as nothing.
 *
 * Their own recording carries `automatedComment.aiAuthored`, which is how
 * Copilot's findings are known. Not every reviewing app gets that, and the ones
 * that do not still end their login in `[bot]`.
 */
const byAnUnflaggedApp = () => {
  const changes = structuredClone(draftWithBotFindings.changes) as WireThreads
  const threads = Object.values(changes.payload.pullRequestsChangesRoute.markers.threads)

  for (const comment of threads[0]?.commentsData.comments ?? []) {
    comment.author = { login: "devin-ai-integration[bot]", isAgent: false }
    delete comment.automatedComment
  }

  return { ...draftWithBotFindings, changes }
}

/** One recorded seat of a stack, as a server that does not send the stack's own base. */
const withoutTheStacksBase = (raw: typeof stackedOnTop) => {
  const box = raw.mergeBox as { readonly pullRequest: Record<string, unknown> }
  const { stackedBaseRefName, ...pullRequest } = box.pullRequest
  return { ...raw, mergeBox: { ...box, pullRequest } }
}

/** A channel about the pull request as a whole, rather than one topic of it. */
const EVERYTHING = ""

/**
 * Which topic of a pull request a channel token is a channel for.
 *
 * GitHub signs the subject into the token rather than naming it beside one, so
 * the topic in `pull_request:413097055:workflow_run` is read back out of the
 * base64 half rather than matched against a string the fixture happens to
 * carry. A subject with no topic on the end is the pull request itself.
 */
const topicOf = (channel: string): string => {
  const { c } = JSON.parse(atob(channel.split("--")[0] ?? "")) as { readonly c: string }
  const [, , ...topic] = c.split(":")
  return topic.join(":")
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

  test("reads when it was opened, and nothing for the ends it has not reached", async () => {
    // `closedTime` and `mergedTime` both arrive as null on anything still live,
    // which is not the same as a moment nobody asked for.
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.openedAt).toEqual(Option.some("2026-07-25T06:02:09+02:00"))
    expect(snapshot.closedAt).toEqual(Option.none())
    expect(snapshot.mergedAt).toEqual(Option.none())
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

  test("reads a line GitHub injected as the context line it is", async () => {
    // Their own marker for these is `~`, which nothing downstream of here knows:
    // the marker column is one character wide and every reader of it — the prose
    // diff, the patch the diff engine is handed — expects a space, a plus or a
    // minus there. So the kind is context and the marker is made a space, which
    // is what GitHub's own HTML for the line draws.
    const snapshot = await snapshotOf(draft, withInjectedContext)
    const lines = snapshot.files.flatMap((file) =>
      Option.match(file.diff, { onNone: () => [], onSome: (diff) => [...diff.lines] })
    )
    const injected = lines.find((line) =>
      line.text.endsWith("this._workbenchUIElementFactory,")
    )

    expect(injected?.kind).toBe("context")
    expect(injected?.text).toBe(" \t\t\tthis._workbenchUIElementFactory,")
    expect(injected?.beforeLine).toEqual(Option.some(38))
    expect(injected?.afterLine).toEqual(Option.some(39))
  })

  test("recognises every comment on these threads as automated", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.threads).toHaveLength(2)
    const comments = snapshot.threads.flatMap((thread) => thread.comments)
    expect(comments.every((comment) => comment.author.isAutomated)).toBe(true)
    expect(comments.every((comment) => comment.body.length > 0)).toBe(true)
  })

  test("recognises an app by its login where GitHub flags it as neither agent nor AI", async () => {
    // Found on a live pull request: Devin's review comments arrive with `isAgent`
    // false and no `automatedComment`, so the only thing on them that says a
    // machine wrote it is the `[bot]` their login ends in. The remarks already
    // read that suffix, and a participant who is an app in one half of a pull
    // request and a colleague in the other is one participant read two ways.
    const snapshot = await snapshotOf(draft, byAnUnflaggedApp())

    expect(
      snapshot.threads
        .flatMap((thread) => thread.comments)
        .map((comment) => [comment.author.login, comment.author.isAutomated])
    ).toContainEqual(["devin-ai-integration[bot]", true])
  })

  test("locates a thread at the file and line it hangs off", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)
    const thread = snapshot.threads.find((one) => one.id === "2478298761")

    expect(Option.getOrUndefined(thread?.at ?? Option.none())).toEqual({
      path: "src/vs/sessions/contrib/changes/browser/media/multiFileDiffEditor.css",
      lines: { side: "after", line: 105, startLine: 105 }
    })
  })

  test("carries the first line of a thread hung off a range", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)
    const thread = snapshot.threads.find((one) => one.id === "2478298752")

    // GitHub keys the marker by the last line and names the first in `start`,
    // so a remark about 137–140 is not reported as a remark about 140.
    expect(Option.getOrUndefined(thread?.at ?? Option.none())).toMatchObject({
      lines: { line: 140, startLine: 137 }
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

    expect(merging(snapshot).isMergeable).toBe(false)
    expect(merging(snapshot).blockers.map((blocker) => blocker.name)).toEqual([
      "Pull request state",
      "Pull request user state",
      "Repo rules"
    ])
    expect(merging(snapshot).blockers.every((blocker) => blocker.explanation.length > 0)).toBe(
      true
    )
  })

  test("says what the rules objected to, rather than that there are rules", async () => {
    // `description` is the rule in the abstract and reads the same on every
    // pull request that ever failed it. GitHub puts the verdict in `message`,
    // and the verdict is the only part worth the row it takes up.
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    const rules = merging(snapshot).blockers.find((blocker) => blocker.name === "Repo rules")
    expect(rules?.explanation).toBe(
      "New changes require approval from someone other than the last pusher. 2 of 25 required status checks are in progress."
    )
  })

  test("prefers what GitHub decided to what GitHub requires", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    const user = merging(snapshot).blockers.find(
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

    const rules = merging(snapshot).blockers.find((blocker) => blocker.name === "Repo rules")
    expect(rules?.explanation).toBe("Pull request repository rules")
  })

  test("lets you merge when the repository re-reads its checks at merge time", async () => {
    // What a repository with required checks answers even once they have all
    // passed. Reading it as "not MERGEABLE" is how the button came to be
    // disabled with nothing said about why.
    const snapshot = await snapshotOf(draft, withMergeState("MERGEABLE_IF_STATUSES_PASS"))

    expect(merging(snapshot).isMergeable).toBe(true)
    expect(merging(snapshot).blockers).toEqual([])
  })

  test("names the state when it cannot merge and GitHub lists no reason", async () => {
    const snapshot = await snapshotOf(draft, withMergeState("SOMETHING_NEW"))

    expect(merging(snapshot).isMergeable).toBe(false)
    expect(merging(snapshot).blockers).toHaveLength(1)
    expect(merging(snapshot).blockers[0]?.explanation).toContain("SOMETHING_NEW")
  })

  test("has no reviews on it", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(Option.getOrThrow(snapshot.reviews)).toEqual([])
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

/**
 * The draft's payloads, with GitHub allowing a different set of ways in.
 *
 * Only the direct merge's entry is rewritten. The queue's entry carries a list
 * of its own and is left alone, so a test about which method a press would use
 * cannot pass by reading the wrong one of the two.
 */
const landingWith = (
  methods: ReadonlyArray<{
    readonly name: string
    readonly isDefault: boolean
    readonly allowableStatus: string
  }>
) => {
  const box = draftWithBotFindings.mergeBox as {
    readonly pullRequest: Record<string, unknown> & {
      readonly viewerMergeActions: ReadonlyArray<{ readonly name: string }>
    }
  }

  return {
    ...draftWithBotFindings,
    mergeBox: {
      ...box,
      pullRequest: {
        ...box.pullRequest,
        viewerMergeActions: box.pullRequest.viewerMergeActions.map((action) =>
          action.name === "DIRECT_MERGE" ? { ...action, mergeMethods: methods } : action
        )
      }
    }
  }
}

/**
 * Which way a press would land this, which is the repository's answer and not ours.
 *
 * The card said "Squash and merge" on every pull request in the world and posted
 * `SQUASH` to match, so a repository that allows only a merge commit got a button
 * that could not work. The read had the same word hardcoded into the address it
 * asked at — `?merge_method=MERGE` — which is the other half of the same bug:
 * GitHub weighs every rule against the method it is handed, so on a squash-only
 * repository it answered with two failed conditions about a merge commit nobody
 * had asked for. Reported by Ahmed on `OpenRouterInternal/ori`, where the card
 * listed the merge method as refused twice over.
 */
describe("the way a press would land a pull request", () => {
  test("is the repository's own default, where GitHub allows that one", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(merging(snapshot).method).toEqual(Option.some("MERGE"))
  })

  test("is one GitHub does allow, where the default is refused", async () => {
    const snapshot = await snapshotOf(
      draft,
      landingWith([
        { name: "MERGE", isDefault: true, allowableStatus: "BLOCKED" },
        { name: "SQUASH", isDefault: false, allowableStatus: "ALLOWED" },
        { name: "REBASE", isDefault: false, allowableStatus: "ALLOWED" }
      ])
    )

    expect(merging(snapshot).method).toEqual(Option.some("SQUASH"))
  })

  test("is nothing at all where GitHub allows none of the three", async () => {
    const snapshot = await snapshotOf(
      draft,
      landingWith([
        { name: "MERGE", isDefault: true, allowableStatus: "BLOCKED" },
        { name: "SQUASH", isDefault: false, allowableStatus: "BLOCKED" }
      ])
    )

    expect(Option.isNone(merging(snapshot).method)).toBe(true)
  })

  test("is nothing at all where GitHub names a method this cannot send", async () => {
    // Their enum is theirs to grow. A fourth way of merging arrives here as a
    // method nobody can post rather than as a string handed to a write route.
    const snapshot = await snapshotOf(
      draft,
      landingWith([{ name: "FAST_FORWARD", isDefault: true, allowableStatus: "ALLOWED" }])
    )

    expect(Option.isNone(merging(snapshot).method)).toBe(true)
  })

  test("is one this can send, where the one GitHub prefers is not", async () => {
    // The default is read for which of ours to prefer, not for whether to have
    // one: a word nobody can post is no reason to grey a button over a squash
    // GitHub has just said it allows.
    const snapshot = await snapshotOf(
      draft,
      landingWith([
        { name: "FAST_FORWARD", isDefault: true, allowableStatus: "ALLOWED" },
        { name: "SQUASH", isDefault: false, allowableStatus: "ALLOWED" }
      ])
    )

    expect(merging(snapshot).method).toEqual(Option.some("SQUASH"))
  })

  test("is nothing at all where the payload carries no ways in", async () => {
    // The whole field going missing is the shape a schema change would take,
    // and it must grey the button rather than send a guess. `mergeMethods` is
    // optional in the wire schema, so nothing else would notice.
    const snapshot = await snapshotOf(draft, landingWith([]))

    expect(Option.isNone(merging(snapshot).method)).toBe(true)
  })
})

/**
 * The ways a repository allows, all of them, so the reader can pick.
 *
 * Only the default reached the card before this, so a repository that allows all
 * three offered one and a reviewer who rebases everything was given a squash and
 * nothing to press instead. That is what Luke uninstalled over, in as many
 * words: "it doesn't have the rebase buttons".
 */
describe("the ways a press could land a pull request", () => {
  test("carries every one GitHub allows, in GitHub's own order", async () => {
    const snapshot = await snapshotOf(
      draft,
      landingWith([
        { name: "MERGE", isDefault: true, allowableStatus: "ALLOWED" },
        { name: "SQUASH", isDefault: false, allowableStatus: "ALLOWED" },
        { name: "REBASE", isDefault: false, allowableStatus: "ALLOWED" }
      ])
    )

    expect(merging(snapshot).methods).toEqual(["MERGE", "SQUASH", "REBASE"])
  })

  test("leaves out the ones GitHub refuses", async () => {
    const snapshot = await snapshotOf(
      draft,
      landingWith([
        { name: "MERGE", isDefault: true, allowableStatus: "BLOCKED" },
        { name: "SQUASH", isDefault: false, allowableStatus: "ALLOWED" },
        { name: "REBASE", isDefault: false, allowableStatus: "ALLOWED" }
      ])
    )

    expect(merging(snapshot).methods).toEqual(["SQUASH", "REBASE"])
  })

  test("is the one way in, on a repository that allows one", async () => {
    // Which is most of them, and it is what stops a caret being drawn over a
    // menu of one.
    const snapshot = await snapshotOf(
      draft,
      landingWith([
        { name: "SQUASH", isDefault: true, allowableStatus: "ALLOWED" },
        { name: "REBASE", isDefault: false, allowableStatus: "BLOCKED" }
      ])
    )

    expect(merging(snapshot).methods).toEqual(["SQUASH"])
  })

  test("is empty exactly where there is no way in at all", async () => {
    const snapshot = await snapshotOf(
      draft,
      landingWith([{ name: "MERGE", isDefault: true, allowableStatus: "BLOCKED" }])
    )

    expect(Option.isNone(merging(snapshot).method)).toBe(true)
    expect(merging(snapshot).methods).toEqual([])
  })

  test("leaves out a word this could not post", async () => {
    const snapshot = await snapshotOf(
      draft,
      landingWith([
        { name: "FAST_FORWARD", isDefault: false, allowableStatus: "ALLOWED" },
        { name: "SQUASH", isDefault: true, allowableStatus: "ALLOWED" }
      ])
    )

    expect(merging(snapshot).methods).toEqual(["SQUASH"])
  })
})

describe("a pull request nobody wrote a description for", () => {
  test("reads it, with nothing where the description would be", async () => {
    // GitHub sends `"body": null` rather than an empty string, and refusing that
    // failed the whole read: every pull request in `microsoft/vscode` reached the
    // failure screen, in a repository where most changes are a line and nobody
    // writes a paragraph about them. A description nobody wrote is the emptiest
    // thing there is, not a reason to withhold the pull request around it.
    const snapshot = await snapshotOf(draft, withNoDescription)

    expect(snapshot.description.markdown).toBe("")
    expect(snapshot.description.html).toBe("")
  })
})

describe("a repository that merges through a queue", () => {
  test("says there is no queue when GitHub sends none", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(Option.isNone(merging(snapshot).queue)).toBe(true)
  })

  test("reads one GitHub calls QUEUED as open, standing in the line", async () => {
    // The state their changes route sends for a pull request in the queue, which
    // is a value their GraphQL enum does not have — the merge box for the same
    // pull request said `OPEN` in the same second. Refusing it failed the whole
    // read, so a queued pull request reached the failure screen with nothing on
    // it wrong. Being in the line is what the merge state is for; the state
    // itself is still open, and everything a queued pull request can be asked
    // to do follows from that.
    const snapshot = await snapshotOf(draft, queuedToMerge)

    expect(snapshot.state).toBe("open")
  })

  test("drops GitHub's objection that it must be open, once it is standing in the line", async () => {
    // Their `PULL_REQUEST_STATE` condition fails on a queued pull request,
    // because the state it reads is QUEUED rather than OPEN. Their own page
    // hides the requirements behind the queue box, so nobody sees it there;
    // here it was drawn as a blocker under "waiting in the merge queue", which
    // is the queue refusing a pull request it has already taken.
    const snapshot = await snapshotOf(draft, throughAQueue({ waiting: true }))

    expect(merging(snapshot).blockers.map((blocker) => blocker.name)).not.toContain(
      "Pull request state"
    )
  })

  test("keeps that objection on one the queue has not taken", async () => {
    // The fixture is a draft, which is the other thing the condition is about.
    const snapshot = await snapshotOf(draft, throughAQueue({ waiting: false }))

    expect(merging(snapshot).blockers.map((blocker) => blocker.name)).toContain(
      "Pull request state"
    )
  })

  test("reads the queue, and where in it this pull request is waiting", async () => {
    const snapshot = await snapshotOf(draft, throughAQueue({ position: 3 }))

    const queue = merging(snapshot).queue
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

    const queue = merging(snapshot).queue
    if (Option.isNone(queue)) throw new Error("expected a merge queue")
    expect(queue.value.waiting).toBe(false)
    expect(Option.isNone(queue.value.position)).toBe(true)
  })

  test("reads GitHub's own verdict on whether the queue may be joined", async () => {
    const snapshot = await snapshotOf(draft, throughAQueue({ waiting: false }))

    const queue = merging(snapshot).queue
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

    const queue = merging(snapshot).queue
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

    const armed = merging(snapshot).autoMerge
    if (Option.isNone(armed)) throw new Error("expected an armed auto-merge")
    expect(armed.value.method).toEqual(Option.some("SQUASH"))
  })

  test("says nothing is armed when GitHub sent no auto-merge", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(Option.isNone(merging(snapshot).autoMerge)).toBe(true)
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

    expect(merging(snapshot).mayBypass).toBe(true)
    const rules = merging(snapshot).blockers.find((blocker) => blocker.name === "Repo rules")
    expect(rules?.bypassable).toBe(true)
    const state = merging(snapshot).blockers.find(
      (blocker) => blocker.name === "Pull request state"
    )
    expect(state?.bypassable).toBe(false)
  })

  test("reads GitHub's two answers about the branch it was made from", async () => {
    const box = draftWithBotFindings.mergeBox as { pullRequest: Record<string, unknown> }
    const landed = {
      ...draftWithBotFindings,
      mergeBox: {
        ...box,
        pullRequest: {
          ...box.pullRequest,
          viewerCanDeleteHeadRef: true,
          viewerCanRestoreHeadRef: false
        }
      }
    }

    const snapshot = await snapshotOf(draft, landed)

    expect(snapshot.headRef).toEqual({ mayDelete: true, mayRestore: false })
  })

  test("offers nothing about the branch where the payload says nothing", async () => {
    // Which is every payload remembered before these two were read, as well as
    // a fork nobody here may write to. Absent has to read as no: the other way
    // round is a branch deleted on a guess.
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.headRef).toEqual({ mayDelete: false, mayRestore: false })
  })

  test("keeps the channels GitHub publishes for this merge, so it can be told", async () => {
    // The alternative is asking every few seconds whether anything moved,
    // which notices later and looks to GitHub like something worth rate
    // limiting.
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(merging(snapshot).channels.length).toBeGreaterThan(0)
    expect(merging(snapshot).channels.every((channel) => channel.includes("--"))).toBe(true)
  })

  test("watches every topic that changes what this page says", async () => {
    // A draft becoming open, a workflow finishing and a remark being left are
    // the three things that happen to a pull request while it is being read,
    // and none of them fires on the merge, queue or review channels. Missing
    // them is how a page sits there for half an hour calling a pull request a
    // draft that nobody can merge for an entirely different reason.
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    const topics = merging(snapshot).channels.map(topicOf)

    expect(topics).toContain("state")
    expect(topics).toContain("workflow_run")
    expect(topics).toContain(EVERYTHING)
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
      merging(snapshot).blockers.find((blocker) => blocker.name === name)?.about
    expect(about("Repo rules")).toEqual(Option.some("checks"))
    expect(about("Conversations")).toEqual(Option.some("conversation"))
    // Nothing on this page fixes a draft, so there is nowhere to send anyone.
    expect(about("Pull request state")).toEqual(Option.none())
  })

  /*
   * The payload of `flazouh/stack-probe#76`, made for this: a branch off the
   * first commit adding two files `main` already has. See
   * `docs/spec/conflicted-files.md`.
   */
  test("reads which files conflict, off the condition that already carries them", async () => {
    const snapshot = await snapshotOf(
      draft,
      blocking([
        {
          type: "PULL_REQUEST_MERGE_CONFLICT_STATE",
          displayName: "Pull request merge conflict state",
          description: "The pull request must not have any unresolved merge conflicts",
          message: "<div>Pull request cannot be merged because it has a merge conflict.</div>",
          result: "FAILED",
          conflicts: ["format.js", "parse.js"],
          isConflictResolvableInWeb: true
        }
      ])
    )

    const conflict = merging(snapshot).blockers.find(
      (blocker) => blocker.name === "Pull request merge conflict state"
    )
    expect(conflict?.files).toEqual(["format.js", "parse.js"])
    expect(conflict?.mayResolve).toBe(true)
  })

  test("leaves a blocker that names no file with none", async () => {
    const snapshot = await snapshotOf(
      draft,
      blocking([
        {
          type: "PULL_REQUEST_REVIEW_THREADS",
          displayName: "Conversations",
          description: "Every conversation must be resolved",
          message: "<div>All conversations on this pull request must be resolved.</div>",
          result: "FAILED"
        }
      ])
    )

    const threads = merging(snapshot).blockers.find((blocker) => blocker.name === "Conversations")
    expect(threads?.files).toEqual([])
    expect(threads?.mayResolve).toBe(false)
  })

  /*
   * GitHub sends the keys on every pull request and nulls the values where there
   * is nothing to say — measured on `#73` and `#74`, both clean. A null is also
   * every payload remembered before this was read at all.
   */
  test("takes a null list of files as none, rather than failing the read", async () => {
    const snapshot = await snapshotOf(
      draft,
      blocking([
        {
          type: "PULL_REQUEST_MERGE_CONFLICT_STATE",
          displayName: "Pull request merge conflict state",
          description: "The pull request must not have any unresolved merge conflicts",
          message: "<div>Pull request cannot be merged because it has a merge conflict.</div>",
          result: "FAILED",
          conflicts: null,
          isConflictResolvableInWeb: null
        }
      ])
    )

    const conflict = merging(snapshot).blockers.find(
      (blocker) => blocker.name === "Pull request merge conflict state"
    )
    expect(conflict?.files).toEqual([])
    expect(conflict?.mayResolve).toBe(false)
  })

  test("says nothing about updating a branch that is not behind", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(Option.isNone(merging(snapshot).update)).toBe(true)
  })

  test("reads a branch the base has moved on from, and how GitHub would catch it up", async () => {
    const snapshot = await snapshotOf(draft, behind([
      { name: "MERGE", allowableStatus: "ALLOWED", isDefault: true },
      { name: "REBASE", allowableStatus: "UNAVAILABLE" }
    ]))

    const update = merging(snapshot).update
    if (Option.isNone(update)) throw new Error("expected an update to be offered")
    expect(update.value.how).toBe("MERGE")
    expect(update.value.mayUpdate).toBe(true)
  })

  test("carries both ways of catching up where GitHub allows both", async () => {
    // GitHub's own Update branch keeps the two behind a caret, and it was read
    // here as a verdict rather than a choice: a reader who rebases everything
    // got a merge commit and nothing to press instead.
    const snapshot = await snapshotOf(draft, behind([
      { name: "MERGE", allowableStatus: "ALLOWED", isDefault: true },
      { name: "REBASE", allowableStatus: "ALLOWED" }
    ]))

    const update = merging(snapshot).update
    if (Option.isNone(update)) throw new Error("expected an update to be offered")
    expect(update.value.how).toBe("MERGE")
    expect(update.value.ways).toEqual(["MERGE", "REBASE"])
  })

  test("carries one way where GitHub allows one", async () => {
    const snapshot = await snapshotOf(draft, behind([
      { name: "MERGE", allowableStatus: "ALLOWED", isDefault: true },
      { name: "REBASE", allowableStatus: "UNAVAILABLE" }
    ]))

    const update = merging(snapshot).update
    if (Option.isNone(update)) throw new Error("expected an update to be offered")
    expect(update.value.ways).toEqual(["MERGE"])
  })

  test("keeps the way on the button among the ways, even when GitHub refuses it", async () => {
    // The button is drawn on a branch that is behind whether the press would go
    // through or not, and a menu that did not contain the word above it would be
    // a menu with no way back to where it started.
    const snapshot = await snapshotOf(draft, behind([
      {
        name: "REBASE",
        allowableStatus: "BLOCKED",
        isDefault: true,
        failureReason: "This branch cannot be rebased."
      }
    ]))

    const update = merging(snapshot).update
    if (Option.isNone(update)) throw new Error("expected an update to be offered")
    expect(update.value.how).toBe("REBASE")
    expect(update.value.ways).toEqual(["REBASE"])
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

    const update = merging(snapshot).update
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

    const queue = merging(snapshot).queue
    if (Option.isNone(queue)) throw new Error("expected a merge queue")
    expect(queue.value.mayJoin).toBe(false)
  })
})

describe("a pull request that is one layer of a stack", () => {
  // Read as the pull request the merge boxes were recorded from, rather than as
  // the draft whose other five routes stand in for its. A layer carries only a
  // number, and where it lives is the repository being read — so reading a
  // stack-probe merge box as a vscode pull request would place all three layers
  // in vscode, which is right, and would test nothing about the recording.
  const stacked: PullRequestRef = { owner: "flazouh", repo: "stack-probe", number: 9 }

  const stackOf = async (raw: Parameters<typeof toSnapshot>[1]) => {
    const snapshot = await snapshotOf(stacked, raw)
    const stack = merging(snapshot).stack
    if (Option.isNone(stack)) throw new Error("expected a stack")
    return stack.value
  }

  const floorOf = async (raw: Parameters<typeof toSnapshot>[1]) => (await stackOf(raw)).floor

  test("says there is no stack on a pull request standing on its own", async () => {
    expect(Option.isNone(merging(await snapshotOf(draft, draftWithBotFindings)).stack)).toBe(
      true
    )
  })

  test("reads the stack's own number, which is not any pull request's", async () => {
    expect((await stackOf(stackedInTheMiddle)).number).toBe(11)
  })

  test("orders the layers foundation first, whichever seat it is read from", async () => {
    // GitHub sends them top first. Read that way the list is a stack drawn
    // upside down: the pull request nothing depends on comes last, and the
    // reader counts upward from the wrong end to find what a press would land.
    for (const raw of [stackedAtTheBottom, stackedInTheMiddle, stackedOnTop]) {
      const numbered = (await stackOf(raw)).layers.map((layer) => layer.reference.number)
      expect(numbered).toEqual([8, 9, 10])
    }
  })

  test("seats each layer against the pull request being read", async () => {
    const seatsOf = async (raw: Parameters<typeof toSnapshot>[1]) =>
      (await stackOf(raw)).layers.map((layer) => layer.seat)

    expect(await seatsOf(stackedAtTheBottom)).toEqual(["here", "above", "above"])
    expect(await seatsOf(stackedInTheMiddle)).toEqual(["below", "here", "above"])
    expect(await seatsOf(stackedOnTop)).toEqual(["below", "below", "here"])
  })

  test("carries what a row needs to be read and followed", async () => {
    const [foundation] = (await stackOf(stackedInTheMiddle)).layers

    expect(foundation).toEqual({
      // The reference rather than an address, because every layer is a place
      // this interface can go to itself: a row that carried a string would be
      // a link out of a screen the reader is already standing in.
      reference: { owner: "flazouh", repo: "stack-probe", number: 8 },
      title: "add module a",
      headBranch: "feat-a",
      state: "open",
      seat: "below"
    })
  })

  test("reads a layer GitHub is still calling a draft", async () => {
    const layers = (await stackOf(stackedOverADraft)).layers

    expect(layers.map((layer) => layer.state)).toEqual(["open", "draft", "open"])
  })

  test("names the branch the stack lands on, from every seat in it", async () => {
    // One branch for the whole stack, so every seat gives the same answer. Read
    // from the middle and the top, the reader's own base is `feat-a` and
    // `feat-b` — the layer underneath them — and the floor is `main` either way.
    expect(await floorOf(stackedAtTheBottom)).toEqual(Option.some("main"))
    expect(await floorOf(stackedInTheMiddle)).toEqual(Option.some("main"))
    expect(await floorOf(stackedOnTop)).toEqual(Option.some("main"))
  })

  test("falls back to the reader's own base on the foundation, where the stack's is absent", async () => {
    // A payload without `stackedBaseRefName` is a server that does not have the
    // field, not a stack standing on nothing. From the foundation the reader's
    // own base is the floor and needs no guessing, so that seat keeps its
    // answer rather than losing the row with the others.
    expect(await floorOf(withoutTheStacksBase(stackedAtTheBottom))).toEqual(Option.some("main"))
    expect(await floorOf(withoutTheStacksBase(stackedOnTop))).toEqual(Option.none())
  })
})

describe("a pull request GitHub would stack and has not", () => {
  const top: PullRequestRef = { owner: "flazouh", repo: "stack-probe", number: 16 }
  const foundation: PullRequestRef = { owner: "flazouh", repo: "stack-probe", number: 15 }

  const proposalOf = async (reference: PullRequestRef) => {
    const proposal = (await snapshotOf(reference, couldBeStacked)).proposal
    if (Option.isNone(proposal)) throw new Error("expected a proposal")
    return proposal.value
  }

  test("proposes nothing where GitHub sent no preview", async () => {
    // The route answers 200 with a body of `null` on a pull request already in a
    // stack and on one with no chain at all, and a payload remembered before any
    // of this carries no `preview` at all. None of the three is a failure.
    expect(Option.isNone((await snapshotOf(draft, draftWithBotFindings)).proposal)).toBe(true)
    expect(
      Option.isNone((await snapshotOf(draft, { ...couldBeStacked, preview: null })).proposal)
    ).toBe(true)
  })

  test("orders the layers foundation first, as a stack that exists is ordered", async () => {
    // GitHub sends the preview newest first, which is the order their own dialog
    // draws and the reverse of the order the chain would land in.
    expect((await proposalOf(top)).layers.map((layer) => layer.reference.number)).toEqual([15, 16])
  })

  test("seats each layer against the pull request being read", async () => {
    expect((await proposalOf(foundation)).layers.map((layer) => layer.seat)).toEqual([
      "here",
      "above"
    ])
    expect((await proposalOf(top)).layers.map((layer) => layer.seat)).toEqual(["below", "here"])
  })

  test("carries what a row needs to be read and followed", async () => {
    const [under] = (await proposalOf(top)).layers

    expect(under).toEqual({
      reference: { owner: "flazouh", repo: "stack-probe", number: 15 },
      title: "probe w one",
      headBranch: "probe-w1",
      state: "open",
      seat: "below"
    })
  })

  test("names the branch the chain would land on, from every seat in it", async () => {
    // The foundation's own base, which this payload carries per entry and the
    // stack condition never does. One branch for the whole chain, so both seats
    // answer `main` while the reader's own base on the top is `probe-w1`.
    expect((await proposalOf(top)).floor).toEqual(Option.some("main"))
    expect((await proposalOf(foundation)).floor).toEqual(Option.some("main"))
  })

  test("proposes nothing where the preview arrives in a shape nothing has seen", async () => {
    // A stack GitHub holds is the read failing; a stack GitHub might make is
    // not. There is a pull request to put on the screen either way.
    const snapshot = await snapshotOf(top, { ...couldBeStacked, preview: [{ number: "16" }] })

    expect(Option.isNone(snapshot.proposal)).toBe(true)
  })
})

describe("a merged pull request that was approved", () => {
  test("reads the approval and who gave it", async () => {
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    expect(Option.getOrThrow(snapshot.reviews)).toEqual([
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

  test("reads when it was opened, when it closed and when it landed", async () => {
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    expect(snapshot.openedAt).toEqual(Option.some("2026-07-25T01:20:01+02:00"))
    expect(snapshot.closedAt).toEqual(Option.some("2026-07-25T21:20:20+02:00"))
    expect(snapshot.mergedAt).toEqual(Option.some("2026-07-25T21:20:20+02:00"))
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

  test("offers nothing to be done to it, GitHub having already landed it", async () => {
    // From GitHub's own recorded payload rather than a fixture written to make
    // the point: their merge box still describes a mergeable pull request with a
    // queue on this repository, which is exactly how the card came to offer a
    // merged change a place in the line.
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    expect([...whatCanBeDone({ state: snapshot.state, merge: merging(snapshot) })]).toEqual([])
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
    expect(merging(snapshot).isMergeable).toBe(false)
    expect(merging(snapshot).blockers).toEqual([])
  })
})

/**
 * Everything said about the pull request rather than about a line of it.
 *
 * The `changes` route carries only review threads, which is why a pull request
 * whose whole discussion is timeline remarks read as silent: `flowline#1934`
 * had one remark and no threads, and the column said "nothing said yet". The
 * remarks come from a route of their own.
 */
describe("remarks about the pull request rather than about a line", () => {
  test("reads what was said in the timeline, which no other payload carries", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.remarks).toHaveLength(1)
    expect(snapshot.remarks[0]?.author.login).toBe("railway-app[bot]")
    expect(snapshot.remarks[0]?.body).toContain("railway-project-id")
    // GitHub's own rendering, so a remark reads here as it does on their page.
    expect(snapshot.remarks[0]?.html).toContain("<p")
    expect(snapshot.remarks[0]?.createdAt).toBe("2026-07-16T23:44:34+02:00")
  })

  test("knows an app from a person, which this route never says outright", async () => {
    // No `isAgent` here as there is on the thread authors — only a login, and
    // GitHub's own suffix for an app. Reading it is the only thing to go on.
    const snapshot = await snapshotOf(merged, mergedWithApproval)

    expect(
      snapshot.remarks.map((remark) => [remark.author.login, remark.author.isAutomated])
    ).toEqual([
      ["github-actions[bot]", true],
      ["meganrogge", false],
      ["meganrogge", false]
    ])
  })

  test("keeps a face for each, so the column shows who spoke", async () => {
    const snapshot = await snapshotOf(draft, draftWithBotFindings)

    expect(snapshot.remarks[0]?.author.faceUrl).toEqual(
      Option.some("https://avatars.githubusercontent.com/in/73253?v=4")
    )
  })

  test("leaves out one GitHub has minimised, which their own page folds away", async () => {
    const hidden = {
      ...draftWithBotFindings,
      issueComments: (draftWithBotFindings.issueComments as ReadonlyArray<unknown>).map(
        (comment) => ({ ...(comment as object), isHidden: true, minimizedReason: "outdated" })
      )
    }

    const snapshot = await snapshotOf(draft, hidden)

    expect(snapshot.remarks).toEqual([])
  })
})
