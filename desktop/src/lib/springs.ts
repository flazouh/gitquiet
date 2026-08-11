/**
 * Framer Motion springs for the desktop chrome, on Emil's scale.
 *
 * No bounce on everyday surfaces. Press / micro feedback is short and
 * ease-out shaped; exits are always faster than enters.
 */
export const spring = {
  // Hover colour / micro surface — matches --duration-micro.
  fast: {
    type: "spring" as const,
    duration: 0.08,
    bounce: 0,
    exit: { duration: 0.06 },
  },
  // Button press — --duration-press (160ms).
  press: {
    type: "spring" as const,
    duration: 0.16,
    bounce: 0,
    exit: { duration: 0.1 },
  },
  // Panel / menu — --duration-fast open, --duration-quick close. Under 300ms.
  moderate: {
    type: "spring" as const,
    duration: 0.25,
    bounce: 0,
    exit: { duration: 0.15 },
  },
  // Rare emphasis only. Bounce stays off; exit still quicker than enter.
  slow: {
    type: "spring" as const,
    duration: 0.3,
    bounce: 0,
    exit: { duration: 0.15 },
  },
} as const;

// Fallback delay (ms) for deferred-unmount timers that guard an exit tween:
// popups keep their portal mounted until onAnimationComplete fires, but a
// throttled/background tab can stall the animation, so a timer force-unmounts
// after the tier's exit duration plus a safety buffer. Deriving it here keeps
// the timers in step with the tokens above.
export const exitFallbackMs = (tier: { exit: { duration: number } }) =>
  Math.round(tier.exit.duration * 1000) + 100;
