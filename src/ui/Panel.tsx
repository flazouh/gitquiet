import type { ReactNode } from "react"
import { cn } from "../lib/cn"
import { type Art, Icon } from "./Icon"
import { type Tone, toneInk } from "./Row"

export type PanelProps = {
  /** Names the region for anyone navigating by landmark. */
  readonly title: string
  readonly art?: Art
  readonly count?: number
  readonly tone?: Tone
  readonly aside?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

/** A labelled region with a quiet heading and an optional count. */
export const Panel = ({
  title,
  art,
  count,
  tone = "default",
  aside,
  children,
  className
}: PanelProps) => (
  <section aria-label={title} className={cn("flex min-w-0 flex-col gap-1.5", className)}>
    <div className="flex h-5 items-center gap-1.5">
      {art === undefined ? null : <Icon of={art} size="sm" className={toneInk[tone]} />}
      <h2
        className={cn(
          "text-2xs font-medium uppercase tracking-[0.08em]",
          tone === "accent" ? "text-ink" : "text-ink-dim"
        )}
      >
        {title}
      </h2>
      {count === undefined ? null : (
        <span
          className={cn(
            "text-2xs tabular-nums",
            tone === "accent" ? "text-accent-ink" : "text-ink-dim"
          )}
        >
          {count}
        </span>
      )}
      {aside === undefined ? null : <div className="ml-auto flex items-center">{aside}</div>}
    </div>
    {children}
  </section>
)
