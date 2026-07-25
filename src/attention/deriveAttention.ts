import type {
  Attention,
  AttentionItem,
  AttentionKind,
  Court,
  CourtOverride,
  CourtRow,
  ViewerRole
} from "../domain/Attention"
import { COURTS } from "../domain/Attention"
import type { PullRequestSnapshot } from "../domain/PullRequest"

/**
 * Conversation first, then the reading, then the machinery. Files come after
 * threads because a question someone asked outranks the bulk work.
 */
const KIND_ORDER: ReadonlyArray<AttentionKind> = [
  "thread",
  "finding",
  "file",
  "check",
  "review",
  "merge-blocker"
]

const summarise = (body: string): string => {
  const [firstLine = ""] = body.split("\n")
  const trimmed = firstLine.trim()
  return trimmed.length > 90 ? `${trimmed.slice(0, 89)}…` : trimmed
}

const roleOf = (snapshot: PullRequestSnapshot): ViewerRole =>
  snapshot.viewer.login === snapshot.author.login ? "author" : "reviewer"

/** Whose problem an item is when only one side can act on it. */
const ownedByAuthor = (role: ViewerRole): Court =>
  role === "author" ? "your-move" : "waiting-on-others"

const threadItems = (
  snapshot: PullRequestSnapshot,
  viewer: string
): ReadonlyArray<AttentionItem> =>
  snapshot.threads.map((thread) => {
    const first = thread.comments[0]
    const last = thread.comments[thread.comments.length - 1]
    const isFinding =
      thread.comments.length > 0 && thread.comments.every((comment) => comment.author.isAutomated)

    const court: Court = thread.isResolved
      ? "settled"
      : last?.author.login === viewer
        ? // The Participant spoke last, so the reply is owed to them.
          "waiting-on-others"
        : "your-move"

    const authors = new Set(thread.comments.map((comment) => comment.author.login))

    return {
      id: `thread:${thread.id}`,
      kind: isFinding ? "finding" : "thread",
      court,
      title: summarise(first?.body ?? ""),
      detail:
        thread.comments.length === 1
          ? `${last?.author.login ?? "someone"}`
          : `${thread.comments.length} comments from ${[...authors].join(", ")}`
    }
  })

const fileItems = (snapshot: PullRequestSnapshot): ReadonlyArray<AttentionItem> =>
  snapshot.files.map((file) => ({
    id: `file:${file.path}`,
    kind: "file",
    court: file.readByViewer ? "settled" : "your-move",
    title: file.path,
    detail: `+${file.linesAdded} \u2212${file.linesDeleted}`
  }))

const checkItems = (
  snapshot: PullRequestSnapshot,
  role: ViewerRole
): ReadonlyArray<AttentionItem> =>
  snapshot.checks.map((check) => {
    const court: Court =
      check.state === "failed"
        ? ownedByAuthor(role)
        : check.state === "running" || check.state === "queued"
          ? "waiting-on-others"
          : "settled"

    return {
      id: `check:${check.name}`,
      kind: "check",
      court,
      title: check.name,
      detail: check.summary
    }
  })

const reviewItems = (
  snapshot: PullRequestSnapshot,
  role: ViewerRole
): ReadonlyArray<AttentionItem> =>
  snapshot.reviews.map((review) => ({
    id: `review:${review.reviewer.login}`,
    kind: "review",
    court: review.decision === "changes-requested" ? ownedByAuthor(role) : "settled",
    title: review.reviewer.login,
    detail: review.decision
  }))

const mergeItems = (
  snapshot: PullRequestSnapshot,
  role: ViewerRole
): ReadonlyArray<AttentionItem> =>
  snapshot.merge.blockers.map((blocker) => ({
    id: `merge-blocker:${blocker.name}`,
    kind: "merge-blocker",
    court: ownedByAuthor(role),
    title: blocker.name,
    detail: blocker.explanation
  }))

const rowsOf = (items: ReadonlyArray<AttentionItem>): ReadonlyArray<CourtRow> =>
  COURTS.flatMap((court) =>
    KIND_ORDER.flatMap((kind) => {
      const group = items.filter((item) => item.court === court && item.kind === kind)
      return group.length === 0 ? [] : [{ court, kind, items: group }]
    })
  )

/**
 * Assigns every Attention Item on a pull request to exactly one Court, from the
 * point of view of the Participant reading it. Pure: the same snapshot and the
 * same overrides always produce the same answer.
 */
export const deriveAttention = (
  snapshot: PullRequestSnapshot,
  overrides: ReadonlyArray<CourtOverride> = []
): Attention => {
  const role = roleOf(snapshot)

  // An Author does not review their own files; a Reviewer does nothing else.
  const derived: ReadonlyArray<AttentionItem> = [
    ...threadItems(snapshot, snapshot.viewer.login),
    ...(role === "reviewer" ? fileItems(snapshot) : []),
    ...checkItems(snapshot, role),
    ...reviewItems(snapshot, role),
    ...mergeItems(snapshot, role)
  ]

  // A pull request that is finished needs nothing from anyone.
  const closed = snapshot.state === "merged" || snapshot.state === "closed"

  const items = derived.map((item) => {
    const override = overrides.find((candidate) => candidate.itemId === item.id)
    if (override !== undefined) return { ...item, court: override.court }
    return closed ? { ...item, court: "settled" as const } : item
  })

  return {
    role,
    items,
    rows: rowsOf(items),
    yourMoveCount: items.filter((item) => item.court === "your-move").length
  }
}
