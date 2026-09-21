import type { ChangedFile } from "./PullRequest"

/**
 * How many changed lines a file may have and still be drawn without being asked.
 *
 * Drawing is synchronous, and it is not cheap: measured in Chrome, a generated
 * catalogue of 14,193 lines held the page for 2.3 seconds and left ninety-six
 * thousand nodes behind — about 160 milliseconds a thousand lines. Two thousand is
 * a third of a second, which is about where a press stops feeling like it answered.
 * GitHub makes the same call and holds a large diff back until it is asked for.
 */
export const HEAVY_LINES = 2000

/**
 * Whether a file is drawn only when the reader asks for it.
 *
 * Counted off what GitHub says changed, which arrives before the content does, so
 * a file held back is never fetched either. A file GitHub sent no counts for says
 * zero, and is drawn as it always was.
 */
export const drawnWhenAsked = (file: Pick<ChangedFile, "linesAdded" | "linesDeleted">): boolean =>
  file.linesAdded + file.linesDeleted > HEAVY_LINES
