import { Option } from "effect"
import { holdingItUp } from "./pressing"
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
  | "reopen"

/**
 * The same nine, as a list something can walk.
 *
 * The type is the truth and this is checked against it: a tenth verb added
 * above and forgotten here is a compile error rather than a control that
 * quietly never reaches GitHub.
 */
const EVERY: Record<Doing, true> = {
  merge: true,
  enqueue: true,
  dequeue: true,
  cancel: true,
  update: true,
  close: true,
  markReady: true,
  toDraft: true,
  reopen: true
}

export const DOINGS = Object.keys(EVERY) as ReadonlyArray<Doing>

/** Where a pull request stands with a queue, as the one verb that follows from it. */
export type Standing = "enqueue" | "dequeue" | "cancel"

/** The two facts that between them decide what may be asked for. */
export type Wanting = {
  readonly state: PullRequestState
  readonly merge: MergeState
}

const NOTHING: ReadonlySet<never> = new Set()

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

  // A layer of a stack is not merged on its own, so being mergeable itself is
  // not enough. The press lands everything under it too, and GitHub answers
  // only for the one being read — see `holdingItUp`.
  const held = Option.match(merge.stack, {
    onNone: () => false,
    onSome: (stack) => holdingItUp(stack).length > 0
  })

  const standing = standingIn(merge)
  if (Option.isNone(standing)) {
    // A press has to name a way of merging, so a merge box that named none this
    // can send is a no. Every press used to post the same word regardless, which
    // GitHub refuses outright on a repository that does not allow it.
    if (merge.isMergeable && !held && Option.isSome(merge.method)) can.add("merge")
    return can
  }

  if (mayTouchTheQueue(standing.value, merge)) can.add(standing.value)
  return can
}

/**
 * What the state on its own allows, which is all a row in a list has read.
 *
 * The card asks `whatCanBeDone`, having read a whole merge state: which
 * blockers stand, whether the repository lands through a queue, whether the
 * branch may be caught up. A row in the Working Set has six fields and not one
 * of them is about mergeability, so it asks the narrower question — which verbs
 * the state itself does not rule out.
 *
 * Merge is offered on that footing and no other. The row cannot know whether
 * GitHub will have it, and a refusal repeated word for word where the reader
 * pressed reads better than a control missing for a reason nobody can see.
 *
 * Reopening is here and not above for the same reason it was left out
 * altogether: a closed pull request has no merge state to read, so the card has
 * nothing to ask this question with. A list does.
 */
export type RowDoing = Extract<Doing, "merge" | "close" | "reopen" | "markReady" | "toDraft">

/**
 * What each verb that ends in a state turns the pull request into.
 *
 * Five of the nine. Closing a pull request is exactly what makes it closed, so
 * this is not a guess and both surfaces are entitled to show it before GitHub
 * has confirmed it — the list rearranges the row, the card wears the settled
 * face, and a refusal puts either back.
 */
export const LEADS_TO: Record<RowDoing, PullRequestState> = {
  merge: "merged",
  close: "closed",
  reopen: "open",
  markReady: "open",
  toDraft: "draft"
}

/**
 * What puts each verb back, for the four that GitHub will undo.
 *
 * Not a convenience. It decides two separate things and keeps them from
 * disagreeing: whether a surface may offer a way back after the fact, and
 * whether it has to ask beforehand instead. A verb with an opposite can be done
 * on one press and taken back from the sentence that says it landed; a verb
 * without one has to be confirmed before it goes, because afterwards there is
 * nothing to offer.
 *
 * Merging is the one without. GitHub has no un-merge — a revert is a new pull
 * request, which is a different thing this interface would be lying about if it
 * put the word "Undo" on it.
 */
const PUTS_BACK: Partial<Record<RowDoing, RowDoing>> = {
  close: "reopen",
  reopen: "close",
  markReady: "toDraft",
  toDraft: "markReady"
}

export const putsBack = (doing: RowDoing): Option.Option<RowDoing> =>
  Option.fromNullishOr(PUTS_BACK[doing])

/**
 * The same question asked of any verb, including the four it has no answer for.
 *
 * Joining a queue, leaving one, calling off a held merge and catching a branch
 * up all change facts nobody here can work out: a place in the line is GitHub's
 * to know, and a branch caught up is a new head commit with new checks against
 * it. So they say nothing rather than something invented, and the surface that
 * asked waits for the read.
 */
export const stateAfter = (doing: Doing): Option.Option<PullRequestState> =>
  doing in LEADS_TO
    ? Option.some(LEADS_TO[doing as RowDoing])
    : Option.none()

export const whatStateAllows = (state: PullRequestState): ReadonlySet<RowDoing> => {
  if (state === "merged") return NOTHING
  if (state === "closed") return new Set<RowDoing>(["reopen"])

  return state === "draft"
    ? new Set<RowDoing>(["close", "markReady"])
    : new Set<RowDoing>(["merge", "close", "toDraft"])
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
 * The three shapes a merge card can have, so it cannot wear the wrong one.
 *
 * A settled pull request has no merge state worth showing — no blockers to
 * clear, no queue to join, no branch to catch up — and the type says so by not
 * carrying any. That is the invariant the card kept breaking while both faces
 * were one bag of optional facts.
 *
 * Unread is the same argument made about a merge box GitHub would not serve. It
 * carries nothing either, and for a stronger reason: there is nothing to carry.
 * Building a live face out of an absent merge box would mean `isMergeable: false`
 * and an empty list of blockers, which is the worst reading available — it says no
 * and will not say why.
 */
export type MergeFace =
  | { readonly kind: "settled"; readonly how: "merged" | "closed" }
  | { readonly kind: "unread" }
  | {
      readonly kind: "live"
      readonly merge: MergeState
      readonly can: ReadonlySet<Doing>
      /** Which queue verb to show, pressable or not. None where there is no queue. */
      readonly queueing: Option.Option<Standing>
      /** Which way the draft door goes, this being decided by the state alone. */
      readonly drafting: "markReady" | "toDraft"
    }

/** The state, and what the merge box said about it where GitHub served one. */
export type Facing = {
  readonly state: PullRequestState
  readonly merge: Option.Option<MergeState>
}

/**
 * Which face to wear, in the one order that cannot put the wrong one on.
 *
 * Settled is answered first and off the state alone, which is deliberate: the state
 * comes from the `changes` route, the merge box is a different route, and a pull
 * request known to have landed has landed whether or not that second route answered.
 * Asking about the merge box first would put "nobody knows whether this can land"
 * under a badge reading Merged, which is a sentence about a decision that was made.
 *
 * Only what is left needs a merge box, so only what is left can be unread. Below that
 * line `whatCanBeDone` and `standingIn` see a real merge state and nothing else, which
 * is what keeps every verb on the card answerable.
 */
export const faceOf = ({ state, merge }: Facing): MergeFace => {
  if (state === "merged") return { kind: "settled", how: "merged" }
  if (state === "closed") return { kind: "settled", how: "closed" }
  if (Option.isNone(merge)) return { kind: "unread" }

  return {
    kind: "live",
    merge: merge.value,
    can: whatCanBeDone({ state, merge: merge.value }),
    queueing: standingIn(merge.value),
    drafting: state === "draft" ? "markReady" : "toDraft"
  }
}
