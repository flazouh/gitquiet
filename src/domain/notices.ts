import { Option } from "effect"
import { COURTS } from "./attention"
import type { Participant } from "./PullRequest"
import type { Court } from "./workingSet"

/**
 * The state of the thing a Notice is about, as far as their row says it.
 *
 * Four answers and not GitHub's own `PullRequestState`, because this page mixes pull
 * requests, issues and security advisories on one list and an advisory has no state at all.
 * `unknown` is a real answer here rather than a failure to read one: a draft pull request, a
 * discussion, a release and a completed workflow run all reach this inbox, none of them
 * appeared on the inbox this was measured against on 2026-08-13, and guessing at their icon
 * would put rows in the wrong Court on the strength of nothing.
 */
export type Standing = "open" | "merged" | "closed" | "unknown"

export type PressKind =
  | "mark"
  | "unmark"
  | "archive"
  | "unarchive"
  | "subscribe"
  | "unsubscribe"
  | "star"
  | "unstar"

/**
 * Something the reader can do to a Notice without leaving the screen.
 *
 * A Rails form GitHub already put in the row, kept whole rather than rebuilt from the kind,
 * because the token is per-form: every one of the six on a row was a different string, so a
 * caller reusing one from elsewhere on the page is a caller relying on GitHub not to check.
 *
 * Unlike the run screen's two presses, the form being there does not mean the press applies.
 * A run page carries a cancel form or a re-run form and never both; a Notice row carries all
 * six, in pairs, and their own script shows one of each pair at a time. So which half applies
 * is read from the row's state — see {@link Notice.unread} and {@link Notice.subscribed} —
 * and the form is only where the address and the token come from.
 */
export type Press = {
  readonly kind: PressKind
  readonly route: string
  readonly token: string
  readonly ids: ReadonlyArray<string>
}

/**
 * One row of GitHub's notifications page: one thread the reader is subscribed to.
 *
 * Everything here is on the row GitHub serves. There is no second fetch behind any of it,
 * which is what makes a screen over this page possible at all — measured on 2026-08-13,
 * where the state of the subject turned out to be the Octicon at the head of every row.
 */
export type Notice = {
  /** GitHub's own thread id, which is what every write form addresses the row by. */
  readonly id: string
  readonly url: string
  readonly repository: string
  /** The `#2169` their row prints, without the hash. Absent on a security advisory. */
  readonly number: string | null
  readonly title: string
  /**
   * Why the reader was ever told about this thread, in GitHub's own spelling.
   *
   * Their string kept verbatim rather than mapped to a word of ours, because the mapping to
   * a Court is the only opinion worth holding about it and it is held in one place below.
   * A string and not a union: GitHub has fifteen of these today and adding a sixteenth is
   * their decision, so an unrecognised one has to reach {@link courtOf} rather than being
   * refused by a type.
   */
  readonly reason: string
  readonly standing: Standing
  readonly unread: boolean
  /**
   * Whether GitHub will go on telling the reader about this thread.
   *
   * Read off the row's own `notification-unsubscribed` class, which is the only marker on the
   * row that says it. There is no matching class for saved, so whether a Notice is bookmarked
   * is not on the page as far as this could establish: their bookmark span is rendered on
   * every row and hidden by a rule, so its presence says nothing.
   */
  readonly subscribed: boolean
  readonly movedAt: string
  /**
   * Who has been in the thread lately, machines marked.
   *
   * Recent participants and not authorship, which matters because the difference is what
   * discussion #4520 turns on. Read on 2026-08-13: on a pull request the reader opened
   * themselves, GitHub draws `railway-app` first and the reader second, so the order says
   * nothing either.
   */
  readonly participants: ReadonlyArray<Participant>
  readonly presses: ReadonlyArray<Press>
}

