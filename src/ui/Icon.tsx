import {
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Comment01Icon,
  File01Icon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  Loading03Icon,
  MinusSignIcon,
  Robot01Icon,
  UserCheck01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps } from "react"
import type { AttentionKind, Court } from "../domain/Attention"
import type { CheckState, PullRequestState } from "../domain/PullRequest"
import type { IconComponent } from "../lib/icon-context"
import { cn } from "../lib/utils"

export type Art = ComponentProps<typeof HugeiconsIcon>["icon"]

/**
 * The only place icons enter the interface. One stroke weight and three sizes,
 * so an icon never competes with the text beside it, and swapping icon set or
 * tier later is one file rather than thirty.
 */
const sizes = { sm: 13, md: 15, lg: 18 } as const

export type IconProps = {
  readonly of: Art
  readonly size?: keyof typeof sizes
  readonly className?: string
}

export const Icon = ({ of, size = "md", className }: IconProps) => (
  <HugeiconsIcon
    icon={of}
    size={sizes[size]}
    strokeWidth={1.8}
    className={cn("shrink-0", className)}
  />
)

const adapted = new Map<Art, IconComponent>()

/**
 * Fills an installed component's icon slot with one of ours. Registry
 * components expect Lucide's shape — a component taking size and strokeWidth —
 * so this is the adapter that keeps them on Hugeicons without editing them.
 *
 * Memoised per icon: a fresh component identity on every render would remount
 * the icon, and inside a menu that means losing the item's focus.
 */
export const asIcon = (of: Art): IconComponent => {
  const existing = adapted.get(of)
  if (existing !== undefined) return existing

  const Adapted: IconComponent = ({ size, strokeWidth, className }) => (
    <HugeiconsIcon
      icon={of}
      size={size ?? sizes.md}
      strokeWidth={strokeWidth ?? 1.8}
      className={cn("shrink-0", className)}
    />
  )

  adapted.set(of, Adapted)
  return Adapted
}

export const kindArt: Record<AttentionKind, Art> = {
  thread: Comment01Icon,
  finding: Robot01Icon,
  file: File01Icon,
  check: CheckListIcon,
  review: UserCheck01Icon,
  "merge-blocker": GitMergeIcon
}

export const courtArt: Record<Court, Art> = {
  "your-move": ArrowRight01Icon,
  "waiting-on-others": Clock01Icon,
  settled: CheckmarkCircle02Icon
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
      return CheckmarkCircle02Icon
    case "failed":
      return AlertCircleIcon
    case "running":
    case "queued":
      return Loading03Icon
    case "cancelled":
    case "skipped":
    case "neutral":
      return MinusSignIcon
  }
}
