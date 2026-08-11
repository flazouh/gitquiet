/**
 * One issue, as much of it as its own page shows.
 *
 * Kept apart from {@link InvolvedIssue} next door for the reason that type is
 * kept apart from an Involved Pull Request: a row in a Court needs a title, a
 * state and a count, and a page needs the body, everyone who spoke, and what
 * the reader is allowed to do about it. Folding the two would mean a dozen
 * fields permanently absent on every row.
 *
 * Named as `PullRequest.ts` is — one thing, spelt as one — because the two are
 * the same kind of thing: what a screen is drawn from.
 */

import type { Option } from "effect"
import type { IssueRef, IssueState } from "./issues"
import type { Description, Participant, Remark } from "./PullRequest"

/**
 * Why a closed issue closed, which is the one distinction the Courts throw away
 * on purpose and this page keeps.
 *
 * A list groups by what is owed and both of these are owed to nobody. A page is
 * read by somebody deciding whether the thing they came for was dealt with, and
 * "closed as not planned" answers that where "closed" does not.
 */
export type Closing = "completed" | "discarded" | "duplicate"

/**
 * A label with the colour GitHub gives it.
 *
 * Unlike the Working Set's rows, which are handed labels as bare words and
 * colour them by hashing the name. This route sends the real colour, so the
 * page uses it: two labels that GitHub draws red and green must not arrive here
 * as whatever a hash makes of "bug" and "shipped".
 */
export type Label = {
  readonly name: string
  /** Six hex digits, as GitHub sends them, with no leading hash. */
  readonly colour: string
  readonly description: Option.Option<string>
}

/**
 * One reaction and how many gave it.
 *
 * Kept as GitHub's own word for the emoji rather than the character, because
 * the word is what a write sends back and the character is a rendering
 * decision. Empty groups are dropped before they reach here: their payload
 * lists all eight on every issue, and seven zeroes is not information.
 */
export type Reaction = {
  readonly kind: string
  readonly count: number
  readonly viewerReacted: boolean
}

/**
 * What the reader may do to this issue, as GitHub answers it rather than as
 * this codebase guesses it.
 *
 * Every one of these is a control that either appears or does not. Guessing
 * from authorship and write access was the alternative, and it is wrong in both
 * directions: a triager can close an issue they did not raise, and an archived
 * repository refuses everyone.
 */
/**
 * The three ways a reader settles an issue, which is GitHub's own three.
 *
 * A union with a field rather than three names, because the third one needs something the
 * other two do not: an issue closed as a duplicate is closed as a duplicate *of* something,
 * and GitHub takes that as their own name for the other issue. A shape that let a duplicate
 * be sent without one would be a refusal waiting to happen at the far end of a press.
 */
export type Settling =
  | { readonly as: "completed" }
  | { readonly as: "discarded" }
  | { readonly as: "duplicate"; readonly of: string }

/**
 * A duplicate as the reader names it, before anybody has asked GitHub for its own name.
 *
 * Two types for the one act, because the reader and GitHub name an issue differently: a
 * person writes `#78` or a link, and the mutation takes `I_kwDOTndREM8AAAABLohEJg`. The read
 * that turns one into the other is a request, so it belongs behind the app layer rather than
 * inside a button — see `settleIssue`.
 */
export type Duplicating = { readonly as: "duplicate"; readonly of: IssueRef }

/**
 * What a press asks for, which is the same three with the duplicate named by address.
 *
 * Held apart from {@link Settling} on purpose: one is what a reader can say and the other is
 * what GitHub's route takes, and the step between them is a read. A single type covering both
 * would let a button send an address to a route that only answers to node ids.
 */
export type Settled =
  | { readonly as: "completed" }
  | { readonly as: "discarded" }
  | Duplicating

/** Which of the three it was, for anything that only cares about the word. */
export const closingOf = (settling: Settled): Closing => settling.as

export type Allowed = {
  readonly comment: boolean
  readonly close: boolean
  readonly reopen: boolean
  readonly label: boolean
  readonly assign: boolean
}

export type IssueSnapshot = {
  readonly reference: IssueRef
  /**
   * GitHub's own name for this issue, which is what a write to it is addressed to.
   *
   * Beside the reference rather than instead of it, because the two are wanted in
   * different places: the address is what a reader reads and links to, and this is
   * what their route for closing one takes. Neither can be worked out from the other.
   */
  readonly id: string
  readonly title: string
  readonly description: Description
  readonly state: IssueState
  /** Why it closed, on one that has. */
  readonly closing: Option.Option<Closing>
  readonly openedAt: string
  readonly author: Participant
  readonly labels: ReadonlyArray<Label>
  /** Who was given it. Empty where nobody was, which is most issues. */
  readonly assignees: ReadonlyArray<Participant>
  /** What was said about it, oldest first, as the timeline gives them. */
  readonly remarks: ReadonlyArray<Remark>
  readonly reactions: ReadonlyArray<Reaction>
  readonly allowed: Allowed
  /** Whoever is reading, so the box to write in is signed as the remark will be. */
  readonly viewer: Option.Option<Participant>
}

/**
 * Something said on an issue.
 *
 * The same shape as a pull request's {@link Remark} and deliberately the same
 * word: on a pull request a Remark is what hangs off no line, and an issue has
 * no lines at all, so every comment on one is a Remark. Re-exported rather than
 * redefined so the conversation panel can draw either without knowing which
 * page it is on.
 */
export type { Remark } from "./PullRequest"

/**
 * Whether anybody owes this issue a move, which is the question the Courts ask
 * of a row and this asks of a page.
 *
 * Deliberately thinner than the four Courts. A Court is decided from how the
 * reader is involved, and the page already knows something a list never does:
 * whether the reader can act on it at all.
 */
export const isSettled = (snapshot: IssueSnapshot): boolean => snapshot.state === "closed"
