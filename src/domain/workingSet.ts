import type { Option } from "effect"
import type { Participant, PullRequestState } from "./PullRequest"
import type { PullRequestRef } from "./PullRequestRef"

/**
 * GitHub's own groupings of a Participant's Working Set.
 *
 * Theirs rather than ours, and named the way they name them on purpose: these
 * are the six `filter` arguments their pull request dashboard asks for, one
 * request each, and the whole value of reading them is that GitHub has already
 * decided which pull requests belong on which. A Court is what this codebase
 * concludes; a Shelf is what GitHub said.
 *
 * Kept as a separate concept from {@link Court} because they are not the same
 * question and will not stay in step: GitHub can add a seventh shelf, or change
 * what one of them means, without this interface's three Courts moving at all.
 */
export type Shelf =
  | "needs-action"
  | "team-review-requested"
  | "waiting-for-review"
  | "ready-to-merge"
  | "your-drafts"
  | "merge-queue"

/**
 * Every shelf, so that reading the whole Working Set is a loop rather than six
 * hand-written calls that can fall out of step with the type.
 */
export const SHELVES: ReadonlyArray<Shelf> = [
  "needs-action",
  "team-review-requested",
  "waiting-for-review",
  "ready-to-merge",
  "your-drafts",
  "merge-queue"
]

/** Where an Attention Item sits, as CONTEXT.md defines the three of them. */
export type Court = "your-move" | "waiting-on-others" | "settled"

/**
 * How a pull request's whole run of checks stands, in one line.
 *
 * The rollup GitHub computes, not the individual checks: a Working Set row has
 * room for "11 of 13" and no room at all for thirteen names. The states are
 * narrowed to three because that is every distinction a row can draw — their
 * `ERROR` and `EXPECTED` are both a run that has not come good yet.
 */
export type CheckRollup = {
  readonly state: "passing" | "failing" | "running"
  readonly total: number
  readonly passed: number
}

/** What the reviews came to, where they came to anything. */
export type Opinion = "approved" | "changes-requested" | "review-required"

/**
 * One Involved Pull Request: a pull request the Participant authored, was asked
 * to review, was assigned to, or was mentioned in.
 *
 * Assembled from two reads rather than one, which is why {@link checks} and
 * {@link reviewed} are absent rather than empty to begin with. GitHub's rows
 * carry neither, and its own dashboard fetches them straight afterwards batched
 * by id — so a row is real and worth drawing before either has arrived, and the
 * type says which half is missing instead of pretending a run with no checks
 * and a run not yet asked about are the same thing.
 */
export type InvolvedPullRequest = {
  readonly reference: PullRequestRef
  /** GitHub's numeric id, which is the only key the deferred read answers by. */
  readonly id: number
  readonly title: string
  readonly author: Participant
  readonly state: PullRequestState
  /** Which of GitHub's six shelves this arrived on, and so which Court it is in. */
  readonly shelf: Shelf
  /**
   * GitHub's own reason it wants attention — `CI_FAILING` and its siblings.
   *
   * None on a pull request read through a plain query rather than a shelf, since
   * that route leaves the field null. Shown rather than acted on: the Court
   * comes from the shelf, so an unrecognised reason costs a label and no more.
   */
  readonly why: Option.Option<string>
  /** False where the Participant has not looked since it last changed. */
  readonly readByViewer: boolean
  readonly comments: number
  /**
   * Counted, not listed. Neither array's element shape has ever been observed
   * populated, so nothing here claims to know what is in them.
   */
  readonly labels: number
  readonly assignees: number
  readonly openedAt: string
  readonly changedAt: string
  readonly headSha: string
  /** GitHub's signed tokens for watching this row change, handed back to their socket. */
  readonly channels: ReadonlyArray<string>
  /** None until the deferred read has answered for this pull request. */
  readonly checks: Option.Option<CheckRollup>
  /** None where nobody has given an opinion yet, which is most of them. */
  readonly reviewed: Option.Option<Opinion>
}

/**
 * What deciding a Court needs, which is less than a whole pull request.
 *
 * `standsOnUnlanded` is the only fact here that no single pull request can
 * answer about itself: it comes from the stack it sits in, which is why it is
 * passed rather than read.
 */
export type Weighing = {
  readonly shelf: Shelf
  readonly state: PullRequestState
  /** Whether this sits above a pull request in the same stack that has not landed. */
  readonly standsOnUnlanded: boolean
}

/**
 * Which shelves mean the Participant is the one who has to move.
 *
 * Deliberately a lookup rather than a chain of conditions: adding a shelf to
 * the type without deciding its Court is then a compile error rather than a row
 * that quietly lands in the wrong group.
 */
const COURT_OF_SHELF: Record<Shelf, Court> = {
  // GitHub says this one needs the Participant. It is the shelf that carries a
  // `category` saying why — `CI_FAILING` and its siblings.
  "needs-action": "your-move",
  "team-review-requested": "your-move",
  // Ready to land is a move: the pressing of the button is the Participant's.
  "ready-to-merge": "your-move",
  // A draft nobody has been asked to look at yet is the Author's to finish.
  "your-drafts": "your-move",
  // The Participant has put it up and owes nothing until somebody reads it.
  "waiting-for-review": "waiting-on-others",
  // GitHub is testing it against whatever is ahead of it in the queue. Nothing
  // to do but wait, and a row claiming otherwise is one opened for no reason.
  "merge-queue": "waiting-on-others"
}

/**
 * Which Court a pull request of the Working Set sits in.
 *
 * The shelf is the answer, and the two corrections applied to it are the two
 * things a shelf cannot know. The state outlives the shelf, because a shelf is
 * a snapshot of a moment and a pull request merged since is settled whatever it
 * was grouped under. And the stack is invisible to GitHub's own grouping, which
 * is computed per pull request: it will call the top of a stack ready to merge
 * while the foundation underneath is still in review.
 *
 * The corrections stop there on purpose. The deferred read supplies a check
 * rollup and a review decision, and it is tempting to use them here — to move a
 * pull request awaiting review into Your Move because its checks are failing.
 * That needs to know whether the Participant is the Author of it, and which
 * shelves imply that has not been established against real payloads yet. Until
 * it is, those two facts are shown rather than acted on.
 */
export const courtOf = ({ shelf, state, standsOnUnlanded }: Weighing): Court => {
  if (state === "merged" || state === "closed") return "settled"

  // Only landing is held back by the stack. Anything else on a child can be
  // done now: a failing check is fixed before the foundation lands, not after.
  if (shelf === "ready-to-merge" && standsOnUnlanded) return "waiting-on-others"

  return COURT_OF_SHELF[shelf]
}
