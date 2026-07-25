import { cn } from "../lib/cn"
import { type Art, Icon } from "./Icon"

export type Tone = "default" | "accent" | "pass" | "fail" | "busy"

export const toneInk: Record<Tone, string> = {
  default: "text-ink-dim",
  accent: "text-accent-ink",
  pass: "text-pass",
  fail: "text-fail",
  busy: "text-busy"
}

export type RowProps = {
  readonly art: Art
  readonly label: string
  readonly meta?: string
  readonly tone?: Tone
  readonly selected?: boolean
  readonly onSelect?: () => void
}

/**
 * One selectable line: the unit the whole interface is built from, whether it
 * carries a group of Attention Items, a file in a Queue, or a check. Selection
 * reads as a lighter surface rather than an outline, since nothing here has a
 * border.
 */
export const Row = ({
  art,
  label,
  meta,
  tone = "default",
  selected = false,
  onSelect
}: RowProps) => (
  <button
    type="button"
    aria-current={selected}
    onClick={onSelect}
    className={cn(
      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
      "transition-colors duration-instant ease-out",
      selected
        ? "bg-panel-active"
        : "bg-panel hover:bg-panel-hover active:bg-panel-active"
    )}
  >
    <Icon of={art} size="sm" className={toneInk[tone]} />
    {/* The label never yields to the preview beside it: what the row *is*
        outranks a glimpse of what is in it. */}
    <span className="shrink-0 text-sm tabular-nums text-ink">{label}</span>
    {meta === undefined ? null : (
      <span className="min-w-0 flex-1 truncate text-right text-xs text-ink-dim">{meta}</span>
    )}
  </button>
)
