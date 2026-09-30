import { describe, expect, test } from "bun:test"
import { WorkingSetError } from "../ports/GitHubGateway"
import { forgetTheBudget, rateLimitedUntil, spentUntil, theBudgetIsSpent, theBudgetRunsOut } from "./rateLimit"

/*
 * A person's "Answering" band asks GitHub's public API as a stranger, sixty times an hour
 * for the whole address. Measured: an afternoon of reading spent it, and the band said
 * "Could not read what flazouh did" as though something were broken.
 */
describe("GitHub's hourly allowance for a stranger", () => {
  const headers = (remaining: string, reset: string) =>
    new Headers({ "x-ratelimit-remaining": remaining, "x-ratelimit-reset": reset })

  test("is spent when they refuse with nothing left, until the time they give", () => {
    expect(spentUntil(403, headers("0", "1790513849"))?.getTime()).toBe(1790513849_000)
    expect(spentUntil(429, headers("0", "1790513849"))?.getTime()).toBe(1790513849_000)
  })

  test("is not spent by any other refusal", () => {
    expect(spentUntil(403, headers("12", "1790513849"))).toBeNull()
    expect(spentUntil(404, headers("0", "1790513849"))).toBeNull()
    expect(spentUntil(403, new Headers())).toBeNull()
  })

  test("is not asked again before it comes back, and is asked after", () => {
    forgetTheBudget()
    const until = new Date("2026-09-27T14:05:00Z")
    theBudgetRunsOut(until)

    expect(theBudgetIsSpent(new Date("2026-09-27T13:30:00Z"))).toEqual(until)
    expect(theBudgetIsSpent(new Date("2026-09-27T14:05:01Z"))).toBeNull()
    forgetTheBudget()
  })

  test("says when it comes back, read off the failure a screen holds", () => {
    const until = new Date("2026-09-27T14:05:00Z")
    const failure = new WorkingSetError({ route: "x", reason: "rate-limited", detail: String(until.getTime()) })

    expect(rateLimitedUntil(failure)).toEqual(until)
    expect(rateLimitedUntil(new WorkingSetError({ route: "x", reason: "rejected", detail: "HTTP 403" }))).toBeNull()
    expect(rateLimitedUntil(new Error("anything"))).toBeNull()
  })
})
