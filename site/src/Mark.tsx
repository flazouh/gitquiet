import { INK, MARK } from "./brand"

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
