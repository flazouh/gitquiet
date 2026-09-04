import { Effect } from "effect"
import type { Asked, Card, MergeWay } from "../shared/wire"
import { graphRead, restRead } from "./api"

/**
 * The eight things a card can do to a pull request.
 *
 * All eight are GraphQL mutations, and every one of them is addressed by node id
 * rather than by owner, repository and number — so each write is two round trips,
 * the second of which is the write. REST could do three of these in one (merge,
 * close, update branch) and cannot do the other five at all: there is no
 * documented REST route for taking a pull request into or out of a merge queue, or
 * for moving it into or out of draft. One vocabulary for all eight is worth a
 * round trip nobody is waiting on twice.
 *
 * Every field name and every input field here was read out of the live schema
 * before it was written down, which is how `dequeuePullRequest` came to be the odd
 * one out: its input calls the pull request `id` where the other seven call it
 * `pullRequestId`, and nothing but asking would have said so.
 */

const NODE = `
  query Node($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) { id }
    }
  }
`

/** The pull request's node id, which every mutation below is addressed by. */
export const nodeOf = Effect.fn("nodeOf")(function* (token: string, card: Card) {
  const answer = yield* graphRead<{
    readonly repository: { readonly pullRequest: { readonly id: string } | null } | null
  }>(token, NODE, { owner: card.owner, repo: card.repo, number: card.number })

  const id = answer.repository?.pullRequest?.id
  if (id === undefined) {
    return yield* Effect.fail(
      new Error(`GitHub has no pull request ${card.owner}/${card.repo}#${card.number}`)
    )
  }

  return id
})

/**
 * One mutation, as the query text and the arguments it takes beyond the id.
 *
 * Written as a table rather than eight functions because that is what they are:
 * the same shape, differing in a name and at most one argument. What is not in the
 * table is `expectedHeadOid`, which GitHub offers on the merge and would refuse a
 * write against a branch that has moved since it was read. It belongs here, and it
 * needs the head sha the port does not pass — worth its own change rather than a
 * guess at which sha was on screen.
 */
const mutation = (asked: Asked): { readonly query: string; readonly input: Record<string, unknown> } => {
  switch (asked.doing) {
    case "merge":
      return {
        query: `mutation Merge($input: MergePullRequestInput!) {
          mergePullRequest(input: $input) { clientMutationId }
        }`,
        input: { mergeMethod: asked.method }
      }

    case "close":
      return {
        query: `mutation Close($input: ClosePullRequestInput!) {
          closePullRequest(input: $input) { clientMutationId }
        }`,
        input: {}
      }

    case "reopen":
      return {
        query: `mutation Reopen($input: ReopenPullRequestInput!) {
          reopenPullRequest(input: $input) { clientMutationId }
        }`,
        input: {}
      }

    case "markReady":
      return {
        query: `mutation Ready($input: MarkPullRequestReadyForReviewInput!) {
          markPullRequestReadyForReview(input: $input) { clientMutationId }
        }`,
        input: {}
      }

    case "toDraft":
      return {
        query: `mutation Draft($input: ConvertPullRequestToDraftInput!) {
          convertPullRequestToDraft(input: $input) { clientMutationId }
        }`,
        input: {}
      }

    case "enqueue":
      return {
        query: `mutation Enqueue($input: EnqueuePullRequestInput!) {
          enqueuePullRequest(input: $input) { clientMutationId }
        }`,
        // The back of the line, which is the only place a button labelled "merge
        // when ready" should put anybody. `jump` is how the queue is skipped.
        input: { jump: false }
      }

    case "dequeue":
      return {
        query: `mutation Dequeue($input: DequeuePullRequestInput!) {
          dequeuePullRequest(input: $input) { clientMutationId }
        }`,
        input: {}
      }

    case "cancelAutoMerge":
      return {
        query: `mutation Cancel($input: DisablePullRequestAutoMergeInput!) {
          disablePullRequestAutoMerge(input: $input) { clientMutationId }
        }`,
        input: {}
      }

    case "updateBranch":
      return {
        query: `mutation Catch($input: UpdatePullRequestBranchInput!) {
          updatePullRequestBranch(input: $input) { clientMutationId }
        }`,
        input: { updateMethod: asked.how }
      }
  }
}

/**
 * What the pull request is called in this mutation's input.
 *
 * Seven say `pullRequestId` and `dequeuePullRequest` says `id`. Kept as a value
 * beside the table rather than folded into it so that the exception is visible
 * where somebody adding a ninth mutation will read it.
 */
const idFieldOf = (asked: Asked): string => (asked.doing === "dequeue" ? "id" : "pullRequestId")

const HEAD = `
  query Head($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) { headRef { id } }
    }
  }
`

export const deleteHead = Effect.fn("deleteHead")(function* (token: string, card: Card) {
  const answer = yield* graphRead<{
    readonly repository: { readonly pullRequest: { readonly headRef: { readonly id: string } | null } | null } | null
  }>(token, HEAD, { owner: card.owner, repo: card.repo, number: card.number })

  const ref = answer.repository?.pullRequest?.headRef?.id
  if (ref === undefined) {
    return yield* Effect.fail(new Error("This pull request has no head branch left to delete."))
  }

  yield* graphRead<unknown>(
    token,
    `mutation Delete($input: DeleteRefInput!) { deleteRef(input: $input) { clientMutationId } }`,
    { input: { refId: ref } }
  )
})

export const readSize = Effect.fn("readSize")(function* (token: string, card: Card) {
  const pull = yield* restRead<{ readonly additions: number; readonly deletions: number }>(
    token,
    `/repos/${card.owner}/${card.repo}/pulls/${card.number}`
  )
  return { added: pull.additions, deleted: pull.deletions }
})

export const write = Effect.fn("write")(function* (token: string, card: Card, asked: Asked) {
  const id = yield* nodeOf(token, card)
  const { query, input } = mutation(asked)

  yield* graphRead<unknown>(token, query, { input: { ...input, [idFieldOf(asked)]: id } })
})

/**
 * Which ways this repository allows, out of its own settings.
 *
 * Three booleans on the repository object, which is where GitHub's merge box
 * gets its verdicts from in the first place. One documented REST read, and the
 * only way this window can answer the question at all.
 */
export const waysToMerge = Effect.fn("waysToMerge")(function* (
  token: string,
  where: { readonly owner: string; readonly repo: string }
) {
  const repo = yield* restRead<{
    readonly allow_merge_commit?: boolean
    readonly allow_squash_merge?: boolean
    readonly allow_rebase_merge?: boolean
  }>(token, `/repos/${where.owner}/${where.repo}`)

  /*
   * In GitHub's own order, which is the order their dropdown lists them and the
   * order the extension keeps for the same reason: a list that reorders itself
   * per repository is a list nobody's hand learns.
   *
   * A field GitHub left out is read as allowed, which is the safe way round.
   * Offering a way the repository forbids costs a press and GitHub's own
   * sentence saying why; hiding one it allows leaves a reader with no way to
   * land a pull request and nothing on screen to say what happened. Where the
   * three are all absent this hands back all three, and the press decides.
   */
  return [
    ...(repo.allow_merge_commit === false ? [] : (["MERGE"] as const)),
    ...(repo.allow_squash_merge === false ? [] : (["SQUASH"] as const)),
    ...(repo.allow_rebase_merge === false ? [] : (["REBASE"] as const))
  ] satisfies ReadonlyArray<MergeWay>
})
