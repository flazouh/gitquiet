import { INK, MARK } from "./bed"

/*
 * The mark and the wordmark, drawn by the site and by the app's first screen.
 *
 * Shared for the reason the gradient is: they are the two things a reader has just
 * seen on gitquiet.com, and a logo that is nearly the same is worse than one that is
 * plainly different. The icon geometry the build script rasterises into `.icns` is
 * still its own copy — that one runs without React — and it says so in its own file.
 */

export const Mark = ({
  size = 128,
  color = MARK
}: {
  readonly size?: number
  readonly color?: string
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    stroke={color}
    aria-hidden="true"
    role="presentation"
  >
    <circle cx={15.4} cy={12.2} r={7} strokeWidth={2.5} />
    <path d="M22.4 12.2 V23.4" strokeWidth={2.5} />
    <circle cx={22.4} cy={25.6} r={2.5} fill={color} stroke="none" />
  </svg>
)

export const Wordmark = ({
  size = 32,
  color = INK
}: {
  readonly size?: number
  readonly color?: string
}) => (
  <span
    style={{
      fontSize: size,
      fontWeight: 620,
      letterSpacing: "-0.035em",
      color,
      lineHeight: 1
    }}
  >
    gitquiet
  </span>
)
