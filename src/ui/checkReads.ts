import type { Kept } from "../app/kept"
import type { CheckNote, Check, FileRef, LogLine } from "../domain/PullRequest"

/**
 * What a check is read as, and the names those readings are held under.
 *
 * The dialog reads them, the list of steps inside it reads them, the header
 * above it warms them, and the panel at the side draws them. Held here rather
 * than in whichever component happened to declare one first: the dialog owned
 * these, the step list imported them back, and the two could not be moved
 * without each other.
 *
 * The keys matter as much as the types. Two components asking for the same
 * step's log have to spell it the same way or one of them re-reads what the
 * other already has, so the spelling is a function nobody writes out by hand.
 */

/** Everything read from a check page, held so a second look is free. */
export type CheckNotes = Kept<string, ReadonlyArray<CheckNote>>

/** A step's log, held under `check name:step`. */
export type CheckLogs = Kept<string, ReadonlyArray<LogLine>>

/** The end of a check's whole log, held under the check's name. */
export type CheckTails = Kept<string, ReadonlyArray<LogLine>>

/** The key a whole log is held under, as against the tail of the same one. */
export const wholeKey = (check: Check): string => `${check.name}:whole`

/** The key a step's log is held under, so both sides agree on one spelling. */
export const logKey = (check: Check, step: number): string => `${check.name}:${step}`

/** What a log can reach out to: the files this pull request touches. */
export type LogReach = {
  readonly paths?: ReadonlyArray<string>
  readonly onOpenFile?: (path: string, line: number) => void
  readonly hrefFor?: (ref: FileRef) => string
}
