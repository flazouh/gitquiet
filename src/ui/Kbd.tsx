import { cn } from "../lib/utils"

export type KbdProps = {
  readonly children: string
  readonly className?: string
}

/**
 * A key the Participant can press. Shown rather than hidden in a help screen,
 * because an interface that expects the keyboard has to say so.
 */
export const Kbd = ({ children, className }: KbdProps) => (
  <kbd
    className={cn(
      "inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-panel px-1",
      "font-sans text-2xs text-ink-dim",
      className
    )}
  >
    {children}
  </kbd>
)
