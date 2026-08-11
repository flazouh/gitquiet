import { Effect } from "effect"
import type { RunRef } from "../domain/run"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * A workflow run, for the screen that shows it.
 *
 * One read and no assembly, which is unusual here and is the point: their run page is
 * one document carrying the run's facts, every job and every note, so there is nothing
 * for this layer to stitch together. The gathering and the ranking happen in
 * `src/domain/run.ts`, where they can be tested without a page.
 */
export const loadRun = Effect.fn("loadRun")(function* (reference: RunRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.run(reference)
})

/**
 * The same run as it was last read, without asking GitHub.
 *
 * A finished run never changes, so the memory of one is exactly right; a running run is
 * painted from it and corrected a moment later by the live read.
 */
export const rememberedRun = Effect.fn("rememberedRun")(function* (reference: RunRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedRun(reference)
})

/**
 * Runs a run again, either whole or from where it broke.
 *
 * Nothing is read back. The screen re-reads the run afterwards, which is the only
 * honest answer available: GitHub replies to both presses with the run page's HTML,
 * so what a press achieved is whatever the next read says it did.
 */
export const rerunRun = Effect.fn("rerunRun")(function* (
  reference: RunRef,
  which: "all" | "failed"
) {
  const gateway = yield* GitHubGateway
  yield* gateway.rerunRun(reference, which)
})

/** Stops a run that is still going. */
export const cancelRun = Effect.fn("cancelRun")(function* (reference: RunRef) {
  const gateway = yield* GitHubGateway
  yield* gateway.cancelRun(reference)
})

/** Reads a run ahead of being asked for it, so that opening it is a storage read. */
export const warmRun = Effect.fn("warmRun")(function* (reference: RunRef) {
  const gateway = yield* GitHubGateway
  yield* Effect.asVoid(gateway.run(reference))
})
