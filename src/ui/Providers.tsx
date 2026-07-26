import type { ReactNode } from "react"
import { TooltipProvider } from "../components/ui/tooltip"
import { ShapeProvider } from "../lib/shape-context"

export type ProvidersProps = {
  readonly children: ReactNode
}

/**
 * The context the installed components read. Both defaults are wrong for this
 * product: shapes default to pill, which belongs to something softer than a
 * tool kept open all day, and without a tooltip provider every tooltip keeps
 * its own delay, so moving along a row makes each one wait again.
 */
export const Providers = ({ children }: ProvidersProps) => (
  <ShapeProvider defaultShape="rounded">
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      {children}
    </TooltipProvider>
  </ShapeProvider>
)
