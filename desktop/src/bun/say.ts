import { Effect } from "effect"
import type { Card, RemarkFacts, ThreadFacts } from "../shared/wire"
import { restWrite } from "./api"

/**
 * The two things a reader can write that are not a verb about the pull request.
 *
 * A remark on some lines, which starts a review thread, and a remark on the pull
 * request itself, which starts nothing and replies to nobody. GitHub keep them on
 * two different routes under two different names — a pull request review comment
 * and an issue comment — and the split is real rather than historical: one has a
 * place in the diff and something to resolve, and the other has neither.
 *
 * Both are REST, which is the exception in this app. The GraphQL mutations for
 * these want the node id of the pull request and, for a line comment, the diff
 * position worked out in their terms; the REST routes take the path and the line
 * numbers the reader was looking at. Fewer round trips and less arithmetic between
 * what was pointed at and what is sent.
 */

type RestUser = {
  readonly login: string
  readonly type: string
  readonly avatar_url: string | null
} | null

type RestComment = {
  readonly id: number
  readonly node_id: string
  readonly user: RestUser
  readonly body: string
  readonly body_html?: string
  readonly created_at: string
  readonly path?: string
  readonly line?: number | null
  readonly start_line?: number | null
  readonly side?: "LEFT" | "RIGHT" | null
}

const faceOf = (user: RestUser) => ({
  login: user?.login ?? "ghost",
  isAutomated: user?.type === "Bot",
  faceUrl: user?.avatar_url ?? null
})

/**
 * What a comment says, as the interface says it.
 *
 * `body_html` is asked for and not relied on: it arrives only when the request
 * said it wanted HTML, and a reply that came back without it would otherwise draw
 * as nothing at all. The Markdown is what the reader typed, so it is the honest
 * fallback — GitHub's rendering of it turns up the next time the card is read.
 */
const saidOf = (comment: RestComment) => ({
  author: faceOf(comment.user),
  body: comment.body,
  html: comment.body_html ?? "",
  createdAt: comment.created_at
})

/**
 * A remark on some lines of a file.
 *
 * `side: "RIGHT"` throughout, because this interface only offers a comment on the
 * lines a change added or kept — commenting on a line that a change deleted means
 * pointing at the old file, which the diff pane does not let a reader do.
 *
 * `start_line` is sent only for a real range. GitHub refuse a single-line comment
 * that also names a start line equal to its line, which is exactly what a reader
 * who clicked one line produces.
 */
export const sayOnLines = Effect.fn("sayOnLines")(function* (
  token: string,
  card: Card,
  note: {
    readonly path: string
    readonly line: number
    readonly startLine: number
    readonly body: string
    readonly headSha: string
  }
) {
  const ranged = note.startLine !== note.line

  const comment = yield* restWrite<RestComment>(
    token,
    `/repos/${card.owner}/${card.repo}/pulls/${card.number}/comments`,
    {
      body: note.body,
      commit_id: note.headSha,
      path: note.path,
      line: note.line,
      side: "RIGHT",
      ...(ranged ? { start_line: note.startLine, start_side: "RIGHT" } : {})
    }
  )

  /*
   * The thread it became, as one comment in it.
   *
   * GitHub answer with the comment rather than the thread, and a thread's id is
   * not the comment's: the node id here is the comment's own. The card uses it to
   * key what it has just drawn and replaces the lot when it reads again, so a
   * borrowed id is honest for exactly as long as it is used.
   */
  const thread: ThreadFacts = {
    id: comment.node_id,
    isResolved: false,
    at: {
      path: note.path,
      side: "after",
      line: comment.line ?? note.line,
      startLine: comment.start_line ?? note.startLine
    },
    comments: [saidOf(comment)]
  }

  return thread
})

/**
 * A remark on the pull request itself.
 *
 * The issue comment route, because to GitHub a pull request is an issue with a
 * branch attached and its conversation is the issue's. Nothing about this one is
 * placed in the diff, which is why it comes back as a remark rather than a thread.
 */
export const sayOnThePullRequest = Effect.fn("sayOnThePullRequest")(function* (
  token: string,
  card: Card,
  body: string
) {
  const comment = yield* restWrite<RestComment>(
    token,
    `/repos/${card.owner}/${card.repo}/issues/${card.number}/comments`,
    { body }
  )

  const remark: RemarkFacts = { id: comment.node_id, ...saidOf(comment) }
  return remark
})
