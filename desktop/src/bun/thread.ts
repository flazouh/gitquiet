import { Effect } from "effect"
import type { Card, SaidFacts } from "../shared/wire"
import { graphRead } from "./api"
import { nodeOf } from "./write"

/**
 * The four conversation writes a card offers besides a new remark.
 *
 * GraphQL throughout: resolving a thread and submitting a review have no
 * documented REST route that takes the same ids the card already holds, and a
 * reply addressed to a comment is `inReplyTo` on their review-comment mutation.
 */

const EVENT = {
  approve: "APPROVE",
  "request-changes": "REQUEST_CHANGES",
  comment: "COMMENT"
} as const

export const settleThread = Effect.fn("settleThread")(function* (
  token: string,
  threadId: string
) {
  yield* graphRead<unknown>(
    token,
    `mutation Resolve($input: ResolveReviewThreadInput!) {
      resolveReviewThread(input: $input) { thread { id } }
    }`,
    { input: { threadId } }
  )
})

export const unsettleThread = Effect.fn("unsettleThread")(function* (
  token: string,
  threadId: string
) {
  yield* graphRead<unknown>(
    token,
    `mutation Unresolve($input: UnresolveReviewThreadInput!) {
      unresolveReviewThread(input: $input) { thread { id } }
    }`,
    { input: { threadId } }
  )
})

export const replyToComment = Effect.fn("replyToComment")(function* (
  token: string,
  card: Card,
  commentId: string,
  body: string
) {
  const pullRequestId = yield* nodeOf(token, card)

  const answer = yield* graphRead<{
    readonly addPullRequestReviewComment: {
      readonly comment: {
        readonly id: string
        readonly body: string
        readonly bodyHTML: string
        readonly createdAt: string
        readonly author: {
          readonly login: string
          readonly __typename: string
          readonly avatarUrl: string | null
        } | null
      } | null
    } | null
  }>(
    token,
    `mutation Reply($input: AddPullRequestReviewCommentInput!) {
      addPullRequestReviewComment(input: $input) {
        comment {
          id
          body
          bodyHTML
          createdAt
          author { login __typename avatarUrl }
        }
      }
    }`,
    { input: { pullRequestId, inReplyTo: commentId, body } }
  )

  const comment = answer.addPullRequestReviewComment?.comment
  if (comment === undefined || comment === null) {
    return yield* Effect.fail(new Error("GitHub did not hand the reply back."))
  }

  const said: SaidFacts = {
    id: comment.id,
    author: {
      login: comment.author?.login ?? "ghost",
      isAutomated: comment.author?.__typename === "Bot",
      faceUrl: comment.author?.avatarUrl ?? null
    },
    body: comment.body,
    html: comment.bodyHTML,
    createdAt: comment.createdAt
  }

  return said
})

export const submitReview = Effect.fn("submitReview")(function* (
  token: string,
  card: Card,
  asked: { readonly verdict: keyof typeof EVENT; readonly note: string; readonly headSha: string }
) {
  const pullRequestId = yield* nodeOf(token, card)

  yield* graphRead<unknown>(
    token,
    `mutation Review($input: AddPullRequestReviewInput!) {
      addPullRequestReview(input: $input) { pullRequestReview { id } }
    }`,
    {
      input: {
        pullRequestId,
        event: EVENT[asked.verdict],
        body: asked.note,
        commitOID: asked.headSha
      }
    }
  )
})
