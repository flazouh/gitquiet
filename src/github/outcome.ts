/**
 * The words GitHub writes about how something went, and how long it took.
 *
 * One place, because their run page, their list page and their check rows all print the same
 * words for the same seven outcomes. Two readings of one vocabulary would be two answers to
 * one question, and the second would be the one nobody updated.
 */

import type { CheckState } from "../domain/PullRequest"

/**
 * The seven outcomes, off the label GitHub gives the icon.
 *
 * The label is the only place on their pages that says the same word for a run, a job and a
 * step, so reading it once serves all three. Anything unrecognised is neutral rather than a
 * failure: something this cannot read the standing of should not be reported red.
 */
const STATES: ReadonlyArray<readonly [string, CheckState]> = [
  ["completed successfully", "succeeded"],
  ["failed", "failed"],
  ["currently running", "running"],
  ["queued", "queued"],
  ["waiting", "queued"],
  /*
   * Their `action_required`: a fork's run held until somebody with write access allows it.
   * None of the seven words this vocabulary has is that, and queued is the nearest: it is
   * waiting on something, and it is drawn in the colour of something that wants attention.
   * Read off `oven-sh/bun/actions`, where twenty of twenty-five rows were in this state.
   */
  ["requires action", "queued"],
  ["cancelled", "cancelled"],
  ["skipped", "skipped"],
  ["neutral", "neutral"]
]

export const stateOf = (label: string): CheckState => {
  const said = label.toLowerCase()
  return STATES.find(([name]) => said.includes(name))?.[1] ?? "neutral"
}

/**
 * A duration the way their pages write it: "1m 2s", "27s", "1h 5m 3s".
 *
 * Zero for a run still going, which they write as an en dash, because a duration is only ever
 * added up here and a missing one is worth nothing to a total.
 */
export const secondsIn = (said: string): number => {
  const units: Record<string, number> = { h: 3600, m: 60, s: 1 }
  let total = 0
  for (const [, amount = "0", unit = "s"] of said.matchAll(/(\d+)\s*([hms])/g)) {
    total += Number(amount) * (units[unit] ?? 0)
  }
  return total
}

export const text = (node: Element | null | undefined): string => (node?.textContent ?? "").trim()