/**
 * The half of a pair of presses that applies to this Notice, or nothing.
 *
 * The pairs and what decides them: read state decides `mark` against `unmark`, the
 * subscription decides `subscribe` against `unsubscribe`, and `archive` always applies
 * because this screen reads the inbox and everything on it is un-archived by definition.
 * Saving is not offered, because nothing on the row says whether a Notice is already saved
 * and a button that might do the opposite of what it says is worse than no button.
 */
export const pressOf = (notice: Notice, kind: PressKind): Option.Option<Press> => {
  const applies =
    kind === "mark" ? notice.unread
      : kind === "unmark" ? !notice.unread
        : kind === "subscribe" ? !notice.subscribed
          : kind === "unsubscribe" ? notice.subscribed
            : kind === "archive"

  if (!applies) return Option.none()
  return Option.fromNullishOr(notice.presses.find((one) => one.kind === kind))
}

/** A Court of the inbox, and the Notices filed in it. */
export type NoticeDocket = {
  readonly court: Court
  readonly notices: ReadonlyArray<Notice>
  /** What a heading says without the Court being opened. */
  readonly count: number
}

/**
 * Every reason GitHub sends, in their own spelling.
 *
 * Their published list rather than the six this inbox happened to carry, so the mapping
 * below is complete on the day it is written and a reason nobody here has seen still lands
 * somewhere deliberate. Kept because the tests iterate it: a reason added to the map without
 * a test is a reason nobody checked.
 */
export const REASONS = [
  "approval_requested",
  "assign",
  "author",
  "ci_activity",
  "comment",
  "invitation",
  "manual",
  "member_feature_requested",
  "mention",
  "review_requested",
  "security_advisory_credit",
  "security_alert",
  "state_change",
  "subscribed",
  "team_mention"
] as const

const INBOX = /^\/notifications\/?$/

/**
 * Whether an address is the inbox this screen replaces.
 *
 * The inbox itself only. `/notifications/subscriptions` is a different page listing
 * different objects, and taking it would replace something this interface has nothing to say
 * about. A query is allowed and ignored, for the reason `actionsIn` ignores one: their
 * filters are theirs, and this screen groups instead of filtering.
 */
export const noticesIn = (url: string): boolean => {
  const at = Option.liftThrowable((address: string) => new URL(address))(url)
  if (Option.isNone(at)) return false
  if (at.value.hostname !== "github.com") return false
  return INBOX.test(at.value.pathname)
}

/**
 * What the subject came to, off the Octicon their row draws at its head.
 *
 * The colour is read with the shape because their markup carries both and the shape alone
 * lies: `octicon-git-pull-request-closed` contains `octicon-git-pull-request`, so a match on
 * the word would call every closed pull request open. The order below puts the longer name
 * first for the same reason.
 *
 * `octicon-alert` is a security advisory, which has a severity and no state, so it is left
 * unknown rather than forced into one of the three.
 */
export const standingOf = (icon: string): Standing => {
  if (icon.includes("octicon-git-pull-request-closed")) return "closed"
  if (icon.includes("octicon-git-merge")) return "merged"
  if (icon.includes("octicon-git-pull-request")) return "open"
  if (icon.includes("octicon-issue-closed")) return "closed"
  if (icon.includes("octicon-issue-opened")) return "open"
  return "unknown"
}

/**
 * The Court a reason gives, before the subject's state is allowed to overrule it.
 *
 * Waiting is the fall-through, and it is the right one for a reason nobody here has seen.
 * The two mistakes a default can make are not the same size: a Notice wrongly in Waiting is
 * one the reader scrolls past, and a Notice wrongly in Needs You is a to-do list nobody can
 * trust.
 */
