import { Option } from "effect"
import type { MergeBlocker, PullRequestState } from "./PullRequest"

/**
 * What GitHub said about landing a pull request, before anyone concluded anything.
 *
 * `status` is their `mergeStateStatus` verbatim — `CLEAN`, `BLOCKED`, `BEHIND`,
 * `DIRTY`, `UNSTABLE`, `DRAFT`, `HAS_HOOKS`, `UNKNOWN` — and the rest is what can
 * be counted from the same answer.
 */
export type Landing = {
  readonly state: PullRequestState
  readonly mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN"
  readonly status: string
  readonly unresolved: number
  /** Whether a reviewer's latest word on it was to ask for changes. */
  readonly changesRequested: boolean
  readonly failedChecks: number
  readonly runningChecks: number
}

/**
 * Why this cannot be merged, said in the words of what is actually known.
 *
 * The extension does not need this rule: GitHub's own merge box names each branch
 * rule that failed, and it reads that list. The documented API says only
 * `BLOCKED`, so this concludes what it can from the things it can count —
 * unresolved conversations, failed checks, a reviewer who asked for changes — and
 * where it cannot, it says that rather than guessing. A card that reads as though
 * nothing is wrong, above a merge button that refuses, is worse than one that
 * admits the API is thinner than the page.
 *
 * Nothing is a blocker on a pull request that has already closed or landed, and
 * nothing is one while GitHub is still working the answer out: they compute
 * mergeability lazily, and `UNKNOWN` is "ask again in a second", not "no".
 */
export const blockersOf = (landing: Landing): ReadonlyArray<MergeBlocker> => {
  if (landing.state === "merged" || landing.state === "closed") return []

  const blockers: Array<MergeBlocker> = []

  const add = (
    name: string,
    explanation: string,
    about: Option.Option<"checks" | "conversation">,
    bypassable: boolean
    /*
     * No files on any of these, and there is nowhere here to get them. This
     * concludes from what a list row carries — a count of failed checks, a
     * mergeable flag — and the paths that conflict are only ever on the merge
     * box, which is a read of one pull request. See `docs/spec/conflicted-files.md`.
     */
  ) => blockers.push({ name, explanation, about, bypassable, files: [], mayResolve: false })

  if (landing.state === "draft" || landing.status === "DRAFT") {
    add(
      "Still a draft",
      "A draft is not up for merging until it is marked ready for review.",
      Option.none(),
      // Not a rule an administrator goes past. It is marked ready first, which is
      // a button rather than a permission.
      false
    )
  }

  if (landing.mergeable === "CONFLICTING" || landing.status === "DIRTY") {
    add(
      "Conflicts with the base branch",
      "The branch has to be brought up to date before GitHub can merge it.",
      Option.none(),
      false
    )
  }

  if (landing.status === "BEHIND") {
    add(
      "Behind the base branch",
      "This repository asks for the branch to be level with its base before merging.",
      Option.none(),
      true
    )
  }

  if (landing.failedChecks > 0) {
    add(
      landing.failedChecks === 1 ? "A check has not passed" : `${landing.failedChecks} checks have not passed`,
      "A required check has to pass, or be re-run until it does.",
      Option.some("checks"),
      true
    )
  }

  if (landing.runningChecks > 0) {
    add(
      landing.runningChecks === 1
        ? "A check is still running"
        : `${landing.runningChecks} checks are still running`,
      "GitHub will not merge while a required check is still going.",
      Option.some("checks"),
      true
    )
  }

  if (landing.changesRequested) {
    add(
      "Changes were requested",
      "A reviewer's latest word on this was to ask for changes.",
      Option.some("conversation"),
      true
    )
  }

  if (landing.unresolved > 0) {
    add(
      landing.unresolved === 1
        ? "A conversation is unresolved"
        : `${landing.unresolved} conversations are unresolved`,
      "This repository asks for every conversation to be resolved before merging.",
      Option.some("conversation"),
      true
    )
  }

  /*
   * The last resort, and the honest one. GitHub is holding the merge for a reason
   * they have not sent, and nothing counted above accounts for it — a review that
   * is required and missing, a rule about who may merge, a required check that has
   * not been created yet. Saying so is the only thing left that is true.
   */
  if (blockers.length === 0 && landing.status === "BLOCKED") {
    add(
      "Not ready to merge",
      "GitHub is holding the merge and does not say which of the repository's rules is why. Their own page for this pull request names it.",
      Option.none(),
      true
    )
  }

  return blockers
}
