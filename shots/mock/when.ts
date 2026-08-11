/**
 * When everything on these screens happened, measured from the capture.
 *
 * Relative rather than fixed dates. Every screen draws "3h ago" from the clock, so a
 * fixed instant is fresh on the day it is written and says "4d ago" by the end of the
 * week — which in a store listing reads as an interface nobody has opened since.
 *
 * Read once at import rather than per call, so two rows an hour apart in the data are
 * an hour apart on the screen no matter how long the capture takes.
 */
const NOW = Date.now()

const ago = (milliseconds: number): string => new Date(NOW - milliseconds).toISOString()

export const minutesAgo = (minutes: number): string => ago(minutes * 60_000)
export const hoursAgo = (hours: number): string => ago(hours * 3_600_000)
export const daysAgo = (days: number): string => ago(days * 86_400_000)
