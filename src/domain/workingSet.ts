import { Option } from "effect"
import type { ChangedFile, Participant, PullRequestState } from "./PullRequest"
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

/**
 * Where an Attention Item sits, as CONTEXT.md defines the four of them.
 *
 * Four rather than three because the three were not a partition. `waiting` was
 * asked to hold a colleague who owes a review, a build nobody can hurry, and a
 * stranger's pull request nobody is waiting on at all — and a heading covering
 * three unrelated situations tells a reader to relax about all of them. What
 * separates them is who owes the next step: the reader, a person, or a machine.
 */
export type Court = "needs-you" | "waiting" | "running" | "settled"

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
 * How many lines a pull request adds and takes away.
 *
 * The fact a list is least able to do without and least likely to be given: a
 * forty-line fix and a four-thousand-line rewrite are the same row without it,
 * and which of the two a reader opens first is not a close decision. GitHub
 * sends it in no listing, so it is a read of its own — seventy bytes each.
 */
export type Size = {
  readonly added: number
  readonly deleted: number
}

/**
 * The same fact, added up from the files themselves.
 *
 * A screen holding the files does not have to wait for the read above: it can
 * add them. Four places were doing that with their own pair of reduces — the
 * header's well, the strip over a stack, and the counts on the files card — and
 * a fifth would have been written the next time. The sum is the same sum, so it
 * is one function, and it hands back the shape the read hands back so that a
 * caller cannot tell which of the two it was given.
 */
export const sizeOf = (files: ReadonlyArray<ChangedFile>): Size => ({
  added: files.reduce((sum, file) => sum + file.linesAdded, 0),
  deleted: files.reduce((sum, file) => sum + file.linesDeleted, 0)
})

/** What that read said, by the id it answered about. */
export type Sizes = ReadonlyMap<number, Size>

/**
 * The same pull requests with their sizes, where the sizes are known.
 *
 * Rows it did not answer about stay absent rather than becoming zero, for the
 * reason every other late arrival here does: a pull request that changes nothing
 * and one nobody has measured yet are not the same row.
 */
export const withSizes = (
  involved: ReadonlyArray<InvolvedPullRequest>,
  sizes: Sizes
): ReadonlyArray<InvolvedPullRequest> =>
  involved.map((one) => {
    const found = sizes.get(one.id)
    return found === undefined ? one : { ...one, size: Option.some(found) }
  })

/**
 * What a second read added about pull requests already listed, by the id it
 * answered about.
 *
 * A listing arrives without either of these — see {@link InvolvedPullRequest} —
 * and they follow in a batch. Here rather than beside whatever fetched them
 * because neither the shape nor the joining below has anything to do with where
 * they came from: a listing read from GitHub's dashboard and one read from their
 * public API are missing the same two facts and complete them the same way.
 */
export type Standings = ReadonlyMap<
  number,
  { readonly checks: Option.Option<CheckRollup>; readonly reviewed: Option.Option<Opinion> }
>

/**
 * The same pull requests with whatever the second read had to say about them.
 *
 * Rows it did not answer about keep their absent checks rather than gaining
 * empty ones, because the two mean different things to a reader: a pull request
 * with no checks configured is finished, and one not yet asked about is still
 * loading.
 */
export const withStandings = (
  involved: ReadonlyArray<InvolvedPullRequest>,
  standings: Standings
): ReadonlyArray<InvolvedPullRequest> =>
  involved.map((one) => {
    const found = standings.get(one.id)
    return found === undefined ? one : { ...one, checks: found.checks, reviewed: found.reviewed }
  })

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
  /**
   * Which of GitHub's six shelves this arrived on, and so which Court it is in.
   *
   * None where it arrived on no shelf at all. A repository's own list is read
   * through a plain query — every open pull request in one repository, most of
   * them nothing to do with the reader — and GitHub only shelves the ones it
   * considers theirs. So the absence is the fact: nobody asked them to do this.
   */
  readonly shelf: Option.Option<Shelf>
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
  /** None until the read that counts its lines has answered for this one. */
  readonly size: Option.Option<Size>
}

/**
 * What deciding a Court needs, which is less than a whole pull request.
 *
 * `standsOnUnlanded` is the only fact here that no single pull request can
 * answer about itself: it comes from the stack it sits in, which is why it is
 * passed rather than read.
 */
