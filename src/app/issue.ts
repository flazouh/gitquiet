/**
 * Everything the issue screen needs, gathered here so the React layer stays
 * ignorant of the gateway.
 *
 * The counterpart of `pullRequest.ts` next door, and a much shorter one for the
 * same reason its gateway is: GitHub serves an issue whole.
 */

import { Effect, Option } from "effect"
import type { Settled, Settling } from "../domain/Issue"
import type { IssueRef } from "../domain/issues"
import { GitHubGateway } from "../ports/GitHubGateway"

export const loadIssue = Effect.fn("loadIssue")(function* (reference: IssueRef) {
  const gateway = yield* GitHubGateway

  const snapshot = yield* gateway.issue(reference)

  return { snapshot }
})

/**
 * The same issue as the last time it was read, without asking GitHub anything.
 *
 * The bargain `rememberedPullRequest` makes: worth showing for the half second
 * before GitHub replies, never worth resting on. Nothing here is current, and
 * the live read replaces all of it either way.
 */
export const rememberedIssue = Effect.fn("rememberedIssue")(function* (reference: IssueRef) {
  const gateway = yield* GitHubGateway

  const snapshot = yield* gateway.rememberedIssue(reference)

  return Option.map(snapshot, (found) => ({ snapshot: found }))
})

/**
 * Reads an issue ahead of being asked for it, so that opening it is a storage read.
 *
 * One request, which makes this the cheapest warm there is: an issue is served whole,
 * body and comments together. Every list that links to one — a repository's issues,
 * the reader's own, a mention in a pull request — pays for the page here instead.
 */
export const warmIssue = Effect.fn("warmIssue")(function* (reference: IssueRef) {
  const gateway = yield* GitHubGateway
  yield* Effect.asVoid(gateway.issue(reference))
})

/**
 * Closes an issue, saying why.
 *
 * The failure is kept rather than swallowed, exactly as starring a repository keeps its
 * own: the header shows the issue closed the moment the reader presses, and it puts that
 * back where GitHub refuses. A refusal that never reached the screen would leave a page
 * saying closed over an issue that is open.
 */
export const settleIssue = Effect.fn("settleIssue")(function* (
  reference: IssueRef,
  id: string,
  settling: Settled
) {
  const gateway = yield* GitHubGateway
  yield* gateway.settleIssue(reference, id, yield* named(settling))
})

/**
 * The duplicate the reader named, under GitHub's own name for it.
 *
 * Their mutation takes `I_kwDOTndREM8AAAABLohEJg` and a person writes `#78`, and nothing turns
 * one into the other without asking: the id packs a repository and a row that only GitHub
 * knows. So the named issue is read, which is also the check that it exists at all — a number
 * nobody typed carefully is the likeliest thing to be wrong about here, and a read that fails
 * is a refusal before anything is closed rather than after.
 *
 * The read is normally free. Every issue this extension has opened is in the store, and the
 * issue somebody is closing a duplicate of is usually the one they were just reading.
 */
const named = Effect.fn("named")(function* (settling: Settled) {
  if (settling.as !== "duplicate") return settling satisfies Settling

  const gateway = yield* GitHubGateway
  const other = yield* gateway.issue(settling.of)

  return { as: "duplicate", of: other.id } satisfies Settling
})

/** The same, the other way: a closed issue opened again. */
export const reopenIssue = Effect.fn("reopenIssue")(function* (reference: IssueRef, id: string) {
  const gateway = yield* GitHubGateway
  yield* gateway.reopenIssue(reference, id)
})

/**
 * Says something on an issue, and hands back the comment GitHub made of it.
 *
 * The comment comes back rendered, which is why nothing is read again after a post: the
 * conversation puts GitHub's own HTML on the screen, so a mention, a reference and a code
 * fence look the same a second after posting as they do an hour later.
 */
export const sayOnIssue = Effect.fn("sayOnIssue")(function* (
  reference: IssueRef,
  id: string,
  body: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.sayOnIssue(reference, id, body)
})
