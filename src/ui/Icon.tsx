import type { CheckState, PullRequestState } from "../domain/PullRequest"
import type { Opinion } from "../domain/workingSet"
import { type Art, checkName, pullRequestName, type Set } from "./art"

export type { Art } from "./art"
export { SpinnerIcon } from "./art"

/**
 * A state's glyph, out of a set the caller is holding.
 *
 * The set is an argument rather than a hook's answer because two of the five
 * callers read one inside a `map`, where a hook is not allowed. A screen calls
 * `useArt` once at the top and passes it down, which is a line more and keeps
 * the glyph a check is drawn as in the same set as everything around it.
 */
export const pullRequestArt = (art: Set, state: PullRequestState): Art =>
  art[pullRequestName(state)]

/**
 * The colour a check state is drawn in, beside the glyph it is drawn as.
 *
 * Here rather than in the panel that reads it, so that the two halves of how a
 * state looks cannot drift apart: they are one decision, and one of them lived
 * a thousand lines away from the other for long enough to go wrong quietly.
 * `busy` is `--fgColor-attention`, the yellow GitHub gives to work in hand.
 */
export const CHECK_TONE: Record<CheckState, string> = {
  succeeded: "text-pass",
  failed: "text-fail",
  running: "text-busy",
  queued: "text-busy",
  cancelled: "text-ink-muted",
  skipped: "text-ink-muted",
  neutral: "text-ink-muted"
}

/**
 * The three states a whole run of checks can be in, said as one of the states a
 * single check can be in — which is the only vocabulary the art and the tones
 * above speak.
 */
export const rollupArtState = (state: "passing" | "failing" | "running"): CheckState =>
  state === "passing" ? "succeeded" : state === "failing" ? "failed" : "running"

/** What the reviews came to, in the words a row prints. */
export const OPINION_WORDS: Record<Opinion, string> = {
  approved: "Approved",
  "changes-requested": "Changes requested",
  "review-required": "Review required"
}

export const OPINION_TONE: Record<Opinion, string> = {
  approved: "text-pass",
  "changes-requested": "text-fail",
  "review-required": "text-ink-muted"
}

/**
 * The colour a pull request's state is drawn in where it is a glyph in a line of
 * text, rather than the filled badge `Header.tsx` puts at the top of a card.
 */
export const STATE_INK: Record<PullRequestState, string> = {
  open: "text-pass",
  draft: "text-ink-muted",
  merged: "text-done",
  closed: "text-fail"
}

/** The word for a state, which is the same word the badge on a card uses. */
export const STATE_WORDS: Record<PullRequestState, string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed"
}

export const checkArt = (art: Set, state: CheckState): Art => art[checkName(state)]