export type Weighing = {
  readonly shelf: Option.Option<Shelf>
  readonly state: PullRequestState
  /** Whether this sits above a pull request in the same stack that has not landed. */
  readonly standsOnUnlanded: boolean
  /**
   * The rollup, absent until the deferred read answers about this row.
   *
   * Required rather than optional so that a caller who has a row in hand cannot
   * forget to pass what it knows: the two facts below arrive on the row a step
   * before this runs, and the reason they went unused for so long is that
   * nothing made passing them the easier path.
   */
  readonly checks: Option.Option<CheckRollup>
  /** None where GitHub's `reviewDecision` was null, which is a fact — see {@link landable}. */
  readonly reviewed: Option.Option<Opinion>
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
  "needs-action": "needs-you",
  "team-review-requested": "needs-you",
  // Ready to land is a move: the pressing of the button is the Participant's.
  "ready-to-merge": "needs-you",
  // A draft nobody has been asked to look at yet is the Author's to finish.
  "your-drafts": "needs-you",
  // The Participant has put it up and owes nothing until somebody reads it.
  "waiting-for-review": "waiting",
  // GitHub is testing it against whatever is ahead of it in the queue. Nothing
  // to do but wait, and nobody owes the Participant an answer either: the next
  // step belongs to a machine, and only time moves it.
  "merge-queue": "running"
}

/**
 * The shelves where a run still going is the whole of what is left to happen.
 *
 * Not every shelf. A review asked of the Participant can be written while the
 * build runs, and a failing check is theirs to fix whatever else is in flight —
 * so demoting those to Running would take work off a to-do list because an
 * unrelated machine is busy.
 */
const NOTHING_BUT_THE_RUN: ReadonlyArray<Shelf> = ["waiting-for-review", "ready-to-merge"]

/**
 * Whether the merge button GitHub would draw on this is one it would honour.
 *
 * Both halves are read, and the absent review is the half worth explaining.
 * GitHub sends `reviewDecision: null` when no rule demands an approval, and
 * `REVIEW_REQUIRED` when one does — see `opinionOf` in the adapter. So None here
 * is not silence about the reviews: it is GitHub saying nothing is required.
 *
 * Passing checks are what make the None safe to read. Both facts arrive from the
 * same deferred read, so a rollup in hand proves that read answered, where a
 * None on its own would also mean nobody has asked yet.
 */
const landable = ({ checks, reviewed, standsOnUnlanded }: Weighing): boolean =>
  !standsOnUnlanded &&
  Option.isSome(checks) &&
  checks.value.state === "passing" &&
  Option.isNone(reviewed)

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
 * Two more corrections come from the deferred read, and both are about the two
 * shelves that have nothing left to do but wait. `waiting-for-review` is the one
 * GitHub is least right about: it means nobody has answered, which on a
 * repository requiring no approval is not a wait at all but a live merge button.
 * And a run still going is a machine's turn rather than a person's, which is the
 * distinction the Running Court exists to draw.
 *
 * The Author is not asked about, and does not need to be. Both corrections only
 * ever apply to shelves the Participant is already the Author of, since that is
 * what those two shelves mean.
 */
export const courtOf = (weighing: Weighing): Court => {
  const { shelf, state, standsOnUnlanded } = weighing

  if (state === "merged" || state === "closed") return "settled"

  // On none of the reader's shelves, which is most of a repository's own list.
  // Somebody has to review it or land it and that somebody is not the reader.
  // Not Needs You, which is a list of things to actually go and do.
  if (Option.isNone(shelf)) return "waiting"

  // Only landing is held back by the stack. Anything else on a child can be
  // done now: a failing check is fixed before the foundation lands, not after.
  if (shelf.value === "ready-to-merge" && standsOnUnlanded) return "waiting"

  if (NOTHING_BUT_THE_RUN.includes(shelf.value)) {
    if (Option.isSome(weighing.checks) && weighing.checks.value.state === "running") return "running"
    if (landable(weighing)) return "needs-you"
  }

  return COURT_OF_SHELF[shelf.value]
}

/**
 * The Court of one row, weighing everything the row already knows.
 *
 * For every caller with an Involved Pull Request in hand, which is all of them
 * outside the tests. Assembling a {@link Weighing} by hand is how two facts that
 * arrive a step earlier went unread for months, and that omission is what put a
 * green pull request nobody was required to review under a heading about waiting.
 */
export const courtOfOne = (one: InvolvedPullRequest, standsOnUnlanded = false): Court =>
  courtOf({
    shelf: one.shelf,
    state: one.state,
    standsOnUnlanded,
    checks: one.checks,
    reviewed: one.reviewed
  })
