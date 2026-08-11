/**
 * The verdict this reader last sent, and the commit it was about.
 *
 * GitHub's own payload carries `latestOpinionatedReviews`, and the word is theirs: an approval
 * and a request for changes are in it, and a review that only said something is in nothing at
 * all. So a reader who commented, reloaded, and was told "not read yet by you" had no way to
 * know their words had landed — which is the same fear people already have about their review
 * dialog, arrived at from the other end.
 *
 * Written to `localStorage` for the same reason `held.ts` is: each screen is its own bundle, so
 * arriving at one builds a new panel, and the panel is drawn in the first render.
 *
 * What GitHub says outranks this. A remembered verdict is only shown where their payload says
 * nothing about this reader, so an approval they dismissed cannot be resurrected from here.
 */

import { UndefinedOr } from "effect"
import type { Verdict } from "../ports/GitHubGateway"
import { SAID } from "./keeping"

const store = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((one: Storage, key: string) => one.getItem(key))
const write = UndefinedOr.liftThrowable((one: Storage, key: string, value: string) => {
  one.setItem(key, value)
})

/** A verdict and the commit it was given about, which is all that is kept. */
export type Sent = {
  readonly verdict: Verdict
  readonly headSha: string
}

const VERDICTS: ReadonlyArray<Verdict> = ["approve", "request-changes", "comment"]

/**
 * Kept as two words and a space, rather than as JSON.
 *
 * Two fields with no punctuation in either, read by a panel that has to be drawn now: a parse
 * that can throw would need a guard here, and the guard is the whole of what JSON would buy.
 */
export const remember = (subject: string, sent: Sent): void => {
  const one = store()
  if (one === undefined) return

  write(one, `${SAID}${subject}`, `${sent.verdict} ${sent.headSha}`)
}

/** What was last sent about this pull request, if anything this file wrote. */
export const remembered = (subject: string): Sent | undefined => {
  const one = store()
  if (one === undefined) return undefined

  const said = read(one, `${SAID}${subject}`)
  if (said === null || said === undefined) return undefined

  const [verdict, headSha] = said.split(" ")
  if (verdict === undefined || headSha === undefined || headSha === "") return undefined
  if (!VERDICTS.includes(verdict as Verdict)) return undefined

  return { verdict: verdict as Verdict, headSha }
}
