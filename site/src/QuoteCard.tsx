import type { ReactNode } from "react"

/**
 * The soft raised panel already drawn by `.quote-card` in `index.css`.
 *
 * A component rather than another class string on each page, so a new surface
 * reuses this sheet instead of growing CSS. Callers add layout utilities; the
 * paper, radius, and shadow stay on the one class.
 */
export const QuoteCard = ({
  children,
  className
}: {
  readonly children: ReactNode
  readonly className?: string
}) => (
  <section className={className === undefined ? "quote-card" : `quote-card ${className}`}>
    {children}
  </section>
)
