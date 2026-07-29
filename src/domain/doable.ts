import { Option } from "effect"
import type { MergeState, PullRequestState } from "./PullRequest"

/**
 * Everything this interface can ask GitHub to do to a pull request.
 *
 * One list, in the domain rather than in the card, because the card is not the
 * only thing that has an opinion about these: a keyboard shortcut, a context
 * menu, or a second screen would each have worked the answers out again.
 */
export type Doing =
  | "merge"
  | "enqueue"
  | "dequeue"
  | "cancel"
  | "update"
  | "close"
  | "markReady"
  | "toDraft"

/** Where a pull request stands with a queue, as the one verb that follows from it. */
export type Standing = "enqueue" | "dequeue" | "cancel"

/** The two facts that between them decide what may be asked for. */
export type Wanting = {
  readonly state: PullRequestState
  readonly merge: MergeState
}

const NOTHING: ReadonlySet<Doing> = new Set()

/**
 * Which of the three queue verbs this pull request is at, if any.
 *
 * Not a preference and not a permission: a pull request already standing in the
 * line cannot be put into it again, and one GitHub is already holding can only
 * be let go. Answered even where the reader may not press it, because a greyed
 * control that says what it would do beats an absent one.
 *
 * None where the repository has no queue — including where a plain auto-merge is
 * armed, which is a different thing GitHub offers and this interface does not
 * yet touch.
 */
export const standingIn = (merge: MergeState): Option.Option<Standing> =>
  Option.map(merge.queue, (queue) =>
    queue.waiting ? "dequeue" : Option.isSome(merge.autoMerge) ? "cancel" : "enqueue"
  )

/**
 * What may be asked of this pull request, now, by this reader.
 *
 * The single place that answer lives. It used to be five expressions in the
 * merge card, one per button, each reading the facts it happened to need — so a
 * merged pull request was offered a place in the merge queue, because no button
 * had reason to ask whether the thing was still alive.
 *
 * Three kinds of no are folded together here on purpose, since a caller can do
 * nothing different with them: the pull request is past deciding, GitHub would
 * refuse, or the reader lacks the permission. What the card says about each is
 * the blockers and refusals it already prints.
 */
export const whatCanBeDone = ({ state, merge }: Wanting): ReadonlySet<Doing> => {
  // Merged and closed are the end of the conversation. GitHub will reopen a
  // closed one, which this interface does not do, so it offers nothing at all
  // rather than a row of controls that all come back refused.
  if (state === "merged" || state === "closed") return NOTHING

  const draft = state === "draft"
  const can = new Set<Doing>(["close", draft ? "markReady" : "toDraft"])

  if (Option.isSome(merge.update) && merge.update.value.mayUpdate) can.add("update")

  // A draft may be neither merged nor queued — GitHub's rule, not a repository
  // setting — and the one press that changes that is the mark-ready above.
  if (draft) return can

  const standing = standingIn(merge)
  if (Option.isNone(standing)) {
    if (merge.isMergeable) can.add("merge")
    return can
  }

  if (mayTouchTheQueue(standing.value, merge)) can.add(standing.value)
  return can
}

/**
 * Whether the reader may work the queue, which GitHub answers in two halves.
 *
 * `viewerCanQueue` is about the person and `mayJoin` is about this pull request:
 * someone allowed to queue anything still cannot queue one with an unresolved
 * thread. Cancelling is the exception — a held merge is called off by whoever
 * armed it, which GitHub answers separately.
 */
const mayTouchTheQueue = (standing: Standing, merge: MergeState): boolean => {
  if (standing === "cancel") {
    return Option.match(merge.autoMerge, {
      onNone: () => false,
      onSome: (armed) => armed.viewerCanCancel
    })
  }

  return Option.match(merge.queue, {
    onNone: () => false,
    onSome: (queue) => queue.viewerCanQueue && (standing === "dequeue" || queue.mayJoin)
  })
}

/**
 * The two shapes a merge card can have, so it cannot wear the wrong one.
 *
 * A settled pull request has no merge state worth showing — no blockers to
 * clear, no queue to join, no branch to catch up — and the type says so by not
 * carrying any. That is the invariant the card kept breaking while both faces
 * were one bag of optional facts.
 */
export type MergeFace =
  | { readonly kind: "settled"; readonly how: "merged" | "closed" }
  | {
      readonly kind: "live"
      readonly merge: MergeState
      readonly can: ReadonlySet<Doing>
      /** Which queue verb to show, pressable or not. None where there is no queue. */
      readonly queueing: Option.Option<Standing>
      /** Which way the draft door goes, this being decided by the state alone. */
      readonly drafting: "markReady" | "toDraft"
    }

export const faceOf = (wanting: Wanting): MergeFace => {
  if (wanting.state === "merged") return { kind: "settled", how: "merged" }
  if (wanting.state === "closed") return { kind: "settled", how: "closed" }

  return {
    kind: "live",
    merge: wanting.merge,
    can: whatCanBeDone(wanting),
    queueing: standingIn(wanting.merge),
    drafting: wanting.state === "draft" ? "markReady" : "toDraft"
  }
}
