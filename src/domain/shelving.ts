import { Option } from "effect"
import type { CheckRollup, Opinion, Shelf } from "./workingSet"

/**
 * Concluding a Shelf, for a platform whose GitHub will not name one.
 *
 * A Shelf is what GitHub said — see {@link Shelf}, which is deliberate about
 * that — and on their pull request dashboard it is a `filter` argument, six
 * requests, and no arithmetic on our side at all. Their documented API offers no
 * such thing: `search` has no qualifier for any of the six, and the two that
 * matter most cannot be approximated with one either, since `team-review-requested`
 * takes a named team rather than "whichever teams the reader is in" and the merge
 * queue has no qualifier whatsoever.
 *
 * So an app on the documented API has to conclude the Shelf, and this is where
 * that happens: a pure rule over facts the API does answer, kept beside the
 * Shelf it produces rather than inside whichever adapter asked. Two consequences
 * are worth being plain about.
 *
 * The first is that this is a reconstruction and not a reading. GitHub can move
 * a boundary tomorrow and this will not follow; the extension will, because it
 * is told. The two surfaces can therefore disagree about one row, and that is
 * the honest cost of the desktop having no dashboard to ask.
 *
 * The second is that `courtOf` then runs on top of this unchanged, which is
 * the whole reason for producing a Shelf rather than a Court directly. Every
 * correction it makes — a merged pull request is settled whatever it was grouped
 * under, the top of a stack is not ready while its foundation is unlanded — is a
 * correction this rule does not have to know about.
 */

/**
 * What the documented API can say about a pull request, as far as shelving cares.
 *
 * Less than a pull request and more than a Court needs: every field here is one
 * a single GraphQL query answers, which is what makes six requests into one.
 */
export type Standing = {
  readonly viewerIsAuthor: boolean
  readonly draft: boolean
  /** Whether GitHub is currently testing it against whatever is ahead of it. */
  readonly inMergeQueue: boolean
  /** Whether the reader, personally, has been asked to review. */
  readonly askedOfViewer: boolean
  /** Whether a team the reader belongs to has been asked, which is not the same. */
  readonly askedOfTeam: boolean
  readonly reviewed: Option.Option<Opinion>
  /**
   * None where the pull request has no checks configured.
   *
   * Not the same absence as an Involved Pull Request's own `checks`, which is
   * None until a second read answers. One query answers this, so None here is a
   * fact rather than a wait — and the rule below reads it as one.
   */
  readonly checks: Option.Option<CheckRollup>
}

const failing = (checks: Option.Option<CheckRollup>) =>
  Option.isSome(checks) && checks.value.state === "failing"

const running = (checks: Option.Option<CheckRollup>) =>
  Option.isSome(checks) && checks.value.state === "running"

const said = (reviewed: Option.Option<Opinion>, what: Opinion) =>
  Option.isSome(reviewed) && reviewed.value === what

/**
 * Which of GitHub's six shelves this pull request would have arrived on.
 *
 * Ordered, and the order carries the argument. The queue comes first because a
 * pull request GitHub is already landing is not waiting on the reader for
 * anything, whatever else is true of it. Being asked personally comes before a
 * team being asked because the request that names somebody is the one they
 * cannot assume a colleague will pick up. Everything below that needs the reader
 * to be the Author, and a pull request they merely watch falls through to None —
 * which is exactly what a shelf read would have said about it.
 */
export const shelfOf = (standing: Standing): Option.Option<Shelf> => {
  if (standing.inMergeQueue) return Option.some("merge-queue")
  if (standing.askedOfViewer) return Option.some("needs-action")
  if (standing.askedOfTeam) return Option.some("team-review-requested")

  if (!standing.viewerIsAuthor) return Option.none()

  // Theirs to finish before it is anybody else's to read, so nothing about the
  // checks or the reviews changes the answer.
  if (standing.draft) return Option.some("your-drafts")

  if (failing(standing.checks) || said(standing.reviewed, "changes-requested")) {
    return Option.some("needs-action")
  }

  // Approved while a check is still running is not ready: the button this would
  // put in front of somebody is a button GitHub would refuse.
  if (said(standing.reviewed, "approved") && !running(standing.checks)) {
    return Option.some("ready-to-merge")
  }

  return Option.some("waiting-for-review")
}
