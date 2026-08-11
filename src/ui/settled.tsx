import type { Art } from "./art"

const SIDES = { small: 16, medium: 24, large: 32 } as const

/**
 * The read landed, drawn as it happens.
 *
 * The counterpart to `spinner.tsx`, and the answer to it: a sentence that spins and then simply
 * disappears leaves a reader who watched it with no idea whether the read finished or gave up.
 * The list underneath cannot say either, because a list that was already right does not change
 * when GitHub agrees with it. So the spinner becomes this, in the same toast, and the ring it
 * was turning closes into a ring with a tick in it.
 *
 * Drawn rather than faded in. The ring and the tick each carry `pathLength="1"`, which
 * normalises their length whatever the geometry, so `motion.css` can dash both with one rule and
 * one keyframe: the ring closes, then the tick is written into it. That reads as the moment of
 * finishing, where a glyph appearing at full opacity reads as a glyph that was always there.
 *
 * Its own module for the reason the spinner gives: `art.tsx` imports the sets, so a glyph
 * defined there and read from a set is read before it exists.
 *
 * The motion is `motion.css`'s, not this file's, because that is where a reduced-motion reader is
 * answered — and the answer there is the finished mark, not a missing one.
 */
export const SettledIcon: Art = ({ size = 16, className, "aria-label": label }) => {
  const side = typeof size === "number" ? size : SIDES[size]

  return (
    <svg
      role="img"
      aria-label={label ?? "Up to date"}
      width={side}
      height={side}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className === undefined ? "t-drawn" : `t-drawn ${className}`}
    >
      {/*
       * Starting at the top, so the ring closes from where the spinner's bright quarter was
       * last seen. The two glyphs are the same size in the same place, which is what makes the
       * swap read as one thing finishing rather than two things exchanged.
       */}
      <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1" pathLength={1} vectorEffect="non-scaling-stroke" />
      <path d="M4.75 8.25 7 10.5l4.25-4.5" pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
