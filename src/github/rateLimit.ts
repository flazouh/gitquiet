/**
 * GitHub's hourly allowance for a stranger, and what is done once it is spent.
 *
 * A person's "Answering" band reads their events from `api.github.com` without a session,
 * which GitHub allows sixty times an hour for the whole address. Spent, every read after it
 * was refused and the band said it "could not read", which reads as something broken. So a
 * refusal that says the allowance is gone is told apart from any other, nothing is asked
 * again before GitHub says it comes back, and the screen can say when that is.
 */

import { WorkingSetError } from "../ports/GitHubGateway"

/** When the allowance comes back, where GitHub's refusal says it is spent, or nothing. */
export const spentUntil = (status: number, headers: Headers): Date | null => {
  if (status !== 403 && status !== 429) return null
  if (headers.get("x-ratelimit-remaining") !== "0") return null
  const reset = Number(headers.get("x-ratelimit-reset"))
  return Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : null
}

/*
 * Shared by every copy of this module, which is four scripts in one isolated world. The
 * content script reads ahead and a screen reads on the press; each asking again on its own
 * would spend a refusal each on an allowance already known to be gone.
 */
const BUDGET = Symbol.for("gitquiet.anonymousBudget")
type Budget = { until: number }
const budget: Budget = ((globalThis as { [BUDGET]?: Budget })[BUDGET] ??= { until: 0 })

/** Says the allowance is gone until then. */
export const theBudgetRunsOut = (until: Date): void => {
  budget.until = Math.max(budget.until, until.getTime())
}

/** When the allowance comes back, where it is still spent now, or nothing. */
export const theBudgetIsSpent = (now: Date = new Date()): Date | null =>
  now.getTime() < budget.until ? new Date(budget.until) : null

/** For a test, which is many visits in one process. */
export const forgetTheBudget = (): void => {
  budget.until = 0
}

/** When the allowance comes back, read off the failure a screen holds, or nothing. */
export const rateLimitedUntil = (why: unknown): Date | null => {
  if (!(why instanceof WorkingSetError) || why.reason !== "rate-limited") return null
  const until = Number(why.detail)
  return Number.isFinite(until) ? new Date(until) : null
}
