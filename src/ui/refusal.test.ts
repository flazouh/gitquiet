import { describe, expect, test } from "bun:test"
import { GatewayError } from "../ports/GitHubGateway"
import { reasonFor } from "./refusal"

const failedBy = (reason: "unreachable" | "rejected", detail: string) =>
  new GatewayError({
    reference: { owner: "flazouh", repo: "stack-probe" },
    route: "/page_data/pull_request_stacks",
    reason,
    detail
  })

/**
 * What a reader is told when a write does not go through.
 *
 * The sentence beside the button they pressed, so it is read by somebody deciding
 * what to do next rather than by somebody debugging. GitHub writes the good ones
 * themselves and this passes them through; the rest is this module's problem.
 */
describe("why a write did not go through", () => {
  test("passes GitHub's own sentence through, which is better than any written here", () => {
    const said = "Pull requests must form a stack, where each PR's base ref is the previous PR's head ref"

    expect(reasonFor(failedBy("rejected", said))).toBe(said)
  })

  test("says the reach failed rather than naming the exception it failed with", () => {
    // `writing` files the thrown value as the detail so a log can carry it, and
    // for a while the reader got it verbatim: a card that had been pressed said
    // "TypeError: Failed to fetch" where a sentence belonged. Measured on this
    // card and on the merge card's Convert to draft, so it was every write.
    expect(reasonFor(failedBy("unreachable", "TypeError: Failed to fetch"))).toBe(
      "GitHub could not be reached."
    )
  })

  test("says the same of anything that is not one of the gateway's own failures", () => {
    expect(reasonFor(new Error("boom"))).toBe("GitHub could not be reached.")
    expect(reasonFor(undefined)).toBe("GitHub could not be reached.")
  })
})
