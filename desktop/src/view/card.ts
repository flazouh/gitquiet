import { Effect } from "effect"
import { fromPatch } from "../../../src/domain/fromPatch"
import type { CommitDetail, FetchedDiff, NewComment } from "../../../src/domain/PullRequest"
import type { PullRequestRef, RepoRef } from "../../../src/domain/PullRequestRef"
import { GatewayError } from "../../../src/ports/GitHubGateway"
import type { Asked } from "../shared/wire"
import { keepCard } from "./kept"
import { ask } from "./rpc"
import { commitDetailFrom, remarkOf, snapshotFrom, threadOf } from "./snapshot"

/**
 * The two reads a card is made of, asked of the process holding the token.
 *
 * Nothing here converts anything: `snapshot.ts` next door does that, and does it
 * where a test can reach it. This file cannot be imported outside a webview — the
 * RPC client it needs binds to a preload script that only exists in one — which is
 * exactly why the conversion is not in it.
 */

const refused = (reference: PullRequestRef, route: string, detail: string) =>
  new GatewayError({ reference, route, reason: "rejected", detail })

/** One pull request, asked of the process holding the token. */
export const askForCard = Effect.fn("askForCard")(function* (reference: PullRequestRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("card", reference),
    catch: (cause) => {
      console.error("[working-set] the bridge refused:", cause)
      return refused(reference, "card", String(cause))
    }
  })

  if (!answered.ok) {
    console.error("[working-set] GitHub refused:", answered.why)
    return yield* Effect.fail(refused(reference, "card", answered.why))
  }

  // Kept as facts rather than as the snapshot built from them, because the facts
  // are already JSON — the snapshot has Options and parsed diffs in it, and a
  // round trip through storage would have to invent a way to write those down.
  keepCard(reference, answered.it)

  return snapshotFrom(reference, answered.it)
})

/**
 * The content of some files, for a card already on screen.
 *
 * A path that came back with no patch is answered as a truncated diff rather than
 * left out. Leaving it out means the browser asks again the next time the file is
 * opened, forever, for a file GitHub is never going to send.
 */
/**
 * Something done to a pull request, and the answer to whether it happened.
 *
 * Nothing comes back on success, and that is not an oversight: the card re-reads
 * itself afterwards rather than being told what changed, because a write moves
 * facts nobody on this side can work out — a place in a queue is GitHub's to know,
 * and a merge changes the checks, the state and the header at once.
 */
export const askToWrite = Effect.fn("askToWrite")(function* (
  reference: PullRequestRef,
  asked: Asked
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("write", { ...reference, asked }),
    catch: (cause) => refused(reference, asked.doing, String(cause))
  })

  if (!answered.ok) {
    // Said out loud as well as returned. The card prints this, and a write that
    // GitHub refused is the thing most worth having in the log beside it.
    console.error(`[working-set] GitHub refused to ${asked.doing}:`, answered.why)
    return yield* Effect.fail(refused(reference, asked.doing, answered.why))
  }
})

/**
 * A remark on some lines, and the thread it became.
 *
 * The one write on this card that produces something to draw rather than something
 * to read again: the reader typed it, so it appears where they typed it, and the
 * thread comes back so it can be drawn beside the ones that were already there.
 */
export const askToSay = Effect.fn("askToSay")(function* (
  reference: PullRequestRef,
  note: NewComment
) {
  const answered = yield* Effect.tryPromise({
    try: () =>
      ask("sayOnLines", {
        ...reference,
        path: note.path,
        line: note.line,
        startLine: note.startLine,
        body: note.body,
        headSha: note.headSha
      }),
    catch: (cause) => refused(reference, "comment", String(cause))
  })

  if (!answered.ok) {
    console.error("[working-set] GitHub refused the comment:", answered.why)
    return yield* Effect.fail(refused(reference, "comment", answered.why))
  }

  return threadOf(answered.it)
})

/**
 * Something said about the pull request itself, and the remark it became.
 *
 * The documented issue-comment route, because to GitHub a pull request's
 * conversation is an issue's. The extension has to read a signed form off the page
 * to say the same thing; a window with a token does not.
 */
export const askToRemark = Effect.fn("askToRemark")(function* (
  reference: PullRequestRef,
  body: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("sayOnThePullRequest", { ...reference, body }),
    catch: (cause) => refused(reference, "remark", String(cause))
  })

  if (!answered.ok) {
    console.error("[working-set] GitHub refused the remark:", answered.why)
    return yield* Effect.fail(refused(reference, "remark", answered.why))
  }

  return remarkOf(answered.it)
})

export const askForPatches = Effect.fn("askForPatches")(function* (
  reference: PullRequestRef,
  paths: ReadonlyArray<string>
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("patches", { ...reference, paths }),
    catch: (cause) => refused(reference, "patches", String(cause))
  })

  if (!answered.ok) {
    return yield* Effect.fail(refused(reference, "patches", answered.why))
  }

  return answered.it.map(
    (one): FetchedDiff => ({
      path: one.path,
      diff:
        one.patch === null
          ? { isBinary: false, isTruncated: true, lines: [] }
          : { isBinary: false, isTruncated: false, lines: fromPatch(one.patch) }
    })
  )
})

/** One commit of the repository, for the panel beside the pull request. */
export const askForCommit = Effect.fn("askForCommit")(function* (reference: RepoRef, sha: string) {
  const fail = (detail: string) =>
    new GatewayError({ reference, route: "commit", reason: "rejected", detail })

  const answered = yield* Effect.tryPromise({
    try: () => ask("commit", { owner: reference.owner, repo: reference.repo, sha }),
    catch: (cause) => fail(String(cause))
  })

  if (!answered.ok) {
    console.error("[working-set] GitHub refused the commit:", answered.why)
    return yield* Effect.fail(fail(answered.why))
  }

  return commitDetailFrom(answered.it) satisfies CommitDetail
})

/**
 * Which ways this repository allows, asked of the main process.
 *
 * The shared row write reaches for this before it merges — see
 * `mergeAsTheRepositoryDoes` — so the desktop list lands a pull request the way
 * its repository does rather than posting `SQUASH` and repeating GitHub's
 * refusal back to the reader.
 */
export const askHowToMerge = Effect.fn("askHowToMerge")(function* (
  reference: PullRequestRef
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("howToMerge", { owner: reference.owner, repo: reference.repo }),
    catch: (cause) => refused(reference, "howToMerge", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(refused(reference, "howToMerge", answered.why))

  return answered.it
})
