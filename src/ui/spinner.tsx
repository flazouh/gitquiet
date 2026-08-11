import type { Art } from "./art"

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
 *
 * Its own module, and not `art.tsx`, because the set that needs it is imported by
 * `art.tsx`: a glyph defined there and read from the Octicons table is read before
 * it exists, and the screen that asked for a running check throws instead of
 * drawing one. The type comes back the other way and costs nothing, being erased.
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
