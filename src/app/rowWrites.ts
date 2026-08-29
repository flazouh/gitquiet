import type { RowDoing } from "../domain/doable"
import type { PullRequestRef } from "../domain/PullRequestRef"
import {
  closePullRequest,
  convertToDraft,
  markReadyForReview,
  mergeAsTheRepositoryDoes,
  reopenPullRequest
} from "./pullRequest"

/**
 * Which app-level write each verb a row can offer stands for.
 *
 * Only the five the state alone allows — see `whatStateAllows` — since the queue
 * verbs need a merge state no row has read. Asked for by name so the menu hands
 * over a verb rather than a function, which is what lets the same menu serve a
 * surface whose gateway is nothing like this one.
 *
 * One table, in the app layer, because there were two: the extension's list and
 * the desktop window's, written apart and drifted apart. Merging from a row was
 * fixed in one of them and stayed broken in the other, which is the way that
 * goes. Both surfaces reach the same five verbs through the same seam now, and
 * what differs between them is the gateway underneath — which is the only thing
 * that ever should have.
 */
export const ROW_WRITES = {
  merge: mergeAsTheRepositoryDoes,
  close: closePullRequest,
  reopen: reopenPullRequest,
  markReady: markReadyForReview,
  toDraft: convertToDraft
} as const satisfies Record<RowDoing, (reference: PullRequestRef) => unknown>
