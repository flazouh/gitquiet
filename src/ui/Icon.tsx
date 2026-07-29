import {
  AlertFillIcon,
  CheckCircleFillIcon,
  DotIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  SkipFillIcon,
  type Icon as Octicon
} from "@primer/octicons-react"
import type { CheckState, PullRequestState } from "../domain/PullRequest"

export type Art = Octicon

const SIDES = { small: 16, medium: 24, large: 32 } as const

/**
 * GitHub's spinner, taken from their page rather than drawn again.
 *
 * Octicons has no spinner in it: on github.com the turning thing is a Primer
 * component, and the markup below is theirs verbatim — a ring at a quarter
 * strength with a brighter quarter riding on top of it, both stroked in the
 * current colour so the attention yellow a running check already wears carries
 * straight through. The only departure is the class, which is ours rather than
 * their `.anim-rotate`, because a spinner nobody asked to see should stop for
 * someone who has asked the operating system for less motion.
 */
export const SpinnerIcon: Art = ({ size = 16, className, "aria-label": label }) => {
  const side = typeof size === "number" ? size : SIDES[size]

  return (
    <svg
      role="img"
      aria-label={label ?? "Running"}
      width={side}
      height={side}
      viewBox="0 0 16 16"
      fill="none"
      className={className === undefined ? "t-rotate" : `t-rotate ${className}`}
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M15 8a7.002 7.002 0 00-7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Octicons, which is what every other icon on this page already is.
 *
 * Nothing is chosen here that GitHub has not already chosen: a pull request is
 * drawn with the same glyph as the one in the header above this interface, and
 * a passing check with the same tick the Participant has been reading for
 * years. Recognition is worth more than novelty on a page someone opens forty
 * times a day.
 */
export const pullRequestArt = (state: PullRequestState): Art => {
  switch (state) {
    case "draft":
      return GitPullRequestDraftIcon
    case "merged":
      return GitMergeIcon
    case "closed":
      return GitPullRequestClosedIcon
    case "open":
      return GitPullRequestIcon
  }
}

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

export const checkArt = (state: CheckState): Art => {
  switch (state) {
    case "succeeded":
      return CheckCircleFillIcon
    case "failed":
      return AlertFillIcon
    // Running and queued are not the same wait: one is happening, the other has
    // not begun. GitHub draws that difference and so does this.
    case "running":
      return SpinnerIcon
    case "queued":
      return DotIcon
    case "cancelled":
    case "skipped":
    case "neutral":
      return SkipFillIcon
  }
}
