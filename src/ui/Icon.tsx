import {
  AlertFillIcon,
  ArrowRightIcon,
  CheckCircleFillIcon,
  ChecklistIcon,
  ClockIcon,
  CodeReviewIcon,
  CommentDiscussionIcon,
  CopilotIcon,
  DotIcon,
  FileDiffIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  SkipFillIcon,
  type Icon as Octicon
} from "@primer/octicons-react"
import type { AttentionKind, Court } from "../domain/Attention"
import type { CheckState, PullRequestState } from "../domain/PullRequest"

export type Art = Octicon

/**
 * Octicons, which is what every other icon on this page already is.
 *
 * Nothing is chosen here that GitHub has not already chosen: a pull request is
 * drawn with the same glyph as the one in the header above this interface, and
 * a passing check with the same tick the Participant has been reading for
 * years. Recognition is worth more than novelty on a page someone opens forty
 * times a day.
 */
export const kindArt: Record<AttentionKind, Art> = {
  thread: CommentDiscussionIcon,
  finding: CopilotIcon,
  file: FileDiffIcon,
  check: ChecklistIcon,
  review: CodeReviewIcon,
  "merge-blocker": GitMergeIcon
}

export const courtArt: Record<Court, Art> = {
  "your-move": ArrowRightIcon,
  "waiting-on-others": ClockIcon,
  settled: CheckCircleFillIcon
}

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

export const checkArt = (state: CheckState): Art => {
  switch (state) {
    case "succeeded":
      return CheckCircleFillIcon
    case "failed":
      return AlertFillIcon
    case "running":
    case "queued":
      return DotIcon
    case "cancelled":
    case "skipped":
    case "neutral":
      return SkipFillIcon
  }
}
