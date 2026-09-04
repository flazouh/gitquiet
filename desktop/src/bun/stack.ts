import { Effect } from "effect"
import { afterWrite } from "../../../src/github/landed"
import { wouldLand } from "../../../src/domain/pressing"
import type { Card, MergeWay, StackFacts, StackLayerFacts } from "../shared/wire"
import { GitHubRefused, graphRead } from "./api"
import { write } from "./write"

/**
 * One open pull request, as the documented search names it.
 *
 * Enough to walk a branch chain: whose head this is, and whose head it sits on.
 * Not GitHub's official stack object — that has no public route.
 */
export type ChainNode = {
  readonly number: number
  readonly title: string
  readonly headRefName: string
  readonly baseRefName: string
  readonly isDraft: boolean
  readonly state: "OPEN" | "CLOSED" | "MERGED"
}

const stateOf = (one: ChainNode): StackLayerFacts["state"] => {
  if (one.state === "MERGED") return "merged"
  if (one.state === "CLOSED") return "closed"
  return one.isDraft ? "draft" : "open"
}

const layerOf = (
  owner: string,
  repo: string,
  one: ChainNode,
  seat: StackLayerFacts["seat"]
): StackLayerFacts => ({
  owner,
  repo,
  number: one.number,
  title: one.title,
  headBranch: one.headRefName,
  state: stateOf(one),
  seat
})

/**
 * The branch chain this pull request sits in, or nothing when it sits alone.
 *
 * Walks down by matching this base to another head, and up by matching this
 * head to another base. Two or more layers become a stack the card can draw.
 * The number is the foundation's pull-request number, because the documented
 * API has no number for GitHub's own stack object.
 */
export const chainOf = (
  owner: string,
  repo: string,
  here: number,
  nodes: ReadonlyArray<ChainNode>
): StackFacts | null => {
  const byHead = new Map<string, ChainNode>()
  const byBase = new Map<string, ChainNode>()
  const byNumber = new Map<number, ChainNode>()

  for (const one of nodes) {
    byNumber.set(one.number, one)
    if (!byHead.has(one.headRefName)) byHead.set(one.headRefName, one)
    if (!byBase.has(one.baseRefName)) byBase.set(one.baseRefName, one)
  }

  const current = byNumber.get(here)
  if (current === undefined) return null

  const seen = new Set<number>([current.number])
  const below: Array<ChainNode> = []
  let cursor = byHead.get(current.baseRefName)
  while (cursor !== undefined && !seen.has(cursor.number)) {
    seen.add(cursor.number)
    below.unshift(cursor)
    cursor = byHead.get(cursor.baseRefName)
  }

  const above: Array<ChainNode> = []
  cursor = byBase.get(current.headRefName)
  while (cursor !== undefined && !seen.has(cursor.number)) {
    seen.add(cursor.number)
    above.push(cursor)
    cursor = byBase.get(cursor.headRefName)
  }

  if (below.length + above.length === 0) return null

  const layers = [
    ...below.map((one) => layerOf(owner, repo, one, "below")),
    layerOf(owner, repo, current, "here"),
    ...above.map((one) => layerOf(owner, repo, one, "above"))
  ]
  const foundation = layers[0]
  if (foundation === undefined) return null

  const floor = byNumber.get(foundation.number)?.baseRefName ?? null
  return { number: foundation.number, floor, layers }
}

const OPEN = `
  query OpenPulls($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 100, states: OPEN) {
        nodes {
          number
          title
          headRefName
          baseRefName
          isDraft
          state
        }
      }
    }
  }
`

type OpenAnswer = {
  readonly repository: {
    readonly pullRequests: {
      readonly nodes: ReadonlyArray<ChainNode | null>
    }
  } | null
}

export const readChain = Effect.fn("readChain")(function* (
  token: string,
  owner: string,
  repo: string,
  number: number
) {
  const answer: OpenAnswer = yield* graphRead<OpenAnswer>(token, OPEN, { owner, repo })
  const nodes = (answer.repository?.pullRequests.nodes ?? []).filter(
    (one): one is ChainNode => one !== null
  )
  return chainOf(owner, repo, number, nodes)
})

/**
 * Lands this layer and every unmerged layer below it, bottom first.
 *
 * The official stack route is private. This walks the branch chain the
 * documented search can see and merges each layer the ordinary way. An official
 * GitHub stack still refuses that route, and the reader gets GitHub's sentence.
 */
export const mergeStack = Effect.fn("mergeStack")(function* (
  token: string,
  card: Card,
  method: MergeWay
) {
  const chain = yield* readChain(token, card.owner, card.repo, card.number)
  const landing =
    chain === null
      ? [{ owner: card.owner, repo: card.repo, number: card.number }]
      : wouldLand({
          layers: chain.layers.map((one) => ({
            reference: { owner: one.owner, repo: one.repo, number: one.number },
            title: one.title,
            headBranch: one.headBranch,
            state: one.state,
            seat: one.seat
          }))
        }).map((layer) => layer.reference)

  for (const one of landing) {
    yield* write(token, one, { doing: "merge", method })
    afterWrite(one, "merge")
  }
})

/**
 * GitHub's "Create stack" has no documented mutation.
 *
 * Refused out loud rather than answered as success: a press that did nothing
 * would look like a stack the next read still cannot name.
 */
export const makeStack = Effect.fn("makeStack")(function* (
  _token: string,
  _card: Card
) {
  return yield* Effect.fail(
    new GitHubRefused(
      400,
      "GitHub's documented API cannot create an official stack. Their own page can."
    )
  )
})