const COURT_OF_REASON: Readonly<Record<string, Court>> = {
  // Somebody asked the reader for something, by name.
  review_requested: "needs-you",
  approval_requested: "needs-you",
  assign: "needs-you",
  mention: "needs-you",
  // A vulnerability in the reader's own repository, which only a person closes.
  security_alert: "needs-you",
  member_feature_requested: "needs-you",
  // The reader opened it, spoke in it, subscribed to it or watches the repository. Somebody
  // else owes the next step, which is what `courtOfThread` says about the reader's own last
  // word on a review thread.
  author: "waiting",
  comment: "waiting",
  manual: "waiting",
  subscribed: "waiting",
  /*
   * A team was named and not a person. Somebody on it owes an answer and the row does not say
   * who, so calling this Needs You is what makes a busy team's inbox indistinguishable from a
   * personal one — the same reason `courtOf` refuses to call a stranger's pull request the
   * reader's move.
   */
  team_mention: "waiting",
  invitation: "settled",
  security_advisory_credit: "settled",
  state_change: "settled"
}

/**
 * Which Court one Notice sits in.
 *
 * The state outranks the reason, and that is not a new opinion: `courtOf` in
 * `workingSet.ts` and `attentionIn` in `attention.ts` both open by returning Settled for
 * anything merged or closed, and this agrees with them rather than inventing a second answer
 * for the same fact. It is also where nearly all of the work happens. Across three of
 * GitHub's own reason queries on 2026-08-13 — 15 review requests, 24 mentions and 12
 * comments — 41 of the 51 rows concerned something already merged or closed, including 11 of
 * the 15 review requests.
 *
 * `ci_activity` is the one reason the state decides rather than the map. GitHub sends it when
 * a run the reader triggered has *completed*, so the machine has already stopped and the
 * outcome is all that is left: a run that failed is the reader's to fix, and one that passed
 * is over. No such row was on the measured inbox, so an unknown shape falls to the reader
 * rather than being quietly settled.
 *
 * Nothing lands in Running, which is why the inbox has no such Court to draw: see
 * {@link NOTICE_COURTS}. Running means a machine owes the next step and only time moves it; a
 * Notice exists because a machine has finished, and a row about an open pull request carries no
 * check state at all.
 */
export const courtOf = (notice: Notice): Court => {
  if (notice.standing === "merged" || notice.standing === "closed") return "settled"
  if (notice.reason === "ci_activity") return "needs-you"
  return COURT_OF_REASON[notice.reason] ?? "waiting"
}

/**
 * Unread first, then whatever moved most recently.
 *
 * Read state orders and never groups. Whether the reader has opened a row is a bookmark they
 * keep for themselves and says nothing about who owes the next move, which is the same thing
 * `docs/spec/control-center.md` concludes about Reviewed State on a diff.
 */
const readLast = (some: ReadonlyArray<Notice>): ReadonlyArray<Notice> =>
  [...some].sort((one, two) =>
    one.unread === two.unread ? two.movedAt.localeCompare(one.movedAt) : one.unread ? -1 : 1
  )

/**
 * The Courts an inbox has, which is three of the product's four.
 *
 * Taken out of the four rather than written again, so the order a reader learns on every other
 * screen is the order here and cannot drift from it.
 *
 * Running is the one left out, and it is left out because {@link courtOf} cannot return it on
 * any inbox, ever. Elsewhere an empty Court is drawn anyway — a reader finds Settled by where it
 * sits, and a heading that came and went with the day's rows would take that away — but that
 * argument is about a Court which is empty this morning and full this afternoon. A heading
 * nothing can ever reach teaches the reader instead that a heading may mean nothing, which is
 * the opposite of what filing by who acts next is for.
 */
export const NOTICE_COURTS: ReadonlyArray<Court> = COURTS.filter((court) => court !== "running")

/**
 * Every Notice in three piles, in the order a reader asks about them.
 *
 * All three come back even where two are empty, which is the part of `docketsIn`'s reasoning
 * that does hold here: "Nothing." under a heading is worth more than a heading that moves.
 */
export const docketsOf = (notices: ReadonlyArray<Notice>): ReadonlyArray<NoticeDocket> =>
  NOTICE_COURTS.map((court) => {
    const held = readLast(notices.filter((one) => courtOf(one) === court))
    return { court, notices: held, count: held.length }
  })
